import express from 'express'
import prisma from '../db.js'
import logger from '../logger.js'
import masterOnly from '../middleware/masterOnly.js'
import { getIo, mapRoom } from '../socket/io.js'
import {
    DEFAULT_SHAPE, DEFAULT_SIZE, MAP_SHAPES, MAP_SIZES,
    resolveDimensions, dimensionsToPreset, clampPosition, tokenInclude,
} from '../utils/grid.js'

const PRESET_ERROR = `shape deve ser um de [${MAP_SHAPES.join(', ')}] e size um de [${MAP_SIZES.join(', ')}]`

const router = express.Router()

// Gerenciamento de mapas/tokens e restrito ao mestre (masterOnly). Mover tokens
// (PATCH em /api/tokens/:id) e liberado para todos e vive em routes/tokens.js.

// ================= Mapas =================

// GET /api/maps — lista mapas da aventura (qualquer jogador)
router.get('/', async (req, res, next) => {
    try {
        const maps = await prisma.gameMap.findMany({
            where: { adventureId: req.adventure.id },
            orderBy: { id: 'asc' },
        })
        res.json(maps)
    } catch (e) { next(e) }
})

// GET /api/maps/:id — mapa com tokens (qualquer jogador)
router.get('/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const map = await prisma.gameMap.findUnique({
            where: { id },
            include: { tokens: { include: tokenInclude } },
        })
        if (!map || map.adventureId !== req.adventure.id) {
            return res.status(404).json({ error: 'Mapa nao encontrado' })
        }
        res.json(map)
    } catch (e) { next(e) }
})

// POST /api/maps — cria mapa (mestre). Body: { nome, shape, size }
router.post('/', masterOnly, async (req, res, next) => {
    try {
        const { nome, shape = DEFAULT_SHAPE, size = DEFAULT_SIZE, backgroundUrl = null } = req.body
        if (!nome || typeof nome !== 'string' || !nome.trim()) {
            return res.status(400).json({ error: 'nome e obrigatorio' })
        }
        const dims = resolveDimensions(shape, size)
        if (!dims) {
            return res.status(400).json({ error: PRESET_ERROR })
        }

        const map = await prisma.gameMap.create({
            data: {
                nome: nome.trim(),
                gridWidth: dims.gridWidth,
                gridHeight: dims.gridHeight,
                backgroundUrl: backgroundUrl || null,
                adventureId: req.adventure.id,
            },
        })
        logger.info('mapa criado', { id: map.id, adventureId: req.adventure.id, shape, size, requestId: req.requestId })
        res.status(201).json(map)
    } catch (e) { next(e) }
})

// PATCH /api/maps/:id — edita nome e/ou size (mestre). Resize clampa tokens.
router.patch('/:id', masterOnly, async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const { nome, shape, size, backgroundUrl } = req.body

        const map = await prisma.gameMap.findUnique({ where: { id } })
        if (!map || map.adventureId !== req.adventure.id) {
            return res.status(404).json({ error: 'Mapa nao encontrado' })
        }

        const data = {}
        if (nome !== undefined) {
            if (typeof nome !== 'string' || !nome.trim()) {
                return res.status(400).json({ error: 'nome invalido' })
            }
            data.nome = nome.trim()
        }
        if (backgroundUrl !== undefined) {
            data.backgroundUrl = backgroundUrl || null
        }
        let newWidth = map.gridWidth
        let newHeight = map.gridHeight
        // Redimensionamento: como o mapa so armazena as dimensoes, deduzimos o
        // eixo nao enviado a partir das dimensoes atuais (fallback aos defaults
        // para mapas antigos fora da matriz).
        if (shape !== undefined || size !== undefined) {
            const current = dimensionsToPreset(map.gridWidth, map.gridHeight)
                ?? { shape: DEFAULT_SHAPE, size: DEFAULT_SIZE }
            const dims = resolveDimensions(shape ?? current.shape, size ?? current.size)
            if (!dims) {
                return res.status(400).json({ error: PRESET_ERROR })
            }
            newWidth = dims.gridWidth
            newHeight = dims.gridHeight
            data.gridWidth = newWidth
            data.gridHeight = newHeight
        }

        if (!Object.keys(data).length) {
            return res.status(400).json({ error: 'nome, shape, size ou backgroundUrl sao obrigatorios' })
        }

        // Resize que reduz o grid: clampa tokens que ficaram fora dos limites.
        const shrinking = newWidth < map.gridWidth || newHeight < map.gridHeight
        const updated = await prisma.$transaction(async (tx) => {
            const m = await tx.gameMap.update({ where: { id }, data })
            if (shrinking) {
                const tokens = await tx.token.findMany({ where: { gameMapId: id } })
                await Promise.all(
                    tokens
                        .filter((t) => t.posX > newWidth - 1 || t.posY > newHeight - 1)
                        .map((t) => {
                            const { posX, posY } = clampPosition(t.posX, t.posY, newWidth, newHeight)
                            return tx.token.update({ where: { id: t.id }, data: { posX, posY } })
                        })
                )
            }
            return m
        })

        logger.info('mapa atualizado', { id, shape, size, requestId: req.requestId })
        res.json(updated)
    } catch (e) { next(e) }
})

// DELETE /api/maps/:id — deleta mapa e tokens (mestre)
router.delete('/:id', masterOnly, async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const map = await prisma.gameMap.findUnique({ where: { id } })
        if (!map || map.adventureId !== req.adventure.id) {
            return res.status(404).json({ error: 'Mapa nao encontrado' })
        }
        await prisma.gameMap.delete({ where: { id } })
        logger.info('mapa deletado', { id, requestId: req.requestId })
        res.status(204).end()
    } catch (e) { next(e) }
})

// POST /api/maps/:id/activate — ativa mapa (mestre).
// Em transacao: deleta tokens do mapa ativo anterior, desativa-o e ativa o novo.
// Depois emite grid:activated para redirecionar os clientes da aventura.
router.post('/:id/activate', masterOnly, async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const map = await prisma.gameMap.findUnique({ where: { id } })
        if (!map || map.adventureId !== req.adventure.id) {
            return res.status(404).json({ error: 'Mapa nao encontrado' })
        }

        const activated = await prisma.$transaction(async (tx) => {
            const previous = await tx.gameMap.findMany({
                where: { adventureId: req.adventure.id, active: true, NOT: { id } },
            })
            for (const prev of previous) {
                await tx.token.deleteMany({ where: { gameMapId: prev.id } })
                await tx.gameMap.update({ where: { id: prev.id }, data: { active: false } })
            }
            return tx.gameMap.update({ where: { id }, data: { active: true } })
        })

        // Redireciona todos os clientes da aventura para o novo mapa.
        getIo()?.to(`adventure:${req.adventure.id}`).emit('grid:activated', { mapId: id })

        logger.info('mapa ativado', { id, adventureId: req.adventure.id, requestId: req.requestId })
        res.json(activated)
    } catch (e) { next(e) }
})

// ================= Tokens (adicionar via mapa) =================

// POST /api/maps/:id/tokens — adiciona token ao mapa (mestre)
router.post('/:id/tokens', masterOnly, async (req, res, next) => {
    try {
        const mapId = Number(req.params.id)
        const { characterId, posX = 0, posY = 0 } = req.body

        if (!characterId) {
            return res.status(400).json({ error: 'characterId e obrigatorio' })
        }

        const map = await prisma.gameMap.findUnique({ where: { id: mapId } })
        if (!map || map.adventureId !== req.adventure.id) {
            return res.status(404).json({ error: 'Mapa nao encontrado' })
        }

        const character = await prisma.character.findUnique({ where: { id: Number(characterId) } })
        if (!character || character.adventureId !== req.adventure.id) {
            return res.status(404).json({ error: 'Personagem nao encontrado' })
        }

        // Evita dois tokens do mesmo personagem no mesmo mapa.
        const existing = await prisma.token.findFirst({
            where: { gameMapId: mapId, characterId: Number(characterId) },
        })
        if (existing) {
            return res.status(409).json({ error: 'Personagem ja possui token neste mapa' })
        }

        const pos = clampPosition(posX, posY, map.gridWidth, map.gridHeight)
        const token = await prisma.token.create({
            data: { gameMapId: mapId, characterId: Number(characterId), posX: pos.posX, posY: pos.posY },
            include: tokenInclude,
        })

        getIo()?.to(mapRoom(mapId)).emit('grid:added', { token })
        logger.info('token adicionado', { tokenId: token.id, mapId, characterId: Number(characterId), requestId: req.requestId })
        res.status(201).json(token)
    } catch (e) { next(e) }
})

export default router

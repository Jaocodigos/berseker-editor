import express from 'express'
import prisma from '../db.js'
import logger from '../logger.js'
import masterOnly from '../middleware/masterOnly.js'
import { getIo, mapRoom } from '../socket/io.js'
import { clampPosition, tokenInclude } from '../utils/grid.js'

const router = express.Router()

// Carrega o token e valida que pertence a um mapa da aventura atual.
async function loadTokenInAdventure(id, adventureId) {
    const token = await prisma.token.findUnique({
        where: { id },
        include: { gameMap: true },
    })
    if (!token || token.gameMap.adventureId !== adventureId) return null
    return token
}

// PATCH /api/tokens/:id — atualiza posicao (qualquer jogador).
// Fallback/persistencia do drag; o caminho em tempo real e o evento grid:move.
router.patch('/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const token = await loadTokenInAdventure(id, req.adventure.id)
        if (!token) return res.status(404).json({ error: 'Token nao encontrado' })

        const { posX, posY } = req.body
        if (posX === undefined || posY === undefined) {
            return res.status(400).json({ error: 'posX e posY sao obrigatorios' })
        }

        const pos = clampPosition(posX, posY, token.gameMap.gridWidth, token.gameMap.gridHeight)
        const updated = await prisma.token.update({
            where: { id },
            data: { posX: pos.posX, posY: pos.posY },
            include: tokenInclude,
        })

        getIo()?.to(mapRoom(token.gameMapId)).emit('grid:moved', {
            tokenId: id,
            posX: updated.posX,
            posY: updated.posY,
        })
        res.json(updated)
    } catch (e) { next(e) }
})

// DELETE /api/tokens/:id — remove token do mapa (mestre)
router.delete('/:id', masterOnly, async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const token = await loadTokenInAdventure(id, req.adventure.id)
        if (!token) return res.status(404).json({ error: 'Token nao encontrado' })

        await prisma.token.delete({ where: { id } })
        getIo()?.to(mapRoom(token.gameMapId)).emit('grid:removed', { tokenId: id, mapId: token.gameMapId })
        logger.info('token removido', { tokenId: id, mapId: token.gameMapId, requestId: req.requestId })
        res.status(204).end()
    } catch (e) { next(e) }
})

export default router

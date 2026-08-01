import express from 'express'
import prisma from '../db.js'
import adminAuth from '../middleware/adminAuth.js'
import logger from '../logger.js'

const router = express.Router()

// Aplica adminAuth a todas as rotas deste router, exceto as rotas de seleção de aventura
// (POST /:id/select e POST /deselect) que sao tratadas em index.js com authMiddleware comum.
router.use((req, res, next) => {
    if (req.method === 'POST' && (req.path === '/deselect' || /^\/\d+\/select$/.test(req.path))) {
        return next('router')
    }
    return adminAuth(req, res, next)
})

// Listar aventuras
router.get('/', async (req, res, next) => {
    try {
        const adventures = await prisma.adventure.findMany({
            include: { _count: { select: { users: true, characters: true } } },
            orderBy: { createdAt: 'desc' }
        })
        res.json(adventures)
    } catch (e) { next(e) }
})

// Criar aventura
router.post('/', async (req, res, next) => {
    try {
        const { nome } = req.body
        if (!nome) return res.status(400).json({ error: 'nome e obrigatorio' })

        const adventure = await prisma.adventure.create({
            data: { nome }
        })

        logger.info('aventura criada', { id: adventure.id, nome: adventure.nome })
        res.status(201).json(adventure)
    } catch (e) { next(e) }
})

// Editar aventura
router.patch('/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const { nome } = req.body
        if (!nome) return res.status(400).json({ error: 'nome e obrigatorio' })

        const adventure = await prisma.adventure.update({
            where: { id },
            data: { nome }
        })

        logger.info('aventura atualizada', { id: adventure.id, nome: adventure.nome })
        res.json(adventure)
    } catch (e) {
        if (e.code === 'P2025') return res.status(404).json({ error: 'Aventura nao encontrada' })
        next(e)
    }
})

// Deletar aventura (cascade: characters, memberships)
router.delete('/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        await prisma.adventure.delete({ where: { id } })
        logger.info('aventura deletada', { id })
        res.status(204).end()
    } catch (e) {
        if (e.code === 'P2025') return res.status(404).json({ error: 'Aventura nao encontrada' })
        next(e)
    }
})

// ================= Memberships =================

// Listar usuarios da aventura
router.get('/:id/users', async (req, res, next) => {
    try {
        const adventureId = Number(req.params.id)
        const adventure = await prisma.adventure.findUnique({ where: { id: adventureId } })
        if (!adventure) return res.status(404).json({ error: 'Aventura nao encontrada' })

        const members = await prisma.adventureUser.findMany({
            where: { adventureId },
            include: { user: { select: { id: true, username: true, createdAt: true } } }
        })
        res.json(members.map(m => ({ id: m.user.id, username: m.user.username, role: m.role, createdAt: m.user.createdAt })))
    } catch (e) { next(e) }
})

// Adicionar usuario a aventura
router.post('/:id/users', async (req, res, next) => {
    try {
        const adventureId = Number(req.params.id)
        const { userId, role = 'player' } = req.body

        if (!userId) return res.status(400).json({ error: 'userId e obrigatorio' })
        if (!['player', 'master'].includes(role)) {
            return res.status(400).json({ error: 'role deve ser "player" ou "master"' })
        }

        const adventure = await prisma.adventure.findUnique({ where: { id: adventureId } })
        if (!adventure) return res.status(404).json({ error: 'Aventura nao encontrada' })

        const user = await prisma.user.findUnique({ where: { id: Number(userId) } })
        if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' })

        const membership = await prisma.adventureUser.create({
            data: { userId: Number(userId), adventureId, role }
        })

        logger.info('usuario adicionado a aventura', { userId: Number(userId), adventureId, role })
        res.status(201).json({ id: user.id, username: user.username, role: membership.role })
    } catch (e) {
        if (e.code === 'P2002') {
            return res.status(409).json({ error: 'Usuario ja pertence a esta aventura' })
        }
        next(e)
    }
})

// Alterar role do usuario na aventura
router.patch('/:id/users/:userId', async (req, res, next) => {
    try {
        const adventureId = Number(req.params.id)
        const userId = Number(req.params.userId)
        const { role } = req.body

        if (!role || !['player', 'master'].includes(role)) {
            return res.status(400).json({ error: 'role deve ser "player" ou "master"' })
        }

        const membership = await prisma.adventureUser.findUnique({
            where: { userId_adventureId: { userId, adventureId } }
        })
        if (!membership) return res.status(404).json({ error: 'Usuario nao pertence a esta aventura' })

        await prisma.adventureUser.update({
            where: { userId_adventureId: { userId, adventureId } },
            data: { role }
        })

        logger.info('role atualizado', { userId, adventureId, role })
        res.json({ userId, adventureId, role })
    } catch (e) { next(e) }
})

// Remover usuario da aventura
router.delete('/:id/users/:userId', async (req, res, next) => {
    try {
        const adventureId = Number(req.params.id)
        const userId = Number(req.params.userId)

        await prisma.adventureUser.delete({
            where: { userId_adventureId: { userId, adventureId } }
        })

        logger.info('usuario removido da aventura', { userId, adventureId })
        res.status(204).end()
    } catch (e) {
        if (e.code === 'P2025') return res.status(404).json({ error: 'Usuario nao pertence a esta aventura' })
        next(e)
    }
})

export default router

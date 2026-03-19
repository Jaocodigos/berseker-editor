import express from 'express'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import adminAuth from '../middleware/adminAuth.js'
import logger from '../logger.js'

const router = express.Router()
const prisma = new PrismaClient()

router.use(adminAuth)

// Listar usuários
router.get('/', async (req, res, next) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, username: true, createdAt: true }
        })
        res.json(users)
    } catch (e) { next(e) }
})

// Criar usuário
router.post('/', async (req, res, next) => {
    try {
        const { username, password } = req.body

        if (!username || !password) {
            return res.status(400).json({ error: 'username e password são obrigatórios' })
        }

        const passwordHash = await bcrypt.hash(password, 10)

        const user = await prisma.user.create({
            data: { username, passwordHash },
            select: { id: true, username: true, createdAt: true }
        })

        logger.info('usuario criado', { id: user.id, username: user.username })
        res.status(201).json(user)
    } catch (e) {
        if (e.code === 'P2002') {
            logger.warn('usuario: username ja existe', { username: req.body.username })
            return res.status(409).json({ error: 'Username já existe' })
        }
        next(e)
    }
})

// Atualizar usuário
router.patch('/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const { username, password } = req.body
        const data = {}

        if (username) data.username = username
        if (password) data.passwordHash = await bcrypt.hash(password, 10)

        if (!Object.keys(data).length) {
            return res.status(400).json({ error: 'username ou password são obrigatórios' })
        }

        const user = await prisma.user.update({
            where: { id },
            data,
            select: { id: true, username: true, createdAt: true }
        })

        logger.info('usuario atualizado', { id: user.id, username: user.username, campos: Object.keys(data).join(',') })
        res.json(user)
    } catch (e) {
        if (e.code === 'P2025') return res.status(404).json({ error: 'Usuário não encontrado' })
        next(e)
    }
})

// Deletar usuário
router.delete('/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        await prisma.user.delete({ where: { id } })
        logger.info('usuario deletado', { id })
        res.status(204).end()
    } catch (e) {
        if (e.code === 'P2025') return res.status(404).json({ error: 'Usuário não encontrado' })
        next(e)
    }
})

export default router

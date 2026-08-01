import express from 'express'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import prisma from '../db.js'
import logger from '../logger.js'
import authMiddleware from '../middleware/auth.js'

const router = express.Router()

const SESSION_DURATION_MS = 3 * 60 * 60 * 1000 // 3 horas

const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
}

// Login — valida credenciais, cria sessão e seta cookie httpOnly
router.post('/login', async (req, res, next) => {
    const { username, password } = req.body

    if (!username || !password) {
        return res.status(400).json({ error: 'username e password são obrigatórios' })
    }

    try {
        const user = await prisma.user.findUnique({ where: { username } })

        if (!user) {
            logger.warn('login: usuario nao encontrado', { username, ip: req.ip })
            return res.status(401).json({ error: 'Credenciais inválidas' })
        }

        const valid = await bcrypt.compare(password, user.passwordHash)

        if (!valid) {
            logger.warn('login: senha incorreta', { username, ip: req.ip })
            return res.status(401).json({ error: 'Credenciais inválidas' })
        }

        const token = randomUUID()
        const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

        await prisma.session.create({ data: { token, userId: user.id, expiresAt } })

        const adventures = await prisma.adventureUser.findMany({
            where: { userId: user.id },
            include: { adventure: true }
        })

        logger.info('login: sessão criada', { username, ip: req.ip })
        res.cookie('session', token, { ...cookieOptions, maxAge: SESSION_DURATION_MS })
        res.json({
            id: user.id,
            username: user.username,
            adventures: adventures.map(a => ({ id: a.adventure.id, nome: a.adventure.nome, role: a.role }))
        })
    } catch (e) {
        next(e)
    }
})

// Logout — deleta sessão do banco e limpa o cookie
router.post('/logout', async (req, res, next) => {
    const token = req.cookies?.session

    if (token) {
        try {
            await prisma.session.deleteMany({ where: { token } })
        } catch (_) { /* sessão pode já não existir */ }
        logger.info('logout: sessão encerrada', { ip: req.ip })
    }

    res.clearCookie('session', cookieOptions)
    res.status(204).end()
})

// Me — retorna o usuário da sessão ativa com suas aventuras
router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        const adventures = await prisma.adventureUser.findMany({
            where: { userId: req.user.id },
            include: { adventure: true }
        })

        const adventureId = Number(req.cookies?.adventure)
        let currentAdventure = null
        if (adventureId) {
            const membership = adventures.find(a => a.adventureId === adventureId)
            if (membership) {
                currentAdventure = { id: membership.adventure.id, nome: membership.adventure.nome, role: membership.role }
            }
        }

        res.json({
            id: req.user.id,
            username: req.user.username,
            adventures: adventures.map(a => ({ id: a.adventure.id, nome: a.adventure.nome, role: a.role })),
            currentAdventure
        })
    } catch (e) { next(e) }
})

export default router

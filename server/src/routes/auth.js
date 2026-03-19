import express from 'express'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import logger from '../logger.js'
import authMiddleware from '../middleware/auth.js'

const router = express.Router()
const prisma = new PrismaClient()

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

        logger.info('login: sessão criada', { username, ip: req.ip })
        res.cookie('session', token, { ...cookieOptions, maxAge: SESSION_DURATION_MS })
        res.json({ id: user.id, username: user.username })
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

// Me — retorna o usuário da sessão ativa (usado pelo client no carregamento)
router.get('/me', authMiddleware, (req, res) => {
    res.json({ id: req.user.id, username: req.user.username })
})

export default router

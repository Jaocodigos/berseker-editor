import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import logger from '../logger.js'

const prisma = new PrismaClient()

async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Basic ')) {
        logger.warn('auth: header ausente ou invalido', { path: req.originalUrl, ip: req.ip })
        return res.status(401).json({ error: 'Autenticação necessária' })
    }

    const base64 = authHeader.slice(6)
    const decoded = Buffer.from(base64, 'base64').toString('utf8')
    const colonIndex = decoded.indexOf(':')

    if (colonIndex === -1) {
        logger.warn('auth: formato de credencial invalido', { ip: req.ip })
        return res.status(401).json({ error: 'Formato de credenciais inválido' })
    }

    const username = decoded.slice(0, colonIndex)
    const password = decoded.slice(colonIndex + 1)

    try {
        const user = await prisma.user.findUnique({ where: { username } })

        if (!user) {
            logger.warn('auth: usuario nao encontrado', { username, ip: req.ip })
            return res.status(401).json({ error: 'Credenciais inválidas' })
        }

        const valid = await bcrypt.compare(password, user.passwordHash)

        if (!valid) {
            logger.warn('auth: senha incorreta', { username, ip: req.ip })
            return res.status(401).json({ error: 'Credenciais inválidas' })
        }

        logger.debug('auth: autenticado', { username, ip: req.ip })
        req.user = { id: user.id, username: user.username }
        next()
    } catch (e) {
        next(e)
    }
}

export default authMiddleware

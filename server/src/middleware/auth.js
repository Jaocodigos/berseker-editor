import { PrismaClient } from '@prisma/client'
import logger from '../logger.js'

const prisma = new PrismaClient()

async function authMiddleware(req, res, next) {
    const token = req.cookies?.session

    if (!token) {
        logger.warn('auth: cookie de sessão ausente', { path: req.originalUrl, ip: req.ip })
        return res.status(401).json({ error: 'Autenticação necessária' })
    }

    try {
        const session = await prisma.session.findUnique({
            where: { token },
            include: { user: true },
        })

        if (!session) {
            logger.warn('auth: sessão não encontrada', { ip: req.ip })
            return res.status(401).json({ error: 'Sessão inválida' })
        }

        if (session.expiresAt < new Date()) {
            logger.warn('auth: sessão expirada', { userId: session.userId, ip: req.ip })
            await prisma.session.delete({ where: { token } })
            return res.status(401).json({ error: 'Sessão expirada' })
        }

        logger.debug('auth: autenticado via sessão', { username: session.user.username, ip: req.ip })
        req.user = { id: session.user.id, username: session.user.username }
        next()
    } catch (e) {
        next(e)
    }
}

export default authMiddleware

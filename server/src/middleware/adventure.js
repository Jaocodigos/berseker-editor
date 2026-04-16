import { PrismaClient } from '@prisma/client'
import logger from '../logger.js'

const prisma = new PrismaClient()

async function adventureMiddleware(req, res, next) {
    const adventureId = Number(req.cookies?.adventure)

    if (!adventureId) {
        return res.status(400).json({ error: 'Nenhuma aventura selecionada' })
    }

    try {
        const membership = await prisma.adventureUser.findUnique({
            where: { userId_adventureId: { userId: req.user.id, adventureId } },
            include: { adventure: true }
        })

        if (!membership) {
            logger.warn('adventure: usuario nao pertence a aventura', { userId: req.user.id, adventureId, path: req.originalUrl })
            return res.status(403).json({ error: 'Voce nao pertence a esta aventura' })
        }

        req.adventure = membership.adventure
        req.adventureRole = membership.role
        next()
    } catch (e) {
        next(e)
    }
}

export default adventureMiddleware

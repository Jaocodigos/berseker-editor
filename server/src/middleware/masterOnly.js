import logger from '../logger.js'

function masterOnly(req, res, next) {
    if (req.adventureRole !== 'master') {
        logger.warn('masterOnly: acesso negado', { userId: req.user?.id, adventureId: req.adventure?.id, path: req.originalUrl, ip: req.ip })
        return res.status(403).json({ error: 'Acesso restrito ao mestre' })
    }
    next()
}

export default masterOnly

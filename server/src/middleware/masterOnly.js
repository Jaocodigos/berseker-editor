import logger from '../logger.js'

function masterOnly(req, res, next) {
    if (req.user?.role !== 'master') {
        logger.warn('masterOnly: acesso negado', { userId: req.user?.id, path: req.originalUrl, ip: req.ip })
        return res.status(403).json({ error: 'Acesso restrito ao mestre' })
    }
    next()
}

export default masterOnly

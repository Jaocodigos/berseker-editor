import logger from '../logger.js'

function adminAuthMiddleware(req, res, next) {
    const adminToken = process.env.ADMIN_TOKEN
    const authHeader = req.headers.authorization

    if (!adminToken) {
        logger.error('admin: ADMIN_TOKEN nao configurado', { path: req.originalUrl })
        return res.status(500).json({ error: 'ADMIN_TOKEN não configurado no servidor' })
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('admin: acesso negado — header Authorization ausente ou formato invalido', { path: req.originalUrl, ip: req.ip })
        return res.status(403).json({ error: 'Acesso restrito ao administrador' })
    }

    const provided = authHeader.slice(7)

    if (provided !== adminToken) {
        logger.warn('admin: acesso negado — token invalido', { path: req.originalUrl, ip: req.ip })
        return res.status(403).json({ error: 'Acesso restrito ao administrador' })
    }

    logger.debug('admin: acesso concedido', { path: req.originalUrl, ip: req.ip })
    next()
}

export default adminAuthMiddleware

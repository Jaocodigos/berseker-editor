import express from 'express'
import authMiddleware from '../middleware/auth.js'

const router = express.Router()

// Login — valida credenciais e retorna dados do usuário
router.post('/login', authMiddleware, (req, res) => {
    res.json({ id: req.user.id, username: req.user.username })
})

export default router

import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        session: { findUnique: vi.fn(), delete: vi.fn() },
    },
}))

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }))

import authMiddleware from '../../middleware/auth.js'

const testApp = express()
testApp.use(cookieParser())
testApp.get('/test', authMiddleware, (req, res) => res.json({ user: req.user }))

const VALID_TOKEN = 'valid-token-uuid'
const validSession = {
    token: VALID_TOKEN,
    userId: 1,
    expiresAt: new Date(Date.now() + 3_600_000),
    user: { id: 1, username: 'user' },
}

describe('authMiddleware', () => {
    beforeEach(() => vi.clearAllMocks())

    it('retorna 401 sem cookie de sessão', async () => {
        const res = await request(testApp).get('/test')
        expect(res.status).toBe(401)
        expect(res.body.error).toBe('Autenticação necessária')
    })

    it('retorna 401 com token não encontrado no banco', async () => {
        mockPrisma.session.findUnique.mockResolvedValue(null)
        const res = await request(testApp).get('/test').set('Cookie', 'session=token-invalido')
        expect(res.status).toBe(401)
        expect(res.body.error).toBe('Sessão inválida')
    })

    it('retorna 401 e deleta sessão expirada', async () => {
        mockPrisma.session.findUnique.mockResolvedValue({
            ...validSession,
            expiresAt: new Date(Date.now() - 1000),
        })
        mockPrisma.session.delete.mockResolvedValue({})
        const res = await request(testApp).get('/test').set('Cookie', `session=${VALID_TOKEN}`)
        expect(res.status).toBe(401)
        expect(res.body.error).toBe('Sessão expirada')
        expect(mockPrisma.session.delete).toHaveBeenCalledWith({ where: { token: VALID_TOKEN } })
    })

    it('autoriza sessão válida e passa req.user', async () => {
        mockPrisma.session.findUnique.mockResolvedValue(validSession)
        const res = await request(testApp).get('/test').set('Cookie', `session=${VALID_TOKEN}`)
        expect(res.status).toBe(200)
        expect(res.body.user).toEqual({ id: 1, username: 'user' })
    })

    it('busca a sessão pelo token correto', async () => {
        mockPrisma.session.findUnique.mockResolvedValue(validSession)
        await request(testApp).get('/test').set('Cookie', `session=${VALID_TOKEN}`)
        expect(mockPrisma.session.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({ where: { token: VALID_TOKEN } })
        )
    })
})

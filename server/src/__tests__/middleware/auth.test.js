import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'

const { mockPrisma, mockBcrypt } = vi.hoisted(() => ({
    mockPrisma: {
        user: { findUnique: vi.fn() },
    },
    mockBcrypt: { compare: vi.fn(), hash: vi.fn() },
}))

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }))
vi.mock('bcryptjs', () => ({ default: mockBcrypt }))

import authMiddleware from '../../middleware/auth.js'

const testApp = express()
testApp.use(express.json())
testApp.get('/test', authMiddleware, (req, res) => res.json({ user: req.user }))

describe('authMiddleware', () => {
    beforeEach(() => vi.clearAllMocks())

    it('retorna 401 sem header Authorization', async () => {
        const res = await request(testApp).get('/test')
        expect(res.status).toBe(401)
        expect(res.body.error).toBe('Autenticação necessária')
    })

    it('retorna 401 sem prefixo Basic', async () => {
        const res = await request(testApp)
            .get('/test')
            .set('Authorization', 'Bearer token123')
        expect(res.status).toBe(401)
    })

    it('retorna 401 com credencial sem dois-pontos', async () => {
        const encoded = Buffer.from('semcolondoisponto').toString('base64')
        const res = await request(testApp)
            .get('/test')
            .set('Authorization', `Basic ${encoded}`)
        expect(res.status).toBe(401)
        expect(res.body.error).toBe('Formato de credenciais inválido')
    })

    it('retorna 401 quando usuário não existe', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null)
        const encoded = Buffer.from('inexistente:pass').toString('base64')
        const res = await request(testApp)
            .get('/test')
            .set('Authorization', `Basic ${encoded}`)
        expect(res.status).toBe(401)
        expect(res.body.error).toBe('Credenciais inválidas')
    })

    it('retorna 401 com senha incorreta', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ id: 1, username: 'user', passwordHash: 'hash' })
        mockBcrypt.compare.mockResolvedValue(false)
        const encoded = Buffer.from('user:errada').toString('base64')
        const res = await request(testApp)
            .get('/test')
            .set('Authorization', `Basic ${encoded}`)
        expect(res.status).toBe(401)
        expect(res.body.error).toBe('Credenciais inválidas')
    })

    it('autoriza com credenciais válidas e passa req.user', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ id: 1, username: 'user', passwordHash: 'hash' })
        mockBcrypt.compare.mockResolvedValue(true)
        const encoded = Buffer.from('user:correta').toString('base64')
        const res = await request(testApp)
            .get('/test')
            .set('Authorization', `Basic ${encoded}`)
        expect(res.status).toBe(200)
        expect(res.body.user).toEqual({ id: 1, username: 'user' })
    })

    it('consulta o usuário correto no banco', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ id: 2, username: 'alice', passwordHash: 'h' })
        mockBcrypt.compare.mockResolvedValue(true)
        const encoded = Buffer.from('alice:pw').toString('base64')
        await request(testApp).get('/test').set('Authorization', `Basic ${encoded}`)
        expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { username: 'alice' } })
    })
})

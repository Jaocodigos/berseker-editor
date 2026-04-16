import { describe, it, expect, vi, beforeEach } from 'vitest'
import express from 'express'
import cookieParser from 'cookie-parser'
import request from 'supertest'

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        adventureUser: { findUnique: vi.fn() },
    },
}))

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }))

import adventureMiddleware from '../../middleware/adventure.js'

const app = express()
app.use(cookieParser())
app.use((req, _res, next) => { req.user = { id: 1, username: 'user' }; next() })
app.get('/protected', adventureMiddleware, (req, res) => {
    res.json({ adventure: req.adventure, role: req.adventureRole })
})

describe('adventureMiddleware', () => {
    beforeEach(() => vi.clearAllMocks())

    it('retorna 400 sem cookie de aventura', async () => {
        const res = await request(app).get('/protected')
        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/aventura/i)
    })

    it('retorna 403 quando usuário não pertence à aventura', async () => {
        mockPrisma.adventureUser.findUnique.mockResolvedValue(null)
        const res = await request(app).get('/protected').set('Cookie', 'adventure=99')
        expect(res.status).toBe(403)
    })

    it('passa req.adventure e req.adventureRole quando válido', async () => {
        mockPrisma.adventureUser.findUnique.mockResolvedValue({
            userId: 1, adventureId: 7, role: 'master',
            adventure: { id: 7, nome: 'main' },
        })
        const res = await request(app).get('/protected').set('Cookie', 'adventure=7')
        expect(res.status).toBe(200)
        expect(res.body.adventure).toEqual({ id: 7, nome: 'main' })
        expect(res.body.role).toBe('master')
    })

    it('busca membership pela chave composta userId+adventureId', async () => {
        mockPrisma.adventureUser.findUnique.mockResolvedValue({
            userId: 1, adventureId: 7, role: 'player',
            adventure: { id: 7, nome: 'main' },
        })
        await request(app).get('/protected').set('Cookie', 'adventure=7')
        expect(mockPrisma.adventureUser.findUnique).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { userId_adventureId: { userId: 1, adventureId: 7 } },
            })
        )
    })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        session: { findUnique: vi.fn() },
        character: { findMany: vi.fn(), findUnique: vi.fn() },
        pillar: { update: vi.fn() },
        ability: { findMany: vi.fn() },
        adventureUser: { findUnique: vi.fn(), findMany: vi.fn() },
    },
}))

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }))

import { app } from '../../index.js'

const VALID_TOKEN = 'sess'
const withAuth = (req) => req.set('Cookie', `session=${VALID_TOKEN}`)

describe('Adventure selection endpoints', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockPrisma.session.findUnique.mockResolvedValue({
            token: VALID_TOKEN, userId: 1,
            expiresAt: new Date(Date.now() + 3_600_000),
            user: { id: 1, username: 'user' },
        })
    })

    describe('POST /api/adventures/:id/select', () => {
        it('retorna 401 sem sessão', async () => {
            const res = await request(app).post('/api/adventures/1/select')
            expect(res.status).toBe(401)
        })

        it('retorna 403 quando usuário não pertence à aventura', async () => {
            mockPrisma.adventureUser.findUnique.mockResolvedValue(null)
            const res = await withAuth(request(app).post('/api/adventures/1/select'))
            expect(res.status).toBe(403)
        })

        it('seta cookie adventure e retorna dados', async () => {
            mockPrisma.adventureUser.findUnique.mockResolvedValue({
                userId: 1, adventureId: 7, role: 'master',
                adventure: { id: 7, nome: 'main' },
            })
            const res = await withAuth(request(app).post('/api/adventures/7/select'))
            expect(res.status).toBe(200)
            expect(res.body).toEqual({ adventure: { id: 7, nome: 'main' }, role: 'master' })
            expect(res.headers['set-cookie']).toBeDefined()
            expect(res.headers['set-cookie'][0]).toMatch(/adventure=7/)
            expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/)
        })
    })

    describe('POST /api/adventures/deselect', () => {
        it('retorna 401 sem sessão', async () => {
            const res = await request(app).post('/api/adventures/deselect')
            expect(res.status).toBe(401)
        })

        it('limpa o cookie adventure e retorna 204', async () => {
            const res = await withAuth(request(app).post('/api/adventures/deselect'))
            expect(res.status).toBe(204)
            expect(res.headers['set-cookie']).toBeDefined()
            expect(res.headers['set-cookie'][0]).toMatch(/adventure=;/)
        })
    })
})

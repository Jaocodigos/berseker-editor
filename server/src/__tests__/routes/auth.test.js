import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const { mockPrisma, mockBcrypt } = vi.hoisted(() => ({
    mockPrisma: {
        user: { findUnique: vi.fn() },
        character: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        pillar: { update: vi.fn() },
        ability: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    },
    mockBcrypt: { compare: vi.fn(), hash: vi.fn() },
}))

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }))
vi.mock('bcryptjs', () => ({ default: mockBcrypt }))

import { app } from '../../index.js'

describe('POST /api/auth/login', () => {
    beforeEach(() => vi.clearAllMocks())

    it('retorna 401 com credenciais inválidas (usuário inexistente)', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null)
        const encoded = Buffer.from('user:wrong').toString('base64')
        const res = await request(app)
            .post('/api/auth/login')
            .set('Authorization', `Basic ${encoded}`)
        expect(res.status).toBe(401)
    })

    it('retorna 401 com senha errada', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ id: 1, username: 'admin', passwordHash: 'h' })
        mockBcrypt.compare.mockResolvedValue(false)
        const encoded = Buffer.from('admin:errada').toString('base64')
        const res = await request(app)
            .post('/api/auth/login')
            .set('Authorization', `Basic ${encoded}`)
        expect(res.status).toBe(401)
    })

    it('retorna 200 com dados do usuário em login válido', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ id: 1, username: 'admin', passwordHash: 'h' })
        mockBcrypt.compare.mockResolvedValue(true)
        const encoded = Buffer.from('admin:senha').toString('base64')
        const res = await request(app)
            .post('/api/auth/login')
            .set('Authorization', `Basic ${encoded}`)
        expect(res.status).toBe(200)
        expect(res.body).toEqual({ id: 1, username: 'admin' })
    })

    it('não expõe passwordHash na resposta', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ id: 1, username: 'admin', passwordHash: 'secret-hash' })
        mockBcrypt.compare.mockResolvedValue(true)
        const encoded = Buffer.from('admin:senha').toString('base64')
        const res = await request(app)
            .post('/api/auth/login')
            .set('Authorization', `Basic ${encoded}`)
        expect(res.body.passwordHash).toBeUndefined()
    })
})

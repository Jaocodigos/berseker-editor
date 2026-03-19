import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const { mockPrisma, mockBcrypt } = vi.hoisted(() => ({
    mockPrisma: {
        user: { findUnique: vi.fn() },
        session: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
        character: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        pillar: { update: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
        ability: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    },
    mockBcrypt: { compare: vi.fn(), hash: vi.fn() },
}))

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }))
vi.mock('bcryptjs', () => ({ default: mockBcrypt }))

import { app } from '../../index.js'

const VALID_TOKEN = 'session-uuid-test'
const validSession = {
    token: VALID_TOKEN,
    userId: 1,
    expiresAt: new Date(Date.now() + 3_600_000),
    user: { id: 1, username: 'admin' },
}

describe('POST /api/auth/login', () => {
    beforeEach(() => vi.clearAllMocks())

    it('retorna 400 sem body', async () => {
        const res = await request(app).post('/api/auth/login').send({})
        expect(res.status).toBe(400)
    })

    it('retorna 401 com usuário inexistente', async () => {
        mockPrisma.user.findUnique.mockResolvedValue(null)
        const res = await request(app).post('/api/auth/login').send({ username: 'x', password: 'y' })
        expect(res.status).toBe(401)
    })

    it('retorna 401 com senha errada', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ id: 1, username: 'admin', passwordHash: 'h' })
        mockBcrypt.compare.mockResolvedValue(false)
        const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'errada' })
        expect(res.status).toBe(401)
    })

    it('retorna 200, seta cookie e retorna dados do usuário', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ id: 1, username: 'admin', passwordHash: 'h' })
        mockBcrypt.compare.mockResolvedValue(true)
        mockPrisma.session.create.mockResolvedValue({})
        const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'senha' })
        expect(res.status).toBe(200)
        expect(res.body).toEqual({ id: 1, username: 'admin' })
        expect(res.headers['set-cookie']).toBeDefined()
        expect(res.headers['set-cookie'][0]).toMatch(/session=/)
        expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/)
    })

    it('não expõe passwordHash na resposta', async () => {
        mockPrisma.user.findUnique.mockResolvedValue({ id: 1, username: 'admin', passwordHash: 'secret' })
        mockBcrypt.compare.mockResolvedValue(true)
        mockPrisma.session.create.mockResolvedValue({})
        const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'senha' })
        expect(res.body.passwordHash).toBeUndefined()
    })
})

describe('POST /api/auth/logout', () => {
    beforeEach(() => vi.clearAllMocks())

    it('retorna 204 e limpa o cookie mesmo sem sessão ativa', async () => {
        const res = await request(app).post('/api/auth/logout')
        expect(res.status).toBe(204)
        expect(res.headers['set-cookie']).toBeDefined()
        expect(res.headers['set-cookie'][0]).toMatch(/session=;/)
    })

    it('deleta a sessão do banco ao fazer logout', async () => {
        mockPrisma.session.deleteMany.mockResolvedValue({})
        const res = await request(app)
            .post('/api/auth/logout')
            .set('Cookie', `session=${VALID_TOKEN}`)
        expect(res.status).toBe(204)
        expect(mockPrisma.session.deleteMany).toHaveBeenCalledWith({ where: { token: VALID_TOKEN } })
    })
})

describe('GET /api/auth/me', () => {
    beforeEach(() => vi.clearAllMocks())

    it('retorna 401 sem cookie', async () => {
        const res = await request(app).get('/api/auth/me')
        expect(res.status).toBe(401)
    })

    it('retorna dados do usuário com sessão válida', async () => {
        mockPrisma.session.findUnique.mockResolvedValue(validSession)
        const res = await request(app).get('/api/auth/me').set('Cookie', `session=${VALID_TOKEN}`)
        expect(res.status).toBe(200)
        expect(res.body).toEqual({ id: 1, username: 'admin' })
    })
})

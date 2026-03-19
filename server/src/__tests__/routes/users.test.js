import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'

const { mockPrisma, mockBcrypt } = vi.hoisted(() => ({
    mockPrisma: {
        user: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        character: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        pillar: { update: vi.fn() },
        ability: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    },
    mockBcrypt: { compare: vi.fn(), hash: vi.fn() },
}))

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }))
vi.mock('bcryptjs', () => ({ default: mockBcrypt }))

import { app } from '../../index.js'

const ADMIN_TOKEN = 'test-admin-token'
const withAdmin = (req) => req.set('X-Admin-Token', ADMIN_TOKEN)
const origToken = process.env.ADMIN_TOKEN

describe('Users Routes (/api/users)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.ADMIN_TOKEN = ADMIN_TOKEN
        mockBcrypt.hash.mockResolvedValue('hashed-pw')
    })

    afterEach(() => {
        process.env.ADMIN_TOKEN = origToken
    })

    describe('GET /api/users', () => {
        it('retorna 403 sem token admin', async () => {
            const res = await request(app).get('/api/users')
            expect(res.status).toBe(403)
        })

        it('retorna lista de usuários', async () => {
            const users = [{ id: 1, username: 'admin', createdAt: '2026-01-01T00:00:00.000Z' }]
            mockPrisma.user.findMany.mockResolvedValue(users)
            const res = await withAdmin(request(app).get('/api/users'))
            expect(res.status).toBe(200)
            expect(res.body).toEqual(users)
        })
    })

    describe('POST /api/users', () => {
        it('retorna 400 sem username ou password', async () => {
            const res = await withAdmin(request(app).post('/api/users').send({}))
            expect(res.status).toBe(400)
        })

        it('retorna 400 sem password', async () => {
            const res = await withAdmin(request(app).post('/api/users').send({ username: 'user' }))
            expect(res.status).toBe(400)
        })

        it('cria usuário e hasheia a senha com bcrypt', async () => {
            const created = { id: 1, username: 'novo', createdAt: '2026-01-01T00:00:00.000Z' }
            mockPrisma.user.create.mockResolvedValue(created)
            const res = await withAdmin(
                request(app).post('/api/users').send({ username: 'novo', password: 'senha123' })
            )
            expect(res.status).toBe(201)
            expect(mockBcrypt.hash).toHaveBeenCalledWith('senha123', 10)
            expect(res.body.username).toBe('novo')
            expect(res.body.passwordHash).toBeUndefined()
        })

        it('retorna 409 com username duplicado', async () => {
            const err = Object.assign(new Error('Unique constraint'), { code: 'P2002' })
            mockPrisma.user.create.mockRejectedValue(err)
            const res = await withAdmin(
                request(app).post('/api/users').send({ username: 'existente', password: '123' })
            )
            expect(res.status).toBe(409)
            expect(res.body.error).toBe('Username já existe')
        })
    })

    describe('PATCH /api/users/:id', () => {
        it('retorna 400 sem campos', async () => {
            const res = await withAdmin(request(app).patch('/api/users/1').send({}))
            expect(res.status).toBe(400)
        })

        it('atualiza username', async () => {
            const updated = { id: 1, username: 'novonome', createdAt: '2026-01-01T00:00:00.000Z' }
            mockPrisma.user.update.mockResolvedValue(updated)
            const res = await withAdmin(
                request(app).patch('/api/users/1').send({ username: 'novonome' })
            )
            expect(res.status).toBe(200)
            expect(res.body.username).toBe('novonome')
        })

        it('atualiza password com hash', async () => {
            mockPrisma.user.update.mockResolvedValue({ id: 1, username: 'user', createdAt: '2026-01-01T00:00:00.000Z' })
            await withAdmin(request(app).patch('/api/users/1').send({ password: 'novasenha' }))
            expect(mockBcrypt.hash).toHaveBeenCalledWith('novasenha', 10)
        })

        it('retorna 404 quando usuário não existe', async () => {
            const err = Object.assign(new Error('Not found'), { code: 'P2025' })
            mockPrisma.user.update.mockRejectedValue(err)
            const res = await withAdmin(
                request(app).patch('/api/users/999').send({ username: 'novo' })
            )
            expect(res.status).toBe(404)
        })
    })

    describe('DELETE /api/users/:id', () => {
        it('deleta e retorna 204', async () => {
            mockPrisma.user.delete.mockResolvedValue({})
            const res = await withAdmin(request(app).delete('/api/users/1'))
            expect(res.status).toBe(204)
        })

        it('retorna 404 quando usuário não existe', async () => {
            const err = Object.assign(new Error('Not found'), { code: 'P2025' })
            mockPrisma.user.delete.mockRejectedValue(err)
            const res = await withAdmin(request(app).delete('/api/users/999'))
            expect(res.status).toBe(404)
        })
    })
})

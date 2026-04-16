import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        session: { findUnique: vi.fn() },
        user: { findUnique: vi.fn(), findMany: vi.fn() },
        character: { findMany: vi.fn(), findUnique: vi.fn() },
        pillar: { update: vi.fn() },
        ability: { findMany: vi.fn() },
        adventure: {
            findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(),
            update: vi.fn(), delete: vi.fn(),
        },
        adventureUser: {
            findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(),
            update: vi.fn(), delete: vi.fn(),
        },
    },
}))

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }))

import { app } from '../../index.js'

const ADMIN_TOKEN = 'test-admin-token'
const withAdmin = (req) => req.set('Authorization', `Bearer ${ADMIN_TOKEN}`)
const origToken = process.env.ADMIN_TOKEN

describe('Adventures Routes (/api/adventures admin)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        process.env.ADMIN_TOKEN = ADMIN_TOKEN
    })
    afterEach(() => { process.env.ADMIN_TOKEN = origToken })

    describe('GET /api/adventures', () => {
        it('retorna 403 sem token admin', async () => {
            const res = await request(app).get('/api/adventures')
            expect(res.status).toBe(403)
        })

        it('retorna lista de aventuras', async () => {
            mockPrisma.adventure.findMany.mockResolvedValue([
                { id: 1, nome: 'main', _count: { users: 2, characters: 5 } },
            ])
            const res = await withAdmin(request(app).get('/api/adventures'))
            expect(res.status).toBe(200)
            expect(res.body).toHaveLength(1)
            expect(res.body[0].nome).toBe('main')
        })
    })

    describe('POST /api/adventures', () => {
        it('retorna 400 sem nome', async () => {
            const res = await withAdmin(request(app).post('/api/adventures').send({}))
            expect(res.status).toBe(400)
        })

        it('cria aventura', async () => {
            mockPrisma.adventure.create.mockResolvedValue({ id: 3, nome: 'Nova', createdAt: new Date() })
            const res = await withAdmin(request(app).post('/api/adventures').send({ nome: 'Nova' }))
            expect(res.status).toBe(201)
            expect(res.body.nome).toBe('Nova')
        })
    })

    describe('PATCH /api/adventures/:id', () => {
        it('retorna 404 quando aventura não existe', async () => {
            mockPrisma.adventure.update.mockRejectedValue(Object.assign(new Error('nf'), { code: 'P2025' }))
            const res = await withAdmin(request(app).patch('/api/adventures/99').send({ nome: 'X' }))
            expect(res.status).toBe(404)
        })

        it('atualiza nome', async () => {
            mockPrisma.adventure.update.mockResolvedValue({ id: 1, nome: 'Renamed' })
            const res = await withAdmin(request(app).patch('/api/adventures/1').send({ nome: 'Renamed' }))
            expect(res.status).toBe(200)
            expect(res.body.nome).toBe('Renamed')
        })
    })

    describe('DELETE /api/adventures/:id', () => {
        it('deleta aventura e retorna 204', async () => {
            mockPrisma.adventure.delete.mockResolvedValue({})
            const res = await withAdmin(request(app).delete('/api/adventures/1'))
            expect(res.status).toBe(204)
        })

        it('retorna 404 quando aventura não existe', async () => {
            mockPrisma.adventure.delete.mockRejectedValue(Object.assign(new Error('nf'), { code: 'P2025' }))
            const res = await withAdmin(request(app).delete('/api/adventures/999'))
            expect(res.status).toBe(404)
        })
    })

    describe('Memberships', () => {
        beforeEach(() => {
            mockPrisma.adventure.findUnique.mockResolvedValue({ id: 1, nome: 'main' })
            mockPrisma.user.findUnique.mockResolvedValue({ id: 1, username: 'user' })
        })

        it('GET lista membros', async () => {
            mockPrisma.adventureUser.findMany.mockResolvedValue([
                { role: 'master', user: { id: 1, username: 'user', createdAt: new Date() } },
            ])
            const res = await withAdmin(request(app).get('/api/adventures/1/users'))
            expect(res.status).toBe(200)
            expect(res.body[0]).toMatchObject({ id: 1, username: 'user', role: 'master' })
        })

        it('POST retorna 400 sem userId', async () => {
            const res = await withAdmin(request(app).post('/api/adventures/1/users').send({}))
            expect(res.status).toBe(400)
        })

        it('POST retorna 400 com role inválido', async () => {
            const res = await withAdmin(
                request(app).post('/api/adventures/1/users').send({ userId: 1, role: 'boss' })
            )
            expect(res.status).toBe(400)
        })

        it('POST adiciona usuário à aventura', async () => {
            mockPrisma.adventureUser.create.mockResolvedValue({ id: 1, userId: 1, adventureId: 1, role: 'master' })
            const res = await withAdmin(
                request(app).post('/api/adventures/1/users').send({ userId: 1, role: 'master' })
            )
            expect(res.status).toBe(201)
            expect(res.body).toMatchObject({ id: 1, username: 'user', role: 'master' })
        })

        it('POST retorna 409 quando usuário já está na aventura', async () => {
            mockPrisma.adventureUser.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))
            const res = await withAdmin(
                request(app).post('/api/adventures/1/users').send({ userId: 1, role: 'player' })
            )
            expect(res.status).toBe(409)
        })

        it('PATCH atualiza role', async () => {
            mockPrisma.adventureUser.findUnique.mockResolvedValue({ userId: 1, adventureId: 1, role: 'player' })
            mockPrisma.adventureUser.update.mockResolvedValue({ userId: 1, adventureId: 1, role: 'master' })
            const res = await withAdmin(
                request(app).patch('/api/adventures/1/users/1').send({ role: 'master' })
            )
            expect(res.status).toBe(200)
            expect(res.body.role).toBe('master')
        })

        it('PATCH retorna 404 quando membership não existe', async () => {
            mockPrisma.adventureUser.findUnique.mockResolvedValue(null)
            const res = await withAdmin(
                request(app).patch('/api/adventures/1/users/1').send({ role: 'master' })
            )
            expect(res.status).toBe(404)
        })

        it('DELETE remove usuário da aventura', async () => {
            mockPrisma.adventureUser.delete.mockResolvedValue({})
            const res = await withAdmin(request(app).delete('/api/adventures/1/users/1'))
            expect(res.status).toBe(204)
        })
    })
})

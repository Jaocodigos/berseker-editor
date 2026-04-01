import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        session: { findUnique: vi.fn(), delete: vi.fn() },
        character: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        pillar: { update: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
        ability: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    },
}))

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }))

import { app } from '../../index.js'

describe('GET /api/health', () => {
    it('retorna 200 com { ok: true }', async () => {
        const res = await request(app).get('/api/health')
        expect(res.status).toBe(200)
        expect(res.body).toEqual({ ok: true })
    })
})

describe('POST /api/logs', () => {
    it('retorna 204 com log válido', async () => {
        const res = await request(app)
            .post('/api/logs')
            .send({ level: 'info', message: 'test log', data: { foo: 'bar' } })
        expect(res.status).toBe(204)
    })

    it('retorna 204 com nível inválido (usa info como fallback)', async () => {
        const res = await request(app)
            .post('/api/logs')
            .send({ level: 'invalid', message: 'test' })
        expect(res.status).toBe(204)
    })

    it('retorna 204 sem body', async () => {
        const res = await request(app)
            .post('/api/logs')
            .send({})
        expect(res.status).toBe(204)
    })
})

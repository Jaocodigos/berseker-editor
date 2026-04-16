import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        session: { findUnique: vi.fn(), delete: vi.fn() },
        character: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        pillar: { update: vi.fn() },
        ability: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        adventureUser: { findUnique: vi.fn() },
    },
}))

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }))

import { app } from '../../index.js'
import { saveRoll, clearAll } from '../../store/diceRolls.js'

const VALID_TOKEN = 'test-session-token'
const ADV_ID = 7
const withAuth = (req) => req.set('Cookie', [`session=${VALID_TOKEN}`, `adventure=${ADV_ID}`])

describe('GET /api/adventure/dice-rolls', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        clearAll()
        mockPrisma.session.findUnique.mockResolvedValue({
            token: VALID_TOKEN,
            userId: 1,
            expiresAt: new Date(Date.now() + 3_600_000),
            user: { id: 1, username: 'user' },
        })
        mockPrisma.adventureUser.findUnique.mockResolvedValue({
            userId: 1, adventureId: ADV_ID, role: 'player', adventure: { id: ADV_ID, nome: 'main' },
        })
    })

    it('retorna objeto vazio sem characterIds', async () => {
        const res = await withAuth(
            request(app).get('/api/adventure/dice-rolls')
        )
        expect(res.status).toBe(200)
        expect(res.body).toEqual({})
    })

    it('retorna objeto vazio quando nenhum personagem tem rolagem', async () => {
        const res = await withAuth(
            request(app).get('/api/adventure/dice-rolls?characterIds=1,2,3')
        )
        expect(res.status).toBe(200)
        expect(res.body).toEqual({})
    })

    it('retorna rolagens recentes dos personagens solicitados', async () => {
        const rollData = { abilityName: 'Fireball', notation: '2d6+3', rolls: [4, 2], modifier: 3, total: 9 }
        saveRoll(1, rollData)

        const res = await withAuth(
            request(app).get('/api/adventure/dice-rolls?characterIds=1,2')
        )
        expect(res.status).toBe(200)
        expect(res.body['1']).toMatchObject(rollData)
        expect(res.body['2']).toBeUndefined()
    })

    it('nao retorna rolagens de personagens nao solicitados', async () => {
        saveRoll(5, { abilityName: 'A', notation: '1d6', rolls: [3], modifier: 0, total: 3 })

        const res = await withAuth(
            request(app).get('/api/adventure/dice-rolls?characterIds=1,2')
        )
        expect(res.status).toBe(200)
        expect(res.body).toEqual({})
    })
})

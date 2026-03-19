import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        session: { findUnique: vi.fn(), delete: vi.fn() },
        character: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        pillar: { update: vi.fn() },
        ability: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    },
}))

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }))

import { app } from '../../index.js'

const VALID_TOKEN = 'test-session-token'
const withAuth = (req) => req.set('Cookie', `session=${VALID_TOKEN}`)

describe('POST /api/characters/:id/rest', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockPrisma.session.findUnique.mockResolvedValue({
            token: VALID_TOKEN,
            userId: 1,
            expiresAt: new Date(Date.now() + 3_600_000),
            user: { id: 1, username: 'user' },
        })
    })

    it('retorna 400 com type inválido', async () => {
        const res = await withAuth(
            request(app).post('/api/characters/1/rest').send({ type: 'ultra' })
        )
        expect(res.status).toBe(400)
        expect(res.body.error).toBe('type deve ser "short" ou "long"')
    })

    it('retorna 404 quando personagem não existe', async () => {
        mockPrisma.character.findUnique.mockResolvedValue(null)
        const res = await withAuth(
            request(app).post('/api/characters/1/rest').send({ type: 'long' })
        )
        expect(res.status).toBe(404)
    })

    describe('descanso longo', () => {
        it('restaura HP ao máximo', async () => {
            mockPrisma.character.findUnique.mockResolvedValue({
                id: 1, maxHp: 100, actualHp: 30, pillars: [],
            })
            mockPrisma.character.update.mockResolvedValue({ id: 1, actualHp: 100 })

            await withAuth(request(app).post('/api/characters/1/rest').send({ type: 'long' }))

            expect(mockPrisma.character.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { actualHp: 100 },
            })
        })

        it('restaura mana de todos os pillars ao máximo', async () => {
            mockPrisma.character.findUnique.mockResolvedValue({
                id: 1, maxHp: 100, actualHp: 30,
                pillars: [
                    { id: 1, maxMana: 20, actualMana: 5 },
                    { id: 2, maxMana: 10, actualMana: 2 },
                ],
            })
            mockPrisma.character.update.mockResolvedValue({ id: 1, actualHp: 100 })
            mockPrisma.pillar.update
                .mockResolvedValueOnce({ id: 1, actualMana: 20 })
                .mockResolvedValueOnce({ id: 2, actualMana: 10 })

            const res = await withAuth(
                request(app).post('/api/characters/1/rest').send({ type: 'long' })
            )
            expect(res.status).toBe(200)
            expect(mockPrisma.pillar.update).toHaveBeenCalledWith({
                where: { id: 1 }, data: { actualMana: 20 },
            })
            expect(mockPrisma.pillar.update).toHaveBeenCalledWith({
                where: { id: 2 }, data: { actualMana: 10 },
            })
        })
    })

    describe('descanso curto', () => {
        it('adiciona 50% do maxHp ao HP atual', async () => {
            // 30 + floor(100/2) = 30 + 50 = 80
            mockPrisma.character.findUnique.mockResolvedValue({
                id: 1, maxHp: 100, actualHp: 30, pillars: [],
            })
            mockPrisma.character.update.mockResolvedValue({ id: 1, actualHp: 80 })

            await withAuth(request(app).post('/api/characters/1/rest').send({ type: 'short' }))

            expect(mockPrisma.character.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { actualHp: 80 },
            })
        })

        it('não ultrapassa o HP máximo', async () => {
            // 90 + floor(100/2) = 90 + 50 = 140 → capped at 100
            mockPrisma.character.findUnique.mockResolvedValue({
                id: 1, maxHp: 100, actualHp: 90, pillars: [],
            })
            mockPrisma.character.update.mockResolvedValue({ id: 1, actualHp: 100 })

            await withAuth(request(app).post('/api/characters/1/rest').send({ type: 'short' }))

            expect(mockPrisma.character.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { actualHp: 100 },
            })
        })

        it('adiciona 50% da maxMana ao mana atual do pillar', async () => {
            // 6 + floor(20/2) = 6 + 10 = 16
            mockPrisma.character.findUnique.mockResolvedValue({
                id: 1, maxHp: 100, actualHp: 50,
                pillars: [{ id: 1, maxMana: 20, actualMana: 6 }],
            })
            mockPrisma.character.update.mockResolvedValue({ id: 1, actualHp: 100 })
            mockPrisma.pillar.update.mockResolvedValue({ id: 1, actualMana: 16 })

            await withAuth(request(app).post('/api/characters/1/rest').send({ type: 'short' }))

            expect(mockPrisma.pillar.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { actualMana: 16 },
            })
        })

        it('não ultrapassa a maxMana no descanso curto', async () => {
            // 18 + floor(20/2) = 18 + 10 = 28 → capped at 20
            mockPrisma.character.findUnique.mockResolvedValue({
                id: 1, maxHp: 100, actualHp: 50,
                pillars: [{ id: 1, maxMana: 20, actualMana: 18 }],
            })
            mockPrisma.character.update.mockResolvedValue({ id: 1, actualHp: 100 })
            mockPrisma.pillar.update.mockResolvedValue({ id: 1, actualMana: 20 })

            await withAuth(request(app).post('/api/characters/1/rest').send({ type: 'short' }))

            expect(mockPrisma.pillar.update).toHaveBeenCalledWith({
                where: { id: 1 },
                data: { actualMana: 20 },
            })
        })
    })
})

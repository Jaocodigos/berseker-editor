import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        session: { findUnique: vi.fn(), delete: vi.fn() },
        character: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        pillar: { update: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn() },
        ability: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
        adventureUser: { findUnique: vi.fn() },
    },
}))

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }))

import { app } from '../../index.js'

const PLAYER_TOKEN = 'player-token'
const MASTER_TOKEN = 'master-token'
const ADV_ID = 7
const withPlayer = (req) => req.set('Cookie', [`session=${PLAYER_TOKEN}`, `adventure=${ADV_ID}`])
const withMaster = (req) => req.set('Cookie', [`session=${MASTER_TOKEN}`, `adventure=${ADV_ID}`])

describe('Adventure Enemies Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockPrisma.session.findUnique.mockImplementation(({ where }) => {
            if (where.token === PLAYER_TOKEN) {
                return Promise.resolve({
                    token: PLAYER_TOKEN, userId: 1,
                    expiresAt: new Date(Date.now() + 3_600_000),
                    user: { id: 1, username: 'player' },
                })
            }
            if (where.token === MASTER_TOKEN) {
                return Promise.resolve({
                    token: MASTER_TOKEN, userId: 2,
                    expiresAt: new Date(Date.now() + 3_600_000),
                    user: { id: 2, username: 'master' },
                })
            }
            return Promise.resolve(null)
        })
        mockPrisma.adventureUser.findUnique.mockImplementation(({ where }) => {
            const { userId } = where.userId_adventureId
            const role = userId === 2 ? 'master' : 'player'
            return Promise.resolve({ userId, adventureId: ADV_ID, role, adventure: { id: ADV_ID, nome: 'main' } })
        })
    })

    describe('GET /api/adventure/enemies', () => {
        it('master recebe dados completos filtrados pela aventura', async () => {
            const enemies = [{ id: 1, nome: 'Goblin', maxHp: 30, actualHp: 30, adventureId: ADV_ID, pillars: [] }]
            mockPrisma.character.findMany.mockResolvedValue(enemies)
            const res = await withMaster(request(app).get('/api/adventure/enemies'))
            expect(res.status).toBe(200)
            expect(res.body).toEqual(enemies)
            expect(mockPrisma.character.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { type: 'enemy', inAdventure: true, adventureId: ADV_ID },
                    include: { pillars: { include: { abilities: true } } },
                })
            )
        })

        it('player recebe apenas id e nome filtrados pela aventura', async () => {
            const enemies = [{ id: 1, nome: 'Goblin' }]
            mockPrisma.character.findMany.mockResolvedValue(enemies)
            const res = await withPlayer(request(app).get('/api/adventure/enemies'))
            expect(res.status).toBe(200)
            expect(res.body).toEqual(enemies)
            expect(mockPrisma.character.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { type: 'enemy', inAdventure: true, adventureId: ADV_ID },
                    select: { id: true, nome: true },
                })
            )
        })
    })

    describe('POST /api/characters/:id/join-adventure', () => {
        it('player recebe 403', async () => {
            const res = await withPlayer(request(app).post('/api/characters/1/join-adventure'))
            expect(res.status).toBe(403)
        })

        it('retorna 404 quando personagem nao existe', async () => {
            mockPrisma.character.findUnique.mockResolvedValue(null)
            const res = await withMaster(request(app).post('/api/characters/999/join-adventure'))
            expect(res.status).toBe(404)
        })

        it('retorna 404 quando personagem pertence a outra aventura', async () => {
            mockPrisma.character.findUnique.mockResolvedValue({ id: 5, type: 'enemy', adventureId: 999 })
            const res = await withMaster(request(app).post('/api/characters/5/join-adventure'))
            expect(res.status).toBe(404)
        })

        it('retorna 400 para personagem que nao e inimigo', async () => {
            mockPrisma.character.findUnique.mockResolvedValue({ id: 1, type: 'player_character', adventureId: ADV_ID })
            const res = await withMaster(request(app).post('/api/characters/1/join-adventure'))
            expect(res.status).toBe(400)
        })

        it('master coloca inimigo na aventura', async () => {
            mockPrisma.character.findUnique.mockResolvedValue({ id: 5, type: 'enemy', nome: 'Orc', adventureId: ADV_ID })
            mockPrisma.character.update.mockResolvedValue({ id: 5, nome: 'Orc', inAdventure: true, pillars: [] })
            const res = await withMaster(request(app).post('/api/characters/5/join-adventure'))
            expect(res.status).toBe(200)
            expect(mockPrisma.character.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 5 },
                    data: { inAdventure: true },
                })
            )
        })
    })

    describe('POST /api/characters/:id/leave-adventure', () => {
        it('player recebe 403', async () => {
            const res = await withPlayer(request(app).post('/api/characters/1/leave-adventure'))
            expect(res.status).toBe(403)
        })

        it('master remove inimigo da aventura', async () => {
            mockPrisma.character.findUnique.mockResolvedValue({ id: 5, type: 'enemy', nome: 'Orc', adventureId: ADV_ID })
            mockPrisma.character.update.mockResolvedValue({ id: 5, nome: 'Orc', inAdventure: false })
            const res = await withMaster(request(app).post('/api/characters/5/leave-adventure'))
            expect(res.status).toBe(200)
            expect(mockPrisma.character.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 5 },
                    data: { inAdventure: false },
                })
            )
        })
    })
})

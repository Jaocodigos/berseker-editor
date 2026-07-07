import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        session: { findUnique: vi.fn() },
        adventureUser: { findUnique: vi.fn() },
        token: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
    },
}))

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }))

import { app } from '../../index.js'

const PLAYER_TOKEN = 'player-token'
const MASTER_TOKEN = 'master-token'
const ADV_ID = 7
const withPlayer = (req) => req.set('Cookie', [`session=${PLAYER_TOKEN}`, `adventure=${ADV_ID}`])
const withMaster = (req) => req.set('Cookie', [`session=${MASTER_TOKEN}`, `adventure=${ADV_ID}`])

const playerSession = { token: PLAYER_TOKEN, userId: 1, expiresAt: new Date(Date.now() + 3_600_000), user: { id: 1, username: 'player' } }
const masterSession = { token: MASTER_TOKEN, userId: 2, expiresAt: new Date(Date.now() + 3_600_000), user: { id: 2, username: 'master' } }

const mapInAdv = { id: 1, adventureId: ADV_ID, gridWidth: 20, gridHeight: 15 }

describe('Tokens Routes (/api/tokens)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockPrisma.session.findUnique.mockImplementation(({ where }) => {
            if (where.token === PLAYER_TOKEN) return Promise.resolve(playerSession)
            if (where.token === MASTER_TOKEN) return Promise.resolve(masterSession)
            return Promise.resolve(null)
        })
        mockPrisma.adventureUser.findUnique.mockImplementation(({ where }) => {
            const { userId } = where.userId_adventureId
            const role = userId === 2 ? 'master' : 'player'
            return Promise.resolve({ userId, adventureId: ADV_ID, role, adventure: { id: ADV_ID, nome: 'main' } })
        })
    })

    describe('PATCH /api/tokens/:id', () => {
        it('retorna 404 quando token pertence a outra aventura', async () => {
            mockPrisma.token.findUnique.mockResolvedValue({ id: 10, gameMapId: 1, gameMap: { ...mapInAdv, adventureId: 999 } })
            const res = await withPlayer(request(app).patch('/api/tokens/10').send({ posX: 1, posY: 1 }))
            expect(res.status).toBe(404)
        })

        it('retorna 400 sem posX/posY', async () => {
            mockPrisma.token.findUnique.mockResolvedValue({ id: 10, gameMapId: 1, gameMap: mapInAdv })
            const res = await withPlayer(request(app).patch('/api/tokens/10').send({ posX: 1 }))
            expect(res.status).toBe(400)
        })

        it('player pode mover token (posicao clampada)', async () => {
            mockPrisma.token.findUnique.mockResolvedValue({ id: 10, gameMapId: 1, gameMap: mapInAdv })
            mockPrisma.token.update.mockResolvedValue({ id: 10, posX: 19, posY: 14, character: { id: 5, nome: 'Hero', imageUrl: null } })
            const res = await withPlayer(request(app).patch('/api/tokens/10').send({ posX: 50, posY: 50 }))
            expect(res.status).toBe(200)
            expect(mockPrisma.token.update).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 10 }, data: { posX: 19, posY: 14 } })
            )
        })
    })

    describe('DELETE /api/tokens/:id', () => {
        it('player nao pode remover token', async () => {
            mockPrisma.token.findUnique.mockResolvedValue({ id: 10, gameMapId: 1, gameMap: mapInAdv })
            const res = await withPlayer(request(app).delete('/api/tokens/10'))
            expect(res.status).toBe(403)
        })

        it('retorna 404 quando token pertence a outra aventura', async () => {
            mockPrisma.token.findUnique.mockResolvedValue({ id: 10, gameMapId: 1, gameMap: { ...mapInAdv, adventureId: 999 } })
            const res = await withMaster(request(app).delete('/api/tokens/10'))
            expect(res.status).toBe(404)
        })

        it('master remove token e retorna 204', async () => {
            mockPrisma.token.findUnique.mockResolvedValue({ id: 10, gameMapId: 1, gameMap: mapInAdv })
            mockPrisma.token.delete.mockResolvedValue({})
            const res = await withMaster(request(app).delete('/api/tokens/10'))
            expect(res.status).toBe(204)
        })
    })
})

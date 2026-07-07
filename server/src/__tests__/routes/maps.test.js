import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        session: { findUnique: vi.fn() },
        adventureUser: { findUnique: vi.fn() },
        gameMap: {
            findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(),
            update: vi.fn(), delete: vi.fn(),
        },
        token: {
            findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(),
            create: vi.fn(), update: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(),
        },
        character: { findUnique: vi.fn() },
        $transaction: vi.fn(),
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

describe('Maps Routes (/api/maps)', () => {
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
        // Transacao: executa o callback passando o proprio mock como tx.
        mockPrisma.$transaction.mockImplementation((cb) => cb(mockPrisma))
    })

    describe('GET /api/maps', () => {
        it('retorna 401 sem autenticacao', async () => {
            const res = await request(app).get('/api/maps')
            expect(res.status).toBe(401)
        })

        it('retorna 400 sem aventura selecionada', async () => {
            const res = await request(app).get('/api/maps').set('Cookie', `session=${PLAYER_TOKEN}`)
            expect(res.status).toBe(400)
        })

        it('player lista mapas da aventura', async () => {
            mockPrisma.gameMap.findMany.mockResolvedValue([{ id: 1, nome: 'Arena', adventureId: ADV_ID }])
            const res = await withPlayer(request(app).get('/api/maps'))
            expect(res.status).toBe(200)
            expect(res.body).toHaveLength(1)
            expect(mockPrisma.gameMap.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { adventureId: ADV_ID } })
            )
        })
    })

    describe('GET /api/maps/:id', () => {
        it('retorna 404 quando mapa pertence a outra aventura', async () => {
            mockPrisma.gameMap.findUnique.mockResolvedValue({ id: 1, adventureId: 999, tokens: [] })
            const res = await withPlayer(request(app).get('/api/maps/1'))
            expect(res.status).toBe(404)
        })

        it('retorna mapa com tokens', async () => {
            mockPrisma.gameMap.findUnique.mockResolvedValue({
                id: 1, adventureId: ADV_ID, gridWidth: 20, gridHeight: 15,
                tokens: [{ id: 10, posX: 2, posY: 3, character: { id: 5, nome: 'Hero', imageUrl: null } }],
            })
            const res = await withPlayer(request(app).get('/api/maps/1'))
            expect(res.status).toBe(200)
            expect(res.body.tokens).toHaveLength(1)
        })
    })

    describe('POST /api/maps', () => {
        it('player nao pode criar mapa', async () => {
            const res = await withPlayer(request(app).post('/api/maps').send({ nome: 'Arena' }))
            expect(res.status).toBe(403)
        })

        it('retorna 400 sem nome', async () => {
            const res = await withMaster(request(app).post('/api/maps').send({ size: 'small' }))
            expect(res.status).toBe(400)
        })

        it('retorna 400 com size invalido', async () => {
            const res = await withMaster(request(app).post('/api/maps').send({ nome: 'X', size: 'huge' }))
            expect(res.status).toBe(400)
        })

        it('master cria mapa medium com dimensoes do preset', async () => {
            mockPrisma.gameMap.create.mockResolvedValue({ id: 3, nome: 'Arena', gridWidth: 20, gridHeight: 15, adventureId: ADV_ID })
            const res = await withMaster(request(app).post('/api/maps').send({ nome: 'Arena' }))
            expect(res.status).toBe(201)
            expect(mockPrisma.gameMap.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ nome: 'Arena', gridWidth: 20, gridHeight: 15, adventureId: ADV_ID }),
                })
            )
        })

        it('master cria mapa large com 30x20', async () => {
            mockPrisma.gameMap.create.mockResolvedValue({ id: 4, nome: 'Campo', gridWidth: 30, gridHeight: 20, adventureId: ADV_ID })
            const res = await withMaster(request(app).post('/api/maps').send({ nome: 'Campo', size: 'large' }))
            expect(res.status).toBe(201)
            expect(mockPrisma.gameMap.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ gridWidth: 30, gridHeight: 20 }) })
            )
        })

        it('master cria mapa com backgroundUrl', async () => {
            mockPrisma.gameMap.create.mockResolvedValue({ id: 5, nome: 'Cripta', gridWidth: 20, gridHeight: 15, backgroundUrl: '/uploads/maps/x.png', adventureId: ADV_ID })
            const res = await withMaster(request(app).post('/api/maps').send({ nome: 'Cripta', backgroundUrl: '/uploads/maps/x.png' }))
            expect(res.status).toBe(201)
            expect(mockPrisma.gameMap.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ backgroundUrl: '/uploads/maps/x.png' }) })
            )
        })
    })

    describe('PATCH /api/maps/:id', () => {
        it('player nao pode editar', async () => {
            const res = await withPlayer(request(app).patch('/api/maps/1').send({ nome: 'Novo' }))
            expect(res.status).toBe(403)
        })

        it('retorna 404 quando mapa e de outra aventura', async () => {
            mockPrisma.gameMap.findUnique.mockResolvedValue({ id: 1, adventureId: 999, gridWidth: 20, gridHeight: 15 })
            const res = await withMaster(request(app).patch('/api/maps/1').send({ nome: 'X' }))
            expect(res.status).toBe(404)
        })

        it('retorna 400 com size invalido', async () => {
            mockPrisma.gameMap.findUnique.mockResolvedValue({ id: 1, adventureId: ADV_ID, gridWidth: 20, gridHeight: 15 })
            const res = await withMaster(request(app).patch('/api/maps/1').send({ size: 'giant' }))
            expect(res.status).toBe(400)
        })

        it('atualiza o backgroundUrl do mapa', async () => {
            mockPrisma.gameMap.findUnique.mockResolvedValue({ id: 1, adventureId: ADV_ID, gridWidth: 20, gridHeight: 15 })
            mockPrisma.gameMap.update.mockResolvedValue({ id: 1, adventureId: ADV_ID, gridWidth: 20, gridHeight: 15, backgroundUrl: '/uploads/maps/y.png' })
            const res = await withMaster(request(app).patch('/api/maps/1').send({ backgroundUrl: '/uploads/maps/y.png' }))
            expect(res.status).toBe(200)
            expect(mockPrisma.gameMap.update).toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 1 }, data: expect.objectContaining({ backgroundUrl: '/uploads/maps/y.png' }) })
            )
        })

        it('remove o backgroundUrl com null', async () => {
            mockPrisma.gameMap.findUnique.mockResolvedValue({ id: 1, adventureId: ADV_ID, gridWidth: 20, gridHeight: 15 })
            mockPrisma.gameMap.update.mockResolvedValue({ id: 1, adventureId: ADV_ID, backgroundUrl: null })
            const res = await withMaster(request(app).patch('/api/maps/1').send({ backgroundUrl: null }))
            expect(res.status).toBe(200)
            expect(mockPrisma.gameMap.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ backgroundUrl: null }) })
            )
        })

        it('resize menor clampa tokens fora dos limites', async () => {
            mockPrisma.gameMap.findUnique.mockResolvedValue({ id: 1, adventureId: ADV_ID, gridWidth: 30, gridHeight: 20 })
            mockPrisma.gameMap.update.mockResolvedValue({ id: 1, adventureId: ADV_ID, gridWidth: 15, gridHeight: 10 })
            mockPrisma.token.findMany.mockResolvedValue([
                { id: 10, posX: 25, posY: 18 }, // fora de 15x10
                { id: 11, posX: 3, posY: 4 },   // dentro
            ])
            mockPrisma.token.update.mockResolvedValue({})
            const res = await withMaster(request(app).patch('/api/maps/1').send({ size: 'small' }))
            expect(res.status).toBe(200)
            // apenas o token fora dos limites e clampado (para 14,9)
            expect(mockPrisma.token.update).toHaveBeenCalledTimes(1)
            expect(mockPrisma.token.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { posX: 14, posY: 9 } })
        })
    })

    describe('DELETE /api/maps/:id', () => {
        it('player nao pode deletar', async () => {
            const res = await withPlayer(request(app).delete('/api/maps/1'))
            expect(res.status).toBe(403)
        })

        it('retorna 404 quando mapa e de outra aventura', async () => {
            mockPrisma.gameMap.findUnique.mockResolvedValue({ id: 1, adventureId: 999 })
            const res = await withMaster(request(app).delete('/api/maps/1'))
            expect(res.status).toBe(404)
        })

        it('deleta e retorna 204', async () => {
            mockPrisma.gameMap.findUnique.mockResolvedValue({ id: 1, adventureId: ADV_ID })
            mockPrisma.gameMap.delete.mockResolvedValue({})
            const res = await withMaster(request(app).delete('/api/maps/1'))
            expect(res.status).toBe(204)
        })
    })

    describe('POST /api/maps/:id/activate', () => {
        it('player nao pode ativar', async () => {
            const res = await withPlayer(request(app).post('/api/maps/1/activate'))
            expect(res.status).toBe(403)
        })

        it('retorna 404 quando mapa e de outra aventura', async () => {
            mockPrisma.gameMap.findUnique.mockResolvedValue({ id: 1, adventureId: 999 })
            const res = await withMaster(request(app).post('/api/maps/1/activate'))
            expect(res.status).toBe(404)
        })

        it('ativa novo mapa, deletando tokens e desativando o anterior', async () => {
            mockPrisma.gameMap.findUnique.mockResolvedValue({ id: 2, adventureId: ADV_ID })
            mockPrisma.gameMap.findMany.mockResolvedValue([{ id: 1, adventureId: ADV_ID, active: true }])
            mockPrisma.token.deleteMany.mockResolvedValue({ count: 3 })
            mockPrisma.gameMap.update.mockImplementation(({ where, data }) =>
                Promise.resolve({ id: where.id, adventureId: ADV_ID, active: data.active })
            )
            const res = await withMaster(request(app).post('/api/maps/2/activate'))
            expect(res.status).toBe(200)
            expect(res.body.active).toBe(true)
            expect(mockPrisma.token.deleteMany).toHaveBeenCalledWith({ where: { gameMapId: 1 } })
            expect(mockPrisma.gameMap.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { active: false } })
            expect(mockPrisma.gameMap.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { active: true } })
        })
    })

    describe('POST /api/maps/:id/tokens', () => {
        it('player nao pode adicionar token', async () => {
            const res = await withPlayer(request(app).post('/api/maps/1/tokens').send({ characterId: 5 }))
            expect(res.status).toBe(403)
        })

        it('retorna 400 sem characterId', async () => {
            const res = await withMaster(request(app).post('/api/maps/1/tokens').send({}))
            expect(res.status).toBe(400)
        })

        it('retorna 404 quando mapa e de outra aventura', async () => {
            mockPrisma.gameMap.findUnique.mockResolvedValue({ id: 1, adventureId: 999, gridWidth: 20, gridHeight: 15 })
            const res = await withMaster(request(app).post('/api/maps/1/tokens').send({ characterId: 5 }))
            expect(res.status).toBe(404)
        })

        it('retorna 404 quando personagem e de outra aventura', async () => {
            mockPrisma.gameMap.findUnique.mockResolvedValue({ id: 1, adventureId: ADV_ID, gridWidth: 20, gridHeight: 15 })
            mockPrisma.character.findUnique.mockResolvedValue({ id: 5, adventureId: 999 })
            const res = await withMaster(request(app).post('/api/maps/1/tokens').send({ characterId: 5 }))
            expect(res.status).toBe(404)
        })

        it('retorna 409 quando personagem ja tem token no mapa', async () => {
            mockPrisma.gameMap.findUnique.mockResolvedValue({ id: 1, adventureId: ADV_ID, gridWidth: 20, gridHeight: 15 })
            mockPrisma.character.findUnique.mockResolvedValue({ id: 5, adventureId: ADV_ID })
            mockPrisma.token.findFirst.mockResolvedValue({ id: 99 })
            const res = await withMaster(request(app).post('/api/maps/1/tokens').send({ characterId: 5 }))
            expect(res.status).toBe(409)
        })

        it('cria token com posicao clampada aos limites', async () => {
            mockPrisma.gameMap.findUnique.mockResolvedValue({ id: 1, adventureId: ADV_ID, gridWidth: 20, gridHeight: 15 })
            mockPrisma.character.findUnique.mockResolvedValue({ id: 5, adventureId: ADV_ID })
            mockPrisma.token.findFirst.mockResolvedValue(null)
            mockPrisma.token.create.mockResolvedValue({ id: 42, posX: 19, posY: 14, character: { id: 5, nome: 'Hero', imageUrl: null } })
            const res = await withMaster(request(app).post('/api/maps/1/tokens').send({ characterId: 5, posX: 99, posY: 99 }))
            expect(res.status).toBe(201)
            expect(mockPrisma.token.create).toHaveBeenCalledWith(
                expect.objectContaining({ data: expect.objectContaining({ posX: 19, posY: 14 }) })
            )
        })
    })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        session: { findUnique: vi.fn() },
        title: {
            findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(),
            update: vi.fn(), delete: vi.fn(),
        },
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

const playerSession = {
    token: PLAYER_TOKEN,
    userId: 1,
    expiresAt: new Date(Date.now() + 3_600_000),
    user: { id: 1, username: 'player' },
}

const masterSession = {
    token: MASTER_TOKEN,
    userId: 2,
    expiresAt: new Date(Date.now() + 3_600_000),
    user: { id: 2, username: 'master' },
}

describe('Titles Routes (/api/titles)', () => {
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

    describe('GET /api/titles', () => {
        it('retorna 401 sem autenticacao', async () => {
            const res = await request(app).get('/api/titles')
            expect(res.status).toBe(401)
        })

        it('retorna 400 sem aventura selecionada', async () => {
            const res = await request(app).get('/api/titles').set('Cookie', `session=${PLAYER_TOKEN}`)
            expect(res.status).toBe(400)
        })

        it('player pode listar titulos da aventura', async () => {
            mockPrisma.title.findMany.mockResolvedValue([
                { id: 1, nome: 'Heroi', color: '#FF0000', adventureId: ADV_ID },
            ])
            const res = await withPlayer(request(app).get('/api/titles'))
            expect(res.status).toBe(200)
            expect(res.body).toHaveLength(1)
            expect(mockPrisma.title.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { adventureId: ADV_ID } })
            )
        })

        it('master tambem pode listar', async () => {
            mockPrisma.title.findMany.mockResolvedValue([])
            const res = await withMaster(request(app).get('/api/titles'))
            expect(res.status).toBe(200)
        })
    })

    describe('POST /api/titles', () => {
        it('player nao pode criar titulo', async () => {
            const res = await withPlayer(
                request(app).post('/api/titles').send({ nome: 'Heroi', color: '#FF0000' })
            )
            expect(res.status).toBe(403)
        })

        it('retorna 400 sem nome', async () => {
            const res = await withMaster(
                request(app).post('/api/titles').send({ color: '#FF0000' })
            )
            expect(res.status).toBe(400)
        })

        it('retorna 400 com color invalido', async () => {
            const res = await withMaster(
                request(app).post('/api/titles').send({ nome: 'Heroi', color: 'red' })
            )
            expect(res.status).toBe(400)
        })

        it('retorna 400 com color sem hash', async () => {
            const res = await withMaster(
                request(app).post('/api/titles').send({ nome: 'Heroi', color: 'FF0000' })
            )
            expect(res.status).toBe(400)
        })

        it('master cria titulo com adventureId', async () => {
            const created = { id: 5, nome: 'Heroi', color: '#FF0000', adventureId: ADV_ID }
            mockPrisma.title.create.mockResolvedValue(created)
            const res = await withMaster(
                request(app).post('/api/titles').send({ nome: 'Heroi', color: '#FF0000' })
            )
            expect(res.status).toBe(201)
            expect(mockPrisma.title.create).toHaveBeenCalledWith({
                data: { nome: 'Heroi', color: '#FF0000', adventureId: ADV_ID },
            })
        })
    })

    describe('PATCH /api/titles/:id', () => {
        it('player nao pode editar titulo', async () => {
            const res = await withPlayer(
                request(app).patch('/api/titles/1').send({ nome: 'Novo' })
            )
            expect(res.status).toBe(403)
        })

        it('retorna 404 quando titulo pertence a outra aventura', async () => {
            mockPrisma.title.findUnique.mockResolvedValue({ id: 1, adventureId: 999, nome: 'X', color: '#FFFFFF' })
            const res = await withMaster(
                request(app).patch('/api/titles/1').send({ nome: 'Novo' })
            )
            expect(res.status).toBe(404)
        })

        it('retorna 400 com color invalido', async () => {
            mockPrisma.title.findUnique.mockResolvedValue({ id: 1, adventureId: ADV_ID, nome: 'X', color: '#FFFFFF' })
            const res = await withMaster(
                request(app).patch('/api/titles/1').send({ color: 'bad' })
            )
            expect(res.status).toBe(400)
        })

        it('atualiza nome e color', async () => {
            mockPrisma.title.findUnique.mockResolvedValue({ id: 1, adventureId: ADV_ID, nome: 'Old', color: '#000000' })
            mockPrisma.title.update.mockResolvedValue({ id: 1, adventureId: ADV_ID, nome: 'Novo', color: '#ABCDEF' })
            const res = await withMaster(
                request(app).patch('/api/titles/1').send({ nome: 'Novo', color: '#ABCDEF' })
            )
            expect(res.status).toBe(200)
            expect(res.body.nome).toBe('Novo')
        })
    })

    describe('DELETE /api/titles/:id', () => {
        it('player nao pode deletar titulo', async () => {
            const res = await withPlayer(request(app).delete('/api/titles/1'))
            expect(res.status).toBe(403)
        })

        it('retorna 404 quando titulo pertence a outra aventura', async () => {
            mockPrisma.title.findUnique.mockResolvedValue({ id: 1, adventureId: 999 })
            const res = await withMaster(request(app).delete('/api/titles/1'))
            expect(res.status).toBe(404)
        })

        it('deleta titulo e retorna 204', async () => {
            mockPrisma.title.findUnique.mockResolvedValue({ id: 1, adventureId: ADV_ID, nome: 'X', color: '#FFFFFF' })
            mockPrisma.title.delete.mockResolvedValue({})
            const res = await withMaster(request(app).delete('/api/titles/1'))
            expect(res.status).toBe(204)
        })
    })
})

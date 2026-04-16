import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        session: { findUnique: vi.fn(), delete: vi.fn() },
        character: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        pillar: { update: vi.fn(), create: vi.fn(), delete: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
        ability: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
        adventureUser: { findUnique: vi.fn() },
        adventure: { findUnique: vi.fn() },
        title: { findUnique: vi.fn() },
    },
}))

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }))

import { app } from '../../index.js'

const VALID_TOKEN = 'test-session-token'
const MASTER_TOKEN = 'master-session-token'
const ADV_ID = 7
const withAuth = (req) => req.set('Cookie', [`session=${VALID_TOKEN}`, `adventure=${ADV_ID}`])
const withMaster = (req) => req.set('Cookie', [`session=${MASTER_TOKEN}`, `adventure=${ADV_ID}`])

const playerSession = {
    token: VALID_TOKEN,
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

describe('Characters Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockPrisma.session.findUnique.mockImplementation(({ where }) => {
            if (where.token === VALID_TOKEN) return Promise.resolve(playerSession)
            if (where.token === MASTER_TOKEN) return Promise.resolve(masterSession)
            return Promise.resolve(null)
        })
        mockPrisma.adventureUser.findUnique.mockImplementation(({ where }) => {
            const { userId } = where.userId_adventureId
            const role = userId === 2 ? 'master' : 'player'
            return Promise.resolve({ userId, adventureId: ADV_ID, role, adventure: { id: ADV_ID, nome: 'main' } })
        })
    })

    describe('GET /api/characters', () => {
        it('retorna 401 sem autenticação', async () => {
            const res = await request(app).get('/api/characters')
            expect(res.status).toBe(401)
        })

        it('retorna 400 sem aventura selecionada', async () => {
            const res = await request(app).get('/api/characters').set('Cookie', `session=${VALID_TOKEN}`)
            expect(res.status).toBe(400)
            expect(res.body.error).toMatch(/aventura/i)
        })

        it('player ve apenas player_characters da aventura', async () => {
            mockPrisma.character.findMany.mockResolvedValue([])
            await withAuth(request(app).get('/api/characters'))
            expect(mockPrisma.character.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { adventureId: ADV_ID, type: 'player_character' } })
            )
        })

        it('master ve todos os personagens da aventura', async () => {
            mockPrisma.character.findMany.mockResolvedValue([])
            await withMaster(request(app).get('/api/characters'))
            expect(mockPrisma.character.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { adventureId: ADV_ID } })
            )
        })

        it('player recebe lista vazia ao filtrar por type=enemy', async () => {
            const res = await withAuth(request(app).get('/api/characters?type=enemy'))
            expect(res.status).toBe(200)
            expect(res.body).toEqual([])
        })

        it('master pode filtrar por type=enemy', async () => {
            mockPrisma.character.findMany.mockResolvedValue([])
            await withMaster(request(app).get('/api/characters?type=enemy'))
            expect(mockPrisma.character.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { adventureId: ADV_ID, type: 'enemy' } })
            )
        })
    })

    describe('GET /api/characters/:id', () => {
        it('retorna 404 quando não encontrado', async () => {
            mockPrisma.character.findUnique.mockResolvedValue(null)
            const res = await withAuth(request(app).get('/api/characters/999'))
            expect(res.status).toBe(404)
        })

        it('retorna 404 quando personagem pertence a outra aventura', async () => {
            mockPrisma.character.findUnique.mockResolvedValue({ id: 1, adventureId: 999, pillars: [] })
            const res = await withAuth(request(app).get('/api/characters/1'))
            expect(res.status).toBe(404)
        })

        it('retorna o personagem da aventura atual', async () => {
            const char = { id: 1, nome: 'Aragorn', adventureId: ADV_ID, pillars: [{ id: 1, abilities: [] }] }
            mockPrisma.character.findUnique.mockResolvedValue(char)
            const res = await withAuth(request(app).get('/api/characters/1'))
            expect(res.status).toBe(200)
            expect(res.body).toEqual(char)
        })
    })

    describe('POST /api/characters', () => {
        it('retorna 400 sem name', async () => {
            const res = await withAuth(request(app).post('/api/characters').send({}))
            expect(res.status).toBe(400)
        })

        it('cria personagem com adventureId', async () => {
            const created = { id: 1, nome: 'Hero', adventureId: ADV_ID, pillars: [] }
            mockPrisma.character.create.mockResolvedValue(created)
            const res = await withAuth(
                request(app).post('/api/characters').send({ name: 'Hero', maxHp: 100 })
            )
            expect(res.status).toBe(201)
            expect(mockPrisma.character.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ nome: 'Hero', adventureId: ADV_ID }),
                })
            )
        })

        it('player nao pode criar inimigo', async () => {
            const res = await withAuth(
                request(app).post('/api/characters').send({ name: 'Goblin', type: 'enemy' })
            )
            expect(res.status).toBe(403)
            expect(res.body.error).toMatch(/mestre/)
        })

        it('master pode criar inimigo na sua aventura', async () => {
            mockPrisma.character.create.mockResolvedValue({ id: 10, nome: 'Goblin', type: 'enemy', adventureId: ADV_ID, pillars: [] })
            const res = await withMaster(
                request(app).post('/api/characters').send({ name: 'Goblin', type: 'enemy', maxHp: 30 })
            )
            expect(res.status).toBe(201)
        })

        it('cria personagem com titleId valido da aventura', async () => {
            mockPrisma.title.findUnique.mockResolvedValue({ id: 4, adventureId: ADV_ID })
            mockPrisma.character.create.mockResolvedValue({ id: 1, nome: 'Hero', adventureId: ADV_ID, titleId: 4, pillars: [] })
            const res = await withAuth(
                request(app).post('/api/characters').send({ name: 'Hero', titleId: 4 })
            )
            expect(res.status).toBe(201)
            expect(mockPrisma.character.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ titleId: 4 }),
                })
            )
        })

        it('retorna 400 quando titleId pertence a outra aventura', async () => {
            mockPrisma.title.findUnique.mockResolvedValue({ id: 4, adventureId: 999 })
            const res = await withAuth(
                request(app).post('/api/characters').send({ name: 'Hero', titleId: 4 })
            )
            expect(res.status).toBe(400)
        })

        it('retorna 400 ao enviar mais de 3 pilares', async () => {
            const res = await withAuth(
                request(app).post('/api/characters').send({
                    name: 'Hero',
                    pillars: [
                        { name: 'P1', type: 'T1' }, { name: 'P2', type: 'T2' },
                        { name: 'P3', type: 'T3' }, { name: 'P4', type: 'T4' },
                    ],
                })
            )
            expect(res.status).toBe(400)
        })
    })

    describe('PATCH /api/characters/:id', () => {
        const pcChar = { id: 1, nome: 'Hero', type: 'player_character', adventureId: ADV_ID }
        const enemyChar = { id: 2, nome: 'Goblin', type: 'enemy', adventureId: ADV_ID }
        const otherAdvChar = { id: 3, nome: 'Intruso', type: 'player_character', adventureId: 999 }

        beforeEach(() => {
            mockPrisma.character.findUnique.mockImplementation(({ where }) => {
                if (where.id === 1) return Promise.resolve(pcChar)
                if (where.id === 2) return Promise.resolve(enemyChar)
                if (where.id === 3) return Promise.resolve(otherAdvChar)
                return Promise.resolve(null)
            })
        })

        it('retorna 404 quando personagem pertence a outra aventura', async () => {
            const res = await withAuth(request(app).patch('/api/characters/3').send({ name: 'X' }))
            expect(res.status).toBe(404)
        })

        it('atualiza nome', async () => {
            mockPrisma.character.update.mockResolvedValue({ ...pcChar, nome: 'Novo' })
            const res = await withAuth(
                request(app).patch('/api/characters/1').send({ name: 'Novo' })
            )
            expect(res.status).toBe(200)
        })

        it('player nao pode editar inimigo', async () => {
            const res = await withAuth(
                request(app).patch('/api/characters/2').send({ name: 'Hack' })
            )
            expect(res.status).toBe(403)
        })

        it('master pode editar inimigo', async () => {
            mockPrisma.character.update.mockResolvedValue({ ...enemyChar, nome: 'Orc' })
            const res = await withMaster(
                request(app).patch('/api/characters/2').send({ name: 'Orc' })
            )
            expect(res.status).toBe(200)
        })

        it('atualiza titleId com titulo da aventura', async () => {
            mockPrisma.title.findUnique.mockResolvedValue({ id: 5, adventureId: ADV_ID })
            mockPrisma.character.update.mockResolvedValue({ ...pcChar, titleId: 5 })
            const res = await withAuth(
                request(app).patch('/api/characters/1').send({ titleId: 5 })
            )
            expect(res.status).toBe(200)
            expect(mockPrisma.character.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ titleId: 5 }),
                })
            )
        })

        it('remove titulo quando titleId = null', async () => {
            mockPrisma.character.update.mockResolvedValue({ ...pcChar, titleId: null })
            const res = await withAuth(
                request(app).patch('/api/characters/1').send({ titleId: null })
            )
            expect(res.status).toBe(200)
            expect(mockPrisma.character.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ titleId: null }),
                })
            )
        })

        it('retorna 400 quando titleId pertence a outra aventura', async () => {
            mockPrisma.title.findUnique.mockResolvedValue({ id: 5, adventureId: 999 })
            const res = await withAuth(
                request(app).patch('/api/characters/1').send({ titleId: 5 })
            )
            expect(res.status).toBe(400)
        })
    })

    describe('PATCH /api/pillars/:id', () => {
        const validPillar = { id: 1, character: { id: 1, adventureId: ADV_ID } }
        const otherAdvPillar = { id: 2, character: { id: 9, adventureId: 999 } }

        beforeEach(() => {
            mockPrisma.pillar.findUnique.mockImplementation(({ where }) => {
                if (where.id === 1) return Promise.resolve(validPillar)
                if (where.id === 2) return Promise.resolve(otherAdvPillar)
                return Promise.resolve(null)
            })
        })

        it('retorna 400 sem nenhum campo', async () => {
            const res = await withAuth(request(app).patch('/api/pillars/1').send({}))
            expect(res.status).toBe(400)
        })

        it('retorna 404 quando pilar pertence a outra aventura', async () => {
            const res = await withAuth(request(app).patch('/api/pillars/2').send({ nome: 'Hack' }))
            expect(res.status).toBe(404)
        })

        it('atualiza nome e tipo do pilar', async () => {
            mockPrisma.pillar.update.mockResolvedValue({ id: 1, nome: 'Novo', tipo: 'Arcano', maxMana: 20, actualMana: 15 })
            const res = await withAuth(
                request(app).patch('/api/pillars/1').send({ nome: 'Novo', tipo: 'Arcano' })
            )
            expect(res.status).toBe(200)
        })
    })

    describe('POST /api/characters/:id/pillars', () => {
        const pcChar = { id: 1, nome: 'Hero', type: 'player_character', adventureId: ADV_ID }
        const otherAdvChar = { id: 3, adventureId: 999 }

        beforeEach(() => {
            mockPrisma.pillar.count.mockResolvedValue(0)
            mockPrisma.character.findUnique.mockImplementation(({ where }) => {
                if (where.id === 1) return Promise.resolve(pcChar)
                if (where.id === 3) return Promise.resolve(otherAdvChar)
                return Promise.resolve(null)
            })
        })

        it('retorna 404 quando personagem pertence a outra aventura', async () => {
            const res = await withAuth(
                request(app).post('/api/characters/3/pillars').send({ name: 'P', type: 'T' })
            )
            expect(res.status).toBe(404)
        })

        it('cria pilar e retorna 201', async () => {
            mockPrisma.pillar.create.mockResolvedValue({ id: 5, nome: 'Ranger', tipo: 'Físico', maxMana: 15, actualMana: 15, characterId: 1 })
            const res = await withAuth(
                request(app).post('/api/characters/1/pillars').send({ name: 'Ranger', type: 'Físico', maxMana: 15 })
            )
            expect(res.status).toBe(201)
        })

        it('retorna 400 quando personagem já tem 3 pilares', async () => {
            mockPrisma.pillar.count.mockResolvedValue(3)
            const res = await withAuth(
                request(app).post('/api/characters/1/pillars').send({ name: 'P4', type: 'Tipo' })
            )
            expect(res.status).toBe(400)
        })
    })

    describe('DELETE /api/pillars/:id', () => {
        it('deleta pilar da aventura atual e retorna 204', async () => {
            mockPrisma.pillar.findUnique.mockResolvedValue({ id: 3, character: { id: 1, adventureId: ADV_ID } })
            mockPrisma.pillar.delete.mockResolvedValue({})
            const res = await withAuth(request(app).delete('/api/pillars/3'))
            expect(res.status).toBe(204)
        })

        it('retorna 404 quando pilar pertence a outra aventura', async () => {
            mockPrisma.pillar.findUnique.mockResolvedValue({ id: 3, character: { id: 1, adventureId: 999 } })
            const res = await withAuth(request(app).delete('/api/pillars/3'))
            expect(res.status).toBe(404)
        })
    })

    describe('DELETE /api/characters/:id', () => {
        it('retorna 401 sem autenticação', async () => {
            const res = await request(app).delete('/api/characters/1')
            expect(res.status).toBe(401)
        })

        it('retorna 404 quando pertence a outra aventura', async () => {
            mockPrisma.character.findUnique.mockResolvedValue({ id: 3, type: 'player_character', adventureId: 999 })
            const res = await withAuth(request(app).delete('/api/characters/3'))
            expect(res.status).toBe(404)
        })

        it('deleta PC e retorna 204', async () => {
            mockPrisma.character.findUnique.mockResolvedValue({ id: 1, type: 'player_character', adventureId: ADV_ID })
            mockPrisma.character.delete.mockResolvedValue({})
            const res = await withAuth(request(app).delete('/api/characters/1'))
            expect(res.status).toBe(204)
        })

        it('player nao pode deletar inimigo', async () => {
            mockPrisma.character.findUnique.mockResolvedValue({ id: 2, type: 'enemy', adventureId: ADV_ID })
            const res = await withAuth(request(app).delete('/api/characters/2'))
            expect(res.status).toBe(403)
        })

        it('master pode deletar inimigo', async () => {
            mockPrisma.character.findUnique.mockResolvedValue({ id: 2, type: 'enemy', adventureId: ADV_ID })
            mockPrisma.character.delete.mockResolvedValue({})
            const res = await withMaster(request(app).delete('/api/characters/2'))
            expect(res.status).toBe(204)
        })
    })
})

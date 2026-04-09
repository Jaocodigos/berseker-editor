import { describe, it, expect, vi, beforeEach } from 'vitest'
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

const VALID_TOKEN = 'test-session-token'
const MASTER_TOKEN = 'master-session-token'
const withAuth = (req) => req.set('Cookie', `session=${VALID_TOKEN}`)
const withMaster = (req) => req.set('Cookie', `session=${MASTER_TOKEN}`)

const playerSession = {
    token: VALID_TOKEN,
    userId: 1,
    expiresAt: new Date(Date.now() + 3_600_000),
    user: { id: 1, username: 'player', role: 'player' },
}

const masterSession = {
    token: MASTER_TOKEN,
    userId: 2,
    expiresAt: new Date(Date.now() + 3_600_000),
    user: { id: 2, username: 'master', role: 'master' },
}

describe('Characters Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockPrisma.session.findUnique.mockImplementation(({ where }) => {
            if (where.token === VALID_TOKEN) return Promise.resolve(playerSession)
            if (where.token === MASTER_TOKEN) return Promise.resolve(masterSession)
            return Promise.resolve(null)
        })
    })

    describe('GET /api/characters', () => {
        it('retorna 401 sem autenticação', async () => {
            const res = await request(app).get('/api/characters')
            expect(res.status).toBe(401)
        })

        it('player ve apenas player_characters', async () => {
            const chars = [{ id: 1, nome: 'Aragorn', pillars: [] }]
            mockPrisma.character.findMany.mockResolvedValue(chars)
            const res = await withAuth(request(app).get('/api/characters'))
            expect(res.status).toBe(200)
            expect(mockPrisma.character.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { type: 'player_character' } })
            )
        })

        it('master ve todos os personagens', async () => {
            const chars = [{ id: 1, nome: 'Aragorn' }, { id: 2, nome: 'Goblin', type: 'enemy' }]
            mockPrisma.character.findMany.mockResolvedValue(chars)
            const res = await withMaster(request(app).get('/api/characters'))
            expect(res.status).toBe(200)
            expect(mockPrisma.character.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: {} })
            )
        })

        it('player recebe lista vazia ao filtrar por type=enemy', async () => {
            const res = await withAuth(request(app).get('/api/characters?type=enemy'))
            expect(res.status).toBe(200)
            expect(res.body).toEqual([])
        })

        it('master pode filtrar por type=enemy', async () => {
            const enemies = [{ id: 2, nome: 'Goblin' }]
            mockPrisma.character.findMany.mockResolvedValue(enemies)
            const res = await withMaster(request(app).get('/api/characters?type=enemy'))
            expect(res.status).toBe(200)
            expect(mockPrisma.character.findMany).toHaveBeenCalledWith(
                expect.objectContaining({ where: { type: 'enemy' } })
            )
        })
    })

    describe('GET /api/characters/:id', () => {
        it('retorna 404 quando não encontrado', async () => {
            mockPrisma.character.findUnique.mockResolvedValue(null)
            const res = await withAuth(request(app).get('/api/characters/999'))
            expect(res.status).toBe(404)
            expect(res.body.error).toBe('Personagem não encontrado')
        })

        it('retorna o personagem com pillars e abilities', async () => {
            const char = { id: 1, nome: 'Aragorn', pillars: [{ id: 1, abilities: [] }] }
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
            expect(res.body.error).toBe('name e obrigatorio')
        })

        it('retorna 400 com maxHp inválido', async () => {
            const res = await withAuth(
                request(app).post('/api/characters').send({ name: 'Hero', maxHp: 'abc' })
            )
            expect(res.status).toBe(400)
        })

        it('retorna 400 com maxMana de pillar inválido', async () => {
            const res = await withAuth(
                request(app).post('/api/characters').send({
                    name: 'Hero',
                    pillars: [{ name: 'Ranger', type: 'Físico', maxMana: 'xyz' }],
                })
            )
            expect(res.status).toBe(400)
        })

        it('retorna 400 ao enviar mais de 3 pilares', async () => {
            const res = await withAuth(
                request(app).post('/api/characters').send({
                    name: 'Hero',
                    pillars: [
                        { name: 'P1', type: 'T1' },
                        { name: 'P2', type: 'T2' },
                        { name: 'P3', type: 'T3' },
                        { name: 'P4', type: 'T4' },
                    ],
                })
            )
            expect(res.status).toBe(400)
            expect(res.body.error).toMatch(/maximo 3 pilares/)
        })

        it('cria personagem sem pillars', async () => {
            const created = { id: 1, nome: 'Hero', maxHp: 100, actualHp: 100, xp: 0, pillars: [] }
            mockPrisma.character.create.mockResolvedValue(created)
            const res = await withAuth(
                request(app).post('/api/characters').send({ name: 'Hero', maxHp: 100 })
            )
            expect(res.status).toBe(201)
            expect(mockPrisma.character.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ nome: 'Hero', maxHp: 100, actualHp: 100 }),
                })
            )
        })

        it('cria personagem com xp inicial', async () => {
            const created = { id: 4, nome: 'Veteran', maxHp: 80, actualHp: 80, xp: 150, pillars: [] }
            mockPrisma.character.create.mockResolvedValue(created)
            const res = await withAuth(
                request(app).post('/api/characters').send({ name: 'Veteran', maxHp: 80, xp: 150 })
            )
            expect(res.status).toBe(201)
            expect(mockPrisma.character.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ xp: 150 }),
                })
            )
        })

        it('cria personagem com level, pillarXp e pillarLevel', async () => {
            const created = { id: 5, nome: 'Mestre', maxHp: 100, actualHp: 100, xp: 0, level: 5, pillarXp: 200, pillarLevel: 3, pillars: [] }
            mockPrisma.character.create.mockResolvedValue(created)
            const res = await withAuth(
                request(app).post('/api/characters').send({ name: 'Mestre', maxHp: 100, level: 5, pillarXp: 200, pillarLevel: 3 })
            )
            expect(res.status).toBe(201)
            expect(mockPrisma.character.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ level: 5, pillarXp: 200, pillarLevel: 3 }),
                })
            )
        })

        it('retorna 400 com level inválido', async () => {
            const res = await withAuth(
                request(app).post('/api/characters').send({ name: 'Hero', level: 'abc' })
            )
            expect(res.status).toBe(400)
        })

        it('retorna 400 com pillarXp inválido', async () => {
            const res = await withAuth(
                request(app).post('/api/characters').send({ name: 'Hero', pillarXp: 'abc' })
            )
            expect(res.status).toBe(400)
        })

        it('retorna 400 com pillarLevel inválido', async () => {
            const res = await withAuth(
                request(app).post('/api/characters').send({ name: 'Hero', pillarLevel: 'abc' })
            )
            expect(res.status).toBe(400)
        })

        it('cria personagem sem HP (default 0)', async () => {
            const created = { id: 2, nome: 'Zero', maxHp: 0, actualHp: 0, pillars: [] }
            mockPrisma.character.create.mockResolvedValue(created)
            await withAuth(request(app).post('/api/characters').send({ name: 'Zero' }))
            expect(mockPrisma.character.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ maxHp: 0, actualHp: 0 }),
                })
            )
        })

        it('cria personagem com pillars', async () => {
            const created = {
                id: 3, nome: 'Mago', maxHp: 50, actualHp: 50,
                pillars: [{ id: 1, nome: 'Arcano', tipo: 'Mágico', maxMana: 20, actualMana: 20 }],
            }
            mockPrisma.character.create.mockResolvedValue(created)
            const res = await withAuth(
                request(app).post('/api/characters').send({
                    name: 'Mago',
                    maxHp: 50,
                    pillars: [{ name: 'Arcano', type: 'Mágico', maxMana: 20 }],
                })
            )
            expect(res.status).toBe(201)
        })

        it('player nao pode criar inimigo', async () => {
            const res = await withAuth(
                request(app).post('/api/characters').send({ name: 'Goblin', type: 'enemy' })
            )
            expect(res.status).toBe(403)
            expect(res.body.error).toMatch(/mestre/)
        })

        it('master pode criar inimigo', async () => {
            const created = { id: 10, nome: 'Goblin', type: 'enemy', maxHp: 30, pillars: [] }
            mockPrisma.character.create.mockResolvedValue(created)
            const res = await withMaster(
                request(app).post('/api/characters').send({ name: 'Goblin', type: 'enemy', maxHp: 30 })
            )
            expect(res.status).toBe(201)
            expect(mockPrisma.character.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ type: 'enemy' }),
                })
            )
        })

        it('retorna 400 com type invalido', async () => {
            const res = await withMaster(
                request(app).post('/api/characters').send({ name: 'X', type: 'boss' })
            )
            expect(res.status).toBe(400)
        })
    })

    describe('PATCH /api/characters/:id', () => {
        const pcChar = { id: 1, nome: 'Hero', type: 'player_character' }
        const enemyChar = { id: 2, nome: 'Goblin', type: 'enemy' }

        beforeEach(() => {
            mockPrisma.character.findUnique.mockImplementation(({ where }) => {
                if (where.id === 1) return Promise.resolve(pcChar)
                if (where.id === 2) return Promise.resolve(enemyChar)
                return Promise.resolve(null)
            })
        })

        it('retorna 404 quando personagem nao existe', async () => {
            mockPrisma.character.findUnique.mockResolvedValue(null)
            const res = await withAuth(request(app).patch('/api/characters/999').send({ name: 'X' }))
            expect(res.status).toBe(404)
        })

        it('retorna 400 sem nenhum campo', async () => {
            const res = await withAuth(request(app).patch('/api/characters/1').send({}))
            expect(res.status).toBe(400)
        })

        it('retorna 400 com actualHp inválido', async () => {
            const res = await withAuth(
                request(app).patch('/api/characters/1').send({ actualHp: 'abc' })
            )
            expect(res.status).toBe(400)
        })

        it('atualiza actualHp', async () => {
            const updated = { id: 1, nome: 'Hero', actualHp: 50 }
            mockPrisma.character.update.mockResolvedValue(updated)
            const res = await withAuth(
                request(app).patch('/api/characters/1').send({ actualHp: 50 })
            )
            expect(res.status).toBe(200)
            expect(mockPrisma.character.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: { actualHp: 50 } })
            )
        })

        it('atualiza nome', async () => {
            const updated = { id: 1, nome: 'Novo Nome', actualHp: 100 }
            mockPrisma.character.update.mockResolvedValue(updated)
            const res = await withAuth(
                request(app).patch('/api/characters/1').send({ name: 'Novo Nome' })
            )
            expect(res.status).toBe(200)
            expect(mockPrisma.character.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: { nome: 'Novo Nome' } })
            )
        })

        it('atualiza xp', async () => {
            const updated = { id: 1, nome: 'Hero', xp: 300 }
            mockPrisma.character.update.mockResolvedValue(updated)
            const res = await withAuth(
                request(app).patch('/api/characters/1').send({ xp: 300 })
            )
            expect(res.status).toBe(200)
        })

        it('retorna 400 com xp inválido', async () => {
            const res = await withAuth(
                request(app).patch('/api/characters/1').send({ xp: 'abc' })
            )
            expect(res.status).toBe(400)
        })

        it('atualiza level', async () => {
            const updated = { id: 1, nome: 'Hero', level: 5 }
            mockPrisma.character.update.mockResolvedValue(updated)
            const res = await withAuth(
                request(app).patch('/api/characters/1').send({ level: 5 })
            )
            expect(res.status).toBe(200)
        })

        it('retorna 400 com level inválido', async () => {
            const res = await withAuth(
                request(app).patch('/api/characters/1').send({ level: 'abc' })
            )
            expect(res.status).toBe(400)
        })

        it('atualiza pillarXp', async () => {
            const updated = { id: 1, nome: 'Hero', pillarXp: 100 }
            mockPrisma.character.update.mockResolvedValue(updated)
            const res = await withAuth(
                request(app).patch('/api/characters/1').send({ pillarXp: 100 })
            )
            expect(res.status).toBe(200)
        })

        it('retorna 400 com pillarXp inválido', async () => {
            const res = await withAuth(
                request(app).patch('/api/characters/1').send({ pillarXp: 'abc' })
            )
            expect(res.status).toBe(400)
        })

        it('atualiza pillarLevel', async () => {
            const updated = { id: 1, nome: 'Hero', pillarLevel: 3 }
            mockPrisma.character.update.mockResolvedValue(updated)
            const res = await withAuth(
                request(app).patch('/api/characters/1').send({ pillarLevel: 3 })
            )
            expect(res.status).toBe(200)
        })

        it('retorna 400 com pillarLevel inválido', async () => {
            const res = await withAuth(
                request(app).patch('/api/characters/1').send({ pillarLevel: 'abc' })
            )
            expect(res.status).toBe(400)
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
    })

    describe('PATCH /api/pillars/:id', () => {
        it('retorna 400 sem nenhum campo', async () => {
            const res = await withAuth(request(app).patch('/api/pillars/1').send({}))
            expect(res.status).toBe(400)
        })

        it('atualiza nome e tipo do pilar', async () => {
            const updated = { id: 1, nome: 'Novo', tipo: 'Arcano', maxMana: 20, actualMana: 15 }
            mockPrisma.pillar.update.mockResolvedValue(updated)
            const res = await withAuth(
                request(app).patch('/api/pillars/1').send({ nome: 'Novo', tipo: 'Arcano' })
            )
            expect(res.status).toBe(200)
            expect(mockPrisma.pillar.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: { nome: 'Novo', tipo: 'Arcano' } })
            )
        })

        it('atualiza mana do pilar', async () => {
            const updated = { id: 1, nome: 'Ranger', tipo: 'Físico', maxMana: 30, actualMana: 20 }
            mockPrisma.pillar.update.mockResolvedValue(updated)
            const res = await withAuth(
                request(app).patch('/api/pillars/1').send({ maxMana: 30, actualMana: 20 })
            )
            expect(res.status).toBe(200)
            expect(mockPrisma.pillar.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: { maxMana: 30, actualMana: 20 } })
            )
        })

        it('retorna 400 com maxMana inválido', async () => {
            const res = await withAuth(
                request(app).patch('/api/pillars/1').send({ maxMana: 'abc' })
            )
            expect(res.status).toBe(400)
        })
    })

    describe('POST /api/characters/:id/pillars', () => {
        beforeEach(() => {
            mockPrisma.pillar.count.mockResolvedValue(0)
        })

        it('retorna 400 sem name', async () => {
            const res = await withAuth(
                request(app).post('/api/characters/1/pillars').send({ type: 'Físico' })
            )
            expect(res.status).toBe(400)
        })

        it('retorna 400 sem type', async () => {
            const res = await withAuth(
                request(app).post('/api/characters/1/pillars').send({ name: 'Ranger' })
            )
            expect(res.status).toBe(400)
        })

        it('cria pilar e retorna 201', async () => {
            const created = { id: 5, nome: 'Ranger', tipo: 'Físico', maxMana: 15, actualMana: 15, characterId: 1 }
            mockPrisma.pillar.create.mockResolvedValue(created)
            const res = await withAuth(
                request(app).post('/api/characters/1/pillars').send({ name: 'Ranger', type: 'Físico', maxMana: 15 })
            )
            expect(res.status).toBe(201)
            expect(mockPrisma.pillar.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ nome: 'Ranger', tipo: 'Físico', maxMana: 15, characterId: 1 }),
                })
            )
        })

        it('retorna 400 quando personagem já tem 3 pilares', async () => {
            mockPrisma.pillar.count.mockResolvedValue(3)
            const res = await withAuth(
                request(app).post('/api/characters/1/pillars').send({ name: 'P4', type: 'Tipo' })
            )
            expect(res.status).toBe(400)
            expect(res.body.error).toMatch(/maximo 3 pilares/)
        })
    })

    describe('DELETE /api/pillars/:id', () => {
        it('deleta pilar e retorna 204', async () => {
            mockPrisma.pillar.delete.mockResolvedValue({})
            const res = await withAuth(request(app).delete('/api/pillars/3'))
            expect(res.status).toBe(204)
            expect(mockPrisma.pillar.delete).toHaveBeenCalledWith({ where: { id: 3 } })
        })
    })

    describe('DELETE /api/characters/:id', () => {
        it('retorna 401 sem autenticação', async () => {
            const res = await request(app).delete('/api/characters/1')
            expect(res.status).toBe(401)
        })

        it('retorna 404 quando personagem nao existe', async () => {
            mockPrisma.character.findUnique.mockResolvedValue(null)
            const res = await withAuth(request(app).delete('/api/characters/999'))
            expect(res.status).toBe(404)
        })

        it('deleta PC e retorna 204', async () => {
            mockPrisma.character.findUnique.mockResolvedValue({ id: 1, type: 'player_character' })
            mockPrisma.character.delete.mockResolvedValue({})
            const res = await withAuth(request(app).delete('/api/characters/1'))
            expect(res.status).toBe(204)
        })

        it('player nao pode deletar inimigo', async () => {
            mockPrisma.character.findUnique.mockResolvedValue({ id: 2, type: 'enemy' })
            const res = await withAuth(request(app).delete('/api/characters/2'))
            expect(res.status).toBe(403)
        })

        it('master pode deletar inimigo', async () => {
            mockPrisma.character.findUnique.mockResolvedValue({ id: 2, type: 'enemy' })
            mockPrisma.character.delete.mockResolvedValue({})
            const res = await withMaster(request(app).delete('/api/characters/2'))
            expect(res.status).toBe(204)
        })
    })
})

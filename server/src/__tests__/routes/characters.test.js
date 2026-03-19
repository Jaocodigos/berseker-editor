import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const { mockPrisma, mockBcrypt } = vi.hoisted(() => ({
    mockPrisma: {
        user: { findUnique: vi.fn() },
        character: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        pillar: { update: vi.fn() },
        ability: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    },
    mockBcrypt: { compare: vi.fn(), hash: vi.fn() },
}))

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }))
vi.mock('bcryptjs', () => ({ default: mockBcrypt }))

import { app } from '../../index.js'

const AUTH = `Basic ${Buffer.from('user:pass').toString('base64')}`
const withAuth = (req) => req.set('Authorization', AUTH)

describe('Characters Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockPrisma.user.findUnique.mockResolvedValue({ id: 1, username: 'user', passwordHash: 'h' })
        mockBcrypt.compare.mockResolvedValue(true)
    })

    describe('GET /api/characters', () => {
        it('retorna 401 sem autenticação', async () => {
            const res = await request(app).get('/api/characters')
            expect(res.status).toBe(401)
        })

        it('retorna lista de personagens', async () => {
            const chars = [{ id: 1, nome: 'Aragorn', pillars: [] }]
            mockPrisma.character.findMany.mockResolvedValue(chars)
            const res = await withAuth(request(app).get('/api/characters'))
            expect(res.status).toBe(200)
            expect(res.body).toEqual(chars)
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

        it('cria personagem sem pillars', async () => {
            const created = { id: 1, nome: 'Hero', maxHp: 100, actualHp: 100, pillars: [] }
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
    })

    describe('PATCH /api/characters/:id', () => {
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
    })

    describe('DELETE /api/characters/:id', () => {
        it('retorna 401 sem autenticação', async () => {
            const res = await request(app).delete('/api/characters/1')
            expect(res.status).toBe(401)
        })

        it('deleta e retorna 204', async () => {
            mockPrisma.character.delete.mockResolvedValue({})
            const res = await withAuth(request(app).delete('/api/characters/1'))
            expect(res.status).toBe(204)
            expect(mockPrisma.character.delete).toHaveBeenCalledWith({ where: { id: 1 } })
        })
    })
})

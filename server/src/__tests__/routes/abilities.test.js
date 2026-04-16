import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        session: { findUnique: vi.fn(), delete: vi.fn() },
        character: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        pillar: { update: vi.fn(), findUnique: vi.fn() },
        ability: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        adventureUser: { findUnique: vi.fn() },
    },
}))

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }))

import { app } from '../../index.js'

const VALID_TOKEN = 'test-session-token'
const ADV_ID = 7
const withAuth = (req) => req.set('Cookie', [`session=${VALID_TOKEN}`, `adventure=${ADV_ID}`])

describe('Abilities Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
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

    describe('POST /api/abilities', () => {
        it('retorna 400 sem campos obrigatórios', async () => {
            const res = await withAuth(
                request(app).post('/api/abilities').send({ nome: 'Fireball' })
            )
            expect(res.status).toBe(400)
        })

        it('retorna 404 quando pillar pertence a outra aventura', async () => {
            mockPrisma.pillar.findUnique.mockResolvedValue({ id: 1, character: { adventureId: 999 } })
            const res = await withAuth(
                request(app).post('/api/abilities').send({ nome: 'Fireball', dano: '2d6', custo: 5, pillarId: 1 })
            )
            expect(res.status).toBe(404)
        })

        it('cria habilidade com todos os campos', async () => {
            mockPrisma.pillar.findUnique.mockResolvedValue({ id: 1, character: { adventureId: ADV_ID } })
            const created = { id: 1, nome: 'Fireball', dano: '2d6', custo: 5, pillarId: 1, descricao: '' }
            mockPrisma.ability.create.mockResolvedValue(created)
            const res = await withAuth(
                request(app).post('/api/abilities').send({ nome: 'Fireball', dano: '2d6', custo: 5, pillarId: 1 })
            )
            expect(res.status).toBe(201)
            expect(res.body).toEqual(created)
        })
    })

    describe('PUT /api/abilities/:id', () => {
        it('retorna 400 sem campos obrigatórios', async () => {
            const res = await withAuth(
                request(app).put('/api/abilities/1').send({ nome: 'Fireball' })
            )
            expect(res.status).toBe(400)
        })

        it('retorna 404 quando ability pertence a outra aventura', async () => {
            mockPrisma.ability.findUnique.mockResolvedValue({ id: 1, pillar: { character: { adventureId: 999 } } })
            const res = await withAuth(
                request(app).put('/api/abilities/1').send({ nome: 'X', dano: '1d4', custo: 0 })
            )
            expect(res.status).toBe(404)
        })

        it('atualiza habilidade e retorna o objeto atualizado', async () => {
            mockPrisma.ability.findUnique.mockResolvedValue({ id: 1, pillar: { character: { adventureId: ADV_ID } } })
            const updated = { id: 1, nome: 'Fireball+', dano: '3d6', custo: 6, pillarId: 1, descricao: 'Nova desc' }
            mockPrisma.ability.update.mockResolvedValue(updated)

            const res = await withAuth(
                request(app).put('/api/abilities/1').send({ nome: 'Fireball+', dano: '3d6', custo: 6, descricao: 'Nova desc' })
            )

            expect(res.status).toBe(200)
            expect(res.body).toEqual(updated)
        })

        it('aceita custo igual a zero', async () => {
            mockPrisma.ability.findUnique.mockResolvedValue({ id: 1, pillar: { character: { adventureId: ADV_ID } } })
            mockPrisma.ability.update.mockResolvedValue({ id: 1, nome: 'Passiva', dano: '1d4', custo: 0, pillarId: 1, descricao: '' })
            const res = await withAuth(
                request(app).put('/api/abilities/1').send({ nome: 'Passiva', dano: '1d4', custo: 0 })
            )
            expect(res.status).toBe(200)
        })
    })

    describe('DELETE /api/abilities/:id', () => {
        it('retorna 404 quando ability pertence a outra aventura', async () => {
            mockPrisma.ability.findUnique.mockResolvedValue({ id: 1, pillar: { character: { adventureId: 999 } } })
            const res = await withAuth(request(app).delete('/api/abilities/1'))
            expect(res.status).toBe(404)
        })

        it('deleta habilidade e retorna 204', async () => {
            mockPrisma.ability.findUnique.mockResolvedValue({ id: 1, pillar: { character: { adventureId: ADV_ID } } })
            mockPrisma.ability.delete.mockResolvedValue({})
            const res = await withAuth(request(app).delete('/api/abilities/1'))
            expect(res.status).toBe(204)
        })
    })

    describe('POST /api/characters/:id/use-ability', () => {
        beforeEach(() => {
            mockPrisma.character.findUnique.mockResolvedValue({ id: 1, type: 'player_character', adventureId: ADV_ID })
        })

        it('retorna 400 sem abilityId', async () => {
            const res = await withAuth(
                request(app).post('/api/characters/1/use-ability').send({})
            )
            expect(res.status).toBe(400)
        })

        it('retorna 404 quando personagem pertence a outra aventura', async () => {
            mockPrisma.character.findUnique.mockResolvedValue({ id: 1, type: 'player_character', adventureId: 999 })
            const res = await withAuth(
                request(app).post('/api/characters/1/use-ability').send({ abilityId: 1 })
            )
            expect(res.status).toBe(404)
        })

        it('retorna 404 quando habilidade não existe', async () => {
            mockPrisma.ability.findUnique.mockResolvedValue(null)
            const res = await withAuth(
                request(app).post('/api/characters/1/use-ability').send({ abilityId: 99 })
            )
            expect(res.status).toBe(404)
        })

        it('retorna 403 quando habilidade pertence a outro personagem', async () => {
            mockPrisma.ability.findUnique.mockResolvedValue({
                id: 1, custo: 3,
                pillar: { id: 1, characterId: 2, actualMana: 10 },
            })
            const res = await withAuth(
                request(app).post('/api/characters/1/use-ability').send({ abilityId: 1 })
            )
            expect(res.status).toBe(403)
        })

        it('retorna 400 com mana insuficiente', async () => {
            mockPrisma.ability.findUnique.mockResolvedValue({
                id: 1, custo: 10,
                pillar: { id: 1, characterId: 1, actualMana: 3 },
            })
            const res = await withAuth(
                request(app).post('/api/characters/1/use-ability').send({ abilityId: 1 })
            )
            expect(res.status).toBe(400)
        })

        it('usa habilidade, decrementa mana e retorna pillar atualizado', async () => {
            mockPrisma.ability.findUnique.mockResolvedValue({
                id: 1, nome: 'Fireball', custo: 5,
                pillar: { id: 1, characterId: 1, actualMana: 10 },
            })
            mockPrisma.pillar.update.mockResolvedValue({ id: 1, actualMana: 5 })

            const res = await withAuth(
                request(app).post('/api/characters/1/use-ability').send({ abilityId: 1 })
            )
            expect(res.status).toBe(200)
            expect(res.body.pillar.actualMana).toBe(5)
        })

        it('retorna diceRoll quando dano tem notacao valida', async () => {
            mockPrisma.ability.findUnique.mockResolvedValue({
                id: 1, nome: 'Fireball', dano: '2d6+3', custo: 5,
                pillar: { id: 1, characterId: 1, actualMana: 10 },
            })
            mockPrisma.pillar.update.mockResolvedValue({ id: 1, actualMana: 5 })

            const res = await withAuth(
                request(app).post('/api/characters/1/use-ability').send({ abilityId: 1 })
            )
            expect(res.status).toBe(200)
            expect(res.body.diceRoll).toBeTruthy()
            expect(res.body.diceRoll.notation).toBe('2d6+3')
        })

        it('retorna diceRoll null quando dano nao e notacao valida', async () => {
            mockPrisma.ability.findUnique.mockResolvedValue({
                id: 1, nome: 'Passiva', dano: 'especial', custo: 0,
                pillar: { id: 1, characterId: 1, actualMana: 10 },
            })
            mockPrisma.pillar.update.mockResolvedValue({ id: 1, actualMana: 10 })

            const res = await withAuth(
                request(app).post('/api/characters/1/use-ability').send({ abilityId: 1 })
            )
            expect(res.status).toBe(200)
            expect(res.body.diceRoll).toBeNull()
        })
    })
})

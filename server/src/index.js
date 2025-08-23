require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const app = express()

app.use(cors());
app.use(express.json())

// Healthcheck
app.get('/api/health', (_, res) => res.json({ ok: true }))

// ================= Characters =================
app.get("/api/characters", async (req, res, next) => {
    try {
        const list = await prisma.character.findMany({
            include: { pillars: { include: { abilities: true }} }
        });
        res.json(list);
    } catch (e) { next(e); }
});

app.get('/api/characters/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const char = await prisma.character.findUnique({ where: { id },
            include: { pillars: { include: { abilities: true }}} })
        if (!char) return res.status(404).json({ error: 'Personagem não encontrado' })
        res.json(char)
    } catch (e) { next(e) }
})

app.post('/api/characters', async (req, res, next) => {
    try {
        const { name, pillars = [] } = req.body;

        if (!name) return res.status(400).json({ error: 'name é obrigatório' });

        // Cria o personagem com os pilares
        const createdCharacter = await prisma.character.create({
            data: {
                nome: name,
                pillars: {
                    create: pillars.map(p => ({
                        nome: p.name,
                        tipo: p.type,
                        mana: p.mana
                    }))
                }
            },
            include: { pillars: true } // retorna os pilares junto
        });

        res.status(201).json(createdCharacter);

    } catch (e) {
        console.log(`ERRO AO CRIAR PERSONAGEM: ${e.message}`)
        next(e);
    }
});

// Deletar Personagem
app.delete("/api/characters/:id", async (req, res, next) => {
    try {
        const { id } = req.params;

        const deleted = await prisma.character.delete({
            where: { id: Number(id) }
        });

        res.json({ message: "Personagem deletado", deleted });
    } catch (e) {
        next(e);
    }
});


// ================= Abilitites  =================

// Listar habilidades
app.get('/api/abilities', async (req, res, next) => {
    try {
        const list = await prisma.ability.findMany({
            include: { pillars: { include: { abilities: true } } }
        });
        res.json(list);
    } catch (e) { next(e); }
});

// Cria habilidade pro usuário
app.post('/api/abilities', async (req, res, next) => {
    try {
        const { nome, descricao, dano, custo, pillarId } = req.body;

        if (!nome || !pillarId || !dano || !custo) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
        }

        const created = await prisma.ability.create({
            data: {
                nome,
                descricao,
                dano,
                custo,
                pillar: {
                    connect: { id: pillarId }
                }
            }
        });

        res.status(201).json(created);
    } catch (e) {
        next(e);
    }
});



app.patch('/api/characters/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const { name, clazz, manaMax, manaCurrent } = req.body
        const updated = await prisma.character.update({
            where: { id },
            data: { name, clazz, manaMax, manaCurrent }
        })
        res.json(updated)
    } catch (e) { next(e) }
})

app.delete('/api/characters/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        await prisma.character.delete({ where: { id } })
        res.status(204).end()
    } catch (e) { next(e) }
})

// Listar habilidades de um personagem
app.get('/api/characters/:id/abilities', async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const rels = await prisma.characterAbility.findMany({
            where: { characterId: id },
            include: { ability: true }
        })
        res.json(rels.map(r => r.ability))
    } catch (e) { next(e) }
})

// Vincular/remover habilidade
app.post('/api/characters/:id/abilities/:abilityId', async (req, res, next) => {
    try {
        const characterId = Number(req.params.id)
        const abilityId = Number(req.params.abilityId)
        await prisma.characterAbility.create({ data: { characterId, abilityId } })
        res.status(201).json({ ok: true })
    } catch (e) { next(e) }
})

app.delete('/api/characters/:id/abilities/:abilityId', async (req, res, next) => {
    try {
        const characterId = Number(req.params.id)
        const abilityId = Number(req.params.abilityId)
        await prisma.characterAbility.delete({ where: { characterId_abilityId: { characterId, abilityId } } })
        res.status(204).end()
    } catch (e) { next(e) }
})

// Usar habilidade (gastar mana)
app.post('/api/characters/:id/use-ability', async (req, res, next) => {
    const characterId = Number(req.params.id)
    const { abilityId } = req.body
    if (!abilityId) return res.status(400).json({ error: 'abilityId é obrigatório' })

    try {
        const ability = await prisma.ability.findUnique({ where: { id: Number(abilityId) } })
        if (!ability) return res.status(404).json({ error: 'Habilidade não encontrada' })

        const hasLink = await prisma.characterAbility.findUnique({
            where: { characterId_abilityId: { characterId, abilityId: ability.id } }
        })
        if (!hasLink) return res.status(400).json({ error: 'Personagem não possui esta habilidade' })

        const result = await prisma.$transaction(async (tx) => {
            const char = await tx.character.findUnique({ where: { id: characterId } })
            if (!char) throw new Error('Personagem não encontrado')
            if (char.manaCurrent < ability.manaCost) {
                return { error: 'Mana insuficiente', character: char }
            }

            const updated = await tx.character.update({
                where: { id: characterId },
                data: { manaCurrent: char.manaCurrent - ability.manaCost }
            })

            await tx.manaLog.create({
                data: { characterId, abilityId: ability.id, change: -ability.manaCost }
            })

            return { character: updated }
        })

        if (result.error) return res.status(400).json(result)
        res.json(result.character)
    } catch (e) { next(e) }
})

// Recuperar mana
app.post('/api/characters/:id/regain-mana', async (req, res, next) => {
    const characterId = Number(req.params.id)
    const { amount = 10 } = req.body
    try {
        const updated = await prisma.$transaction(async (tx) => {
            const c = await tx.character.findUnique({ where: { id: characterId } })
            if (!c) throw new Error('Personagem não encontrado')
            const newMana = Math.min(c.manaCurrent + Number(amount), c.manaMax)
            const u = await tx.character.update({ where: { id: characterId }, data: { manaCurrent: newMana } })
            await tx.manaLog.create({ data: { characterId, abilityId: 0, change: Number(amount) } })
            return u
        })
        res.json(updated)
    } catch (e) { next(e) }
})


app.listen( 3001, () => {
    console.log(`API rodando em http://localhost:3001`);
});
require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')
const { randomUUID } = require('crypto')

const prisma = new PrismaClient()
const app = express()

app.use(cors());
app.use(express.json())

// Request logging
app.use((req, res, next) => {
    const requestId = randomUUID()
    const start = process.hrtime.bigint()
    req.requestId = requestId

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6
        const log = {
            level: 'info',
            requestId,
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            duration_ms: Math.round(durationMs),
            ip: req.ip,
        }
        console.log(JSON.stringify(log))
    })

    next()
})

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
        const { name, maxHp, actualHp, hp, pillars = [] } = req.body;

        if (!name) return res.status(400).json({ error: 'name e obrigatorio' });

        const resolvedMaxHp = maxHp ?? hp;
        let maxHpValue = 0;
        if (resolvedMaxHp !== undefined) {
            const parsedMaxHp = Number(resolvedMaxHp);
            if (!Number.isFinite(parsedMaxHp)) {
                return res.status(400).json({ error: 'maxHp deve ser um numero valido' });
            }
            maxHpValue = parsedMaxHp;
        }

        let actualHpValue = maxHpValue;
        if (actualHp !== undefined) {
            const parsedActualHp = Number(actualHp);
            if (!Number.isFinite(parsedActualHp)) {
                return res.status(400).json({ error: 'actualHp deve ser um numero valido' });
            }
            actualHpValue = parsedActualHp;
        }

        const pillarPayload = [];
        for (const p of pillars) {
            const resolvedMaxMana = p.maxMana ?? p.mana;
            let maxManaValue = 0;
            if (resolvedMaxMana !== undefined) {
                const parsedMaxMana = Number(resolvedMaxMana);
                if (!Number.isFinite(parsedMaxMana)) {
                    return res.status(400).json({ error: 'maxMana deve ser um numero valido' });
                }
                maxManaValue = parsedMaxMana;
            }

            let actualManaValue = maxManaValue;
            if (p.actualMana !== undefined) {
                const parsedActualMana = Number(p.actualMana);
                if (!Number.isFinite(parsedActualMana)) {
                    return res.status(400).json({ error: 'actualMana deve ser um numero valido' });
                }
                actualManaValue = parsedActualMana;
            }

            pillarPayload.push({
                nome: p.name,
                tipo: p.type,
                maxMana: maxManaValue,
                actualMana: actualManaValue
            });
        }

        // Cria o personagem com os pilares
        const createdCharacter = await prisma.character.create({
            data: {
                nome: name,
                maxHp: maxHpValue,
                actualHp: actualHpValue,
                pillars: {
                    create: pillarPayload
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
            include: { pillar: true }
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
        const { name, maxHp, actualHp, hp } = req.body
        const data = {}
        if (name) data.nome = name
        if (maxHp !== undefined || hp !== undefined) {
            const parsedMaxHp = Number(maxHp ?? hp)
            if (!Number.isFinite(parsedMaxHp)) {
                return res.status(400).json({ error: 'maxHp deve ser um numero valido' })
            }
            data.maxHp = parsedMaxHp
            if (actualHp === undefined && hp !== undefined) {
                data.actualHp = parsedMaxHp
            }
        }
        if (actualHp !== undefined) {
            const parsedActualHp = Number(actualHp)
            if (!Number.isFinite(parsedActualHp)) {
                return res.status(400).json({ error: 'actualHp deve ser um numero valido' })
            }
            data.actualHp = parsedActualHp
        }
        if (!Object.keys(data).length) {
            return res.status(400).json({ error: 'name, maxHp ou actualHp sao obrigatorios' })
        }
        const updated = await prisma.character.update({
            where: { id },
            data
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
        const abilities = await prisma.ability.findMany({
            where: { pillar: { characterId: id } }
        })
        res.json(abilities)
    } catch (e) { next(e) }
})

// Vincular/remover habilidade
app.post('/api/characters/:id/abilities/:abilityId', async (req, res, next) => {
    res.status(501).json({ error: 'Endpoint requer relacionamento many-to-many que nao existe no schema atual.' })
})

app.delete('/api/abilities/:abilityId', async (req, res, next) => {
    try {

        const abilityId = Number(req.params.abilityId)

        await prisma.ability.delete({ where: { id: abilityId } })

        res.status(204).end()

    } catch (e) { next(e) }
})

// Usar habilidade (gastar mana)
app.post('/api/characters/:id/use-ability', async (req, res, next) => {
    res.status(501).json({ error: 'Endpoint requer campos e modelos que nao existem no schema atual.' })
})

// Recuperar mana
app.post('/api/characters/:id/regain-mana', async (req, res, next) => {
    res.status(501).json({ error: 'Endpoint requer campos e modelos que nao existem no schema atual.' })
})

// Error logging
app.use((err, req, res, next) => {
    const log = {
        level: 'error',
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        message: err?.message || 'Unhandled error',
    }
    console.error(JSON.stringify(log))
    res.status(500).json({ error: 'Erro interno do servidor' })
})

app.listen( 3001, () => {
    console.log(`API rodando em http://localhost:3001`);
});




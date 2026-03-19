import 'dotenv/config';
const express = require('express')
const cors = require('cors')
const { PrismaClient } = require('@prisma/client')
const { randomUUID } = require('crypto')

import path from 'path';
import { fileURLToPath } from 'url';

const logger = require('./logger')
const isDev = process.env.NODE_ENV !== 'production'
const authMiddleware = require('./middleware/auth')
const authRouter = require('./routes/auth')
const usersRouter = require('./routes/users')

const prisma = new PrismaClient()
const app = express()

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve os arquivos buildados do Vite
app.use(express.static(path.join(__dirname, '../../client/dist')));

// Fallback para o React Router funcionar
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});

app.use(cors());
app.use(express.json())

// Request logging
app.use((req, res, next) => {
    const requestId = randomUUID()
    const start = process.hrtime.bigint()
    req.requestId = requestId

    res.on('finish', () => {
        const durationMs = Number(process.hrtime.bigint() - start) / 1e6
        const status = res.statusCode
        const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
        logger[level](`${req.method} ${req.originalUrl} ${status}`, {
            requestId,
            dur: `${Math.round(durationMs)}ms`,
            ip: req.ip,
            user: req.user?.username,
        })
    })

    next()
})

// ================= Rotas Públicas =================

app.get('/api/health', (_, res) => res.json({ ok: true }))

app.post('/api/logs', (req, res) => {
    const { level, message, data = {} } = req.body
    const validLevels = ['debug', 'info', 'warn', 'error']
    const safeLevel = validLevels.includes(level) ? level : 'info'
    logger[safeLevel](`[client] ${message}`, data)
    res.status(204).end()
})

app.use('/api/auth', authRouter)

// ================= Gerenciamento de Usuários (Admin) =================

app.use('/api/users', usersRouter)

// ================= Rotas Protegidas (Basic Auth) =================

app.use(authMiddleware)

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

        const createdCharacter = await prisma.character.create({
            data: {
                nome: name,
                maxHp: maxHpValue,
                actualHp: actualHpValue,
                pillars: {
                    create: pillarPayload
                }
            },
            include: { pillars: true }
        });

        logger.info('personagem criado', { id: createdCharacter.id, nome: createdCharacter.nome, requestId: req.requestId })
        res.status(201).json(createdCharacter);

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

app.delete("/api/characters/:id", async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        await prisma.character.delete({ where: { id } })
        logger.info('personagem deletado', { id, requestId: req.requestId })
        res.status(204).end()
    } catch (e) {
        next(e);
    }
});

// ================= Abilities =================

app.get('/api/abilities', async (req, res, next) => {
    try {
        const list = await prisma.ability.findMany({
            include: { pillar: true }
        });
        res.json(list);
    } catch (e) { next(e); }
});

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

app.delete('/api/abilities/:abilityId', async (req, res, next) => {
    try {
        const abilityId = Number(req.params.abilityId)
        await prisma.ability.delete({ where: { id: abilityId } })
        res.status(204).end()
    } catch (e) { next(e) }
})

// ================= Character Abilities =================

app.get('/api/characters/:id/abilities', async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const abilities = await prisma.ability.findMany({
            where: { pillar: { characterId: id } }
        })
        res.json(abilities)
    } catch (e) { next(e) }
})

app.post('/api/characters/:id/abilities/:abilityId', async (req, res, next) => {
    res.status(501).json({ error: 'Endpoint requer relacionamento many-to-many que nao existe no schema atual.' })
})

app.post('/api/characters/:id/use-ability', async (req, res, next) => {
    try {
        const characterId = Number(req.params.id)
        const { abilityId } = req.body

        if (!abilityId) {
            return res.status(400).json({ error: 'abilityId e obrigatorio' })
        }

        const ability = await prisma.ability.findUnique({
            where: { id: Number(abilityId) },
            include: { pillar: true }
        })

        if (!ability) {
            return res.status(404).json({ error: 'Habilidade nao encontrada' })
        }

        if (ability.pillar.characterId !== characterId) {
            return res.status(403).json({ error: 'Habilidade nao pertence a este personagem' })
        }

        if (ability.pillar.actualMana < ability.custo) {
            return res.status(400).json({ error: 'Mana insuficiente' })
        }

        const updatedPillar = await prisma.pillar.update({
            where: { id: ability.pillar.id },
            data: { actualMana: ability.pillar.actualMana - ability.custo }
        })

        logger.info('habilidade usada', {
            characterId,
            abilityId: ability.id,
            nome: ability.nome,
            custo: ability.custo,
            manaRestante: updatedPillar.actualMana,
            requestId: req.requestId,
        })
        res.json({ pillar: updatedPillar, ability })
    } catch (e) { next(e) }
})

app.post('/api/characters/:id/regain-mana', async (req, res, next) => {
    res.status(501).json({ error: 'Endpoint requer campos e modelos que nao existem no schema atual.' })
})

app.post('/api/characters/:id/rest', async (req, res, next) => {
    try {
        const characterId = Number(req.params.id)
        const { type } = req.body

        if (!['short', 'long'].includes(type)) {
            return res.status(400).json({ error: 'type deve ser "short" ou "long"' })
        }

        const character = await prisma.character.findUnique({
            where: { id: characterId },
            include: { pillars: true }
        })

        if (!character) {
            return res.status(404).json({ error: 'Personagem nao encontrado' })
        }

        const newHp = type === 'long'
            ? character.maxHp
            : Math.min(character.maxHp, character.actualHp + Math.floor(character.maxHp / 2))

        const updatedCharacter = await prisma.character.update({
            where: { id: characterId },
            data: { actualHp: newHp }
        })

        const updatedPillars = await Promise.all(
            character.pillars.map((pillar) => {
                const newMana = type === 'long'
                    ? pillar.maxMana
                    : Math.min(pillar.maxMana, pillar.actualMana + Math.floor(pillar.maxMana / 2))
                return prisma.pillar.update({
                    where: { id: pillar.id },
                    data: { actualMana: newMana }
                })
            })
        )

        logger.info('descanso realizado', {
            characterId,
            type,
            hpAntes: character.actualHp,
            hpDepois: updatedCharacter.actualHp,
            requestId: req.requestId,
        })
        res.json({ character: updatedCharacter, pillars: updatedPillars })
    } catch (e) { next(e) }
})

// ================= Error Handler =================

app.use((err, req, res, next) => {
    logger.error(err?.message || 'Unhandled error', {
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        stack: isDev ? err?.stack?.split('\n')[1]?.trim() : undefined,
    })
    res.status(500).json({ error: 'Erro interno do servidor' })
})

app.listen(3001, () => {
    logger.info('servidor iniciado', { port: 3001, env: process.env.NODE_ENV || 'development' })
});

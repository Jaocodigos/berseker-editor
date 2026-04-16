import dotenv from 'dotenv'
dotenv.config({ override: false })

import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import path from 'path'
import { fileURLToPath } from 'url'

import logger from './logger.js'
import authMiddleware from './middleware/auth.js'
import masterOnly from './middleware/masterOnly.js'
import adventureMiddleware from './middleware/adventure.js'
import authRouter from './routes/auth.js'
import usersRouter from './routes/users.js'
import adventuresRouter from './routes/adventures.js'
import { rollDice } from './utils/dice.js'
import { saveRoll, getRolls } from './store/diceRolls.js'

const prisma = new PrismaClient()
const app = express()
const isDev = process.env.NODE_ENV !== 'production'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())
app.use(cookieParser())

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
app.use('/api/adventures', adventuresRouter)

// ================= Serve frontend (produção) =================

app.use(express.static(path.join(__dirname, '../../client/dist')))

app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'))
})

// ================= Rotas Protegidas (Auth) =================

app.use(authMiddleware)

// ================= Selecao de Aventura (requer auth, NAO requer aventura) =================

const adventureCookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
}

app.post('/api/adventures/:id/select', async (req, res, next) => {
    try {
        const adventureId = Number(req.params.id)

        const membership = await prisma.adventureUser.findUnique({
            where: { userId_adventureId: { userId: req.user.id, adventureId } },
            include: { adventure: true }
        })

        if (!membership) {
            return res.status(403).json({ error: 'Voce nao pertence a esta aventura' })
        }

        res.cookie('adventure', String(adventureId), { ...adventureCookieOptions, maxAge: 24 * 60 * 60 * 1000 })
        res.json({ adventure: { id: membership.adventure.id, nome: membership.adventure.nome }, role: membership.role })
    } catch (e) { next(e) }
})

app.post('/api/adventures/deselect', (req, res) => {
    res.clearCookie('adventure', adventureCookieOptions)
    res.status(204).end()
})

// ================= Adventure Wall =================

app.use(adventureMiddleware)

// ================= Characters =================

app.get("/api/characters", async (req, res, next) => {
    try {
        const isMaster = req.adventureRole === 'master'
        const typeFilter = req.query.type
        let where = { adventureId: req.adventure.id }

        if (typeFilter) {
            if (typeFilter === 'enemy' && !isMaster) {
                return res.json([])
            }
            where.type = typeFilter
        } else {
            if (!isMaster) {
                where.type = 'player_character'
            }
        }

        const list = await prisma.character.findMany({
            where,
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
        if (!char || char.adventureId !== req.adventure.id) return res.status(404).json({ error: 'Personagem não encontrado' })
        res.json(char)
    } catch (e) { next(e) }
})

app.post('/api/characters', async (req, res, next) => {
    try {
        const { name, type = 'player_character', maxHp, actualHp, hp, pillars = [], xp = 0, level = 1, pillarXp = 0, pillarLevel = 1 } = req.body;

        if (!name) return res.status(400).json({ error: 'name e obrigatorio' });

        if (!['player_character', 'enemy'].includes(type)) {
            return res.status(400).json({ error: 'type deve ser "player_character" ou "enemy"' });
        }

        if (type === 'enemy' && req.adventureRole !== 'master') {
            return res.status(403).json({ error: 'Apenas o mestre pode criar inimigos' });
        }

        if (pillars.length > 3) {
            return res.status(400).json({ error: 'um personagem pode ter no maximo 3 pilares' });
        }

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

        const xpValue = Number(xp);
        if (!Number.isFinite(xpValue)) {
            return res.status(400).json({ error: 'xp deve ser um numero valido' });
        }

        const levelValue = Number(level);
        if (!Number.isFinite(levelValue)) {
            return res.status(400).json({ error: 'level deve ser um numero valido' });
        }

        const pillarXpValue = Number(pillarXp);
        if (!Number.isFinite(pillarXpValue)) {
            return res.status(400).json({ error: 'pillarXp deve ser um numero valido' });
        }

        const pillarLevelValue = Number(pillarLevel);
        if (!Number.isFinite(pillarLevelValue)) {
            return res.status(400).json({ error: 'pillarLevel deve ser um numero valido' });
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
                type,
                adventureId: req.adventure.id,
                maxHp: maxHpValue,
                actualHp: actualHpValue,
                xp: xpValue,
                level: levelValue,
                pillarXp: pillarXpValue,
                pillarLevel: pillarLevelValue,
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
        const character = await prisma.character.findUnique({ where: { id } })
        if (!character || character.adventureId !== req.adventure.id) return res.status(404).json({ error: 'Personagem não encontrado' })
        if (character.type === 'enemy' && req.adventureRole !== 'master') {
            return res.status(403).json({ error: 'Apenas o mestre pode editar inimigos' })
        }
        const { name, maxHp, actualHp, hp, xp, level, pillarXp, pillarLevel } = req.body
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
        if (xp !== undefined) {
            const parsedXp = Number(xp)
            if (!Number.isFinite(parsedXp)) {
                return res.status(400).json({ error: 'xp deve ser um numero valido' })
            }
            data.xp = parsedXp
        }
        if (level !== undefined) {
            const parsedLevel = Number(level)
            if (!Number.isFinite(parsedLevel)) {
                return res.status(400).json({ error: 'level deve ser um numero valido' })
            }
            data.level = parsedLevel
        }
        if (pillarXp !== undefined) {
            const parsedPillarXp = Number(pillarXp)
            if (!Number.isFinite(parsedPillarXp)) {
                return res.status(400).json({ error: 'pillarXp deve ser um numero valido' })
            }
            data.pillarXp = parsedPillarXp
        }
        if (pillarLevel !== undefined) {
            const parsedPillarLevel = Number(pillarLevel)
            if (!Number.isFinite(parsedPillarLevel)) {
                return res.status(400).json({ error: 'pillarLevel deve ser um numero valido' })
            }
            data.pillarLevel = parsedPillarLevel
        }
        if (!Object.keys(data).length) {
            return res.status(400).json({ error: 'name, maxHp, actualHp ou xp sao obrigatorios' })
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
        const character = await prisma.character.findUnique({ where: { id } })
        if (!character || character.adventureId !== req.adventure.id) return res.status(404).json({ error: 'Personagem não encontrado' })
        if (character.type === 'enemy' && req.adventureRole !== 'master') {
            return res.status(403).json({ error: 'Apenas o mestre pode deletar inimigos' })
        }
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
            where: { pillar: { character: { adventureId: req.adventure.id } } },
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

        const pillar = await prisma.pillar.findUnique({
            where: { id: pillarId },
            include: { character: true }
        })
        if (!pillar || pillar.character.adventureId !== req.adventure.id) {
            return res.status(404).json({ error: 'Pilar nao encontrado' })
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

app.put('/api/abilities/:abilityId', async (req, res, next) => {
    try {
        const abilityId = Number(req.params.abilityId)
        const { nome, descricao, dano, custo } = req.body

        if (!nome || !dano || custo === undefined || custo === null) {
            return res.status(400).json({ error: 'Todos os campos são obrigatórios.' })
        }

        const ability = await prisma.ability.findUnique({
            where: { id: abilityId },
            include: { pillar: { include: { character: true } } }
        })
        if (!ability || ability.pillar.character.adventureId !== req.adventure.id) {
            return res.status(404).json({ error: 'Habilidade nao encontrada' })
        }

        const updated = await prisma.ability.update({
            where: { id: abilityId },
            data: { nome, descricao, dano, custo }
        })

        res.json(updated)
    } catch (e) { next(e) }
})

app.delete('/api/abilities/:abilityId', async (req, res, next) => {
    try {
        const abilityId = Number(req.params.abilityId)

        const ability = await prisma.ability.findUnique({
            where: { id: abilityId },
            include: { pillar: { include: { character: true } } }
        })
        if (!ability || ability.pillar.character.adventureId !== req.adventure.id) {
            return res.status(404).json({ error: 'Habilidade nao encontrada' })
        }

        await prisma.ability.delete({ where: { id: abilityId } })
        res.status(204).end()
    } catch (e) { next(e) }
})

// ================= Pillars =================

app.patch('/api/pillars/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id)

        const pillar = await prisma.pillar.findUnique({ where: { id }, include: { character: true } })
        if (!pillar || pillar.character.adventureId !== req.adventure.id) {
            return res.status(404).json({ error: 'Pilar nao encontrado' })
        }

        const { nome, tipo, maxMana, actualMana } = req.body
        const data = {}
        if (nome !== undefined) data.nome = nome
        if (tipo !== undefined) data.tipo = tipo
        if (maxMana !== undefined) {
            const parsed = Number(maxMana)
            if (!Number.isFinite(parsed)) return res.status(400).json({ error: 'maxMana deve ser um numero valido' })
            data.maxMana = parsed
        }
        if (actualMana !== undefined) {
            const parsed = Number(actualMana)
            if (!Number.isFinite(parsed)) return res.status(400).json({ error: 'actualMana deve ser um numero valido' })
            data.actualMana = parsed
        }
        if (!Object.keys(data).length) return res.status(400).json({ error: 'Nenhum campo fornecido' })
        const updated = await prisma.pillar.update({ where: { id }, data })
        res.json(updated)
    } catch (e) { next(e) }
})

app.post('/api/characters/:id/pillars', async (req, res, next) => {
    try {
        const characterId = Number(req.params.id)
        const charCheck = await prisma.character.findUnique({ where: { id: characterId } })
        if (!charCheck || charCheck.adventureId !== req.adventure.id) {
            return res.status(404).json({ error: 'Personagem nao encontrado' })
        }
        const { name, type, maxMana = 0, actualMana } = req.body
        if (!name || !type) return res.status(400).json({ error: 'name e type sao obrigatorios' })
        const existingCount = await prisma.pillar.count({ where: { characterId } })
        if (existingCount >= 3) return res.status(400).json({ error: 'um personagem pode ter no maximo 3 pilares' })
        const maxManaValue = Number(maxMana)
        if (!Number.isFinite(maxManaValue)) return res.status(400).json({ error: 'maxMana deve ser um numero valido' })
        const actualManaValue = actualMana !== undefined ? Number(actualMana) : maxManaValue
        const created = await prisma.pillar.create({
            data: { nome: name, tipo: type, maxMana: maxManaValue, actualMana: actualManaValue, characterId }
        })
        res.status(201).json(created)
    } catch (e) { next(e) }
})

app.delete('/api/pillars/:id', async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const pillar = await prisma.pillar.findUnique({ where: { id }, include: { character: true } })
        if (!pillar || pillar.character.adventureId !== req.adventure.id) {
            return res.status(404).json({ error: 'Pilar nao encontrado' })
        }
        await prisma.pillar.delete({ where: { id } })
        res.status(204).end()
    } catch (e) { next(e) }
})

// ================= Character Abilities =================

app.get('/api/characters/:id/abilities', async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const character = await prisma.character.findUnique({ where: { id } })
        if (!character || character.adventureId !== req.adventure.id) {
            return res.status(404).json({ error: 'Personagem nao encontrado' })
        }
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

        const targetChar = await prisma.character.findUnique({ where: { id: characterId } })
        if (!targetChar || targetChar.adventureId !== req.adventure.id) return res.status(404).json({ error: 'Personagem nao encontrado' })
        if (targetChar.type === 'enemy' && req.adventureRole !== 'master') {
            return res.status(403).json({ error: 'Apenas o mestre pode usar habilidades de inimigos' })
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

        const diceRoll = rollDice(ability.dano)
        if (diceRoll) {
            saveRoll(characterId, { abilityName: ability.nome, ...diceRoll })
        }

        logger.info('habilidade usada', {
            characterId,
            abilityId: ability.id,
            nome: ability.nome,
            custo: ability.custo,
            manaRestante: updatedPillar.actualMana,
            diceRoll: diceRoll ? diceRoll.total : null,
            requestId: req.requestId,
        })
        res.json({ pillar: updatedPillar, ability, diceRoll: diceRoll || null })
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

        const charCheck = await prisma.character.findUnique({ where: { id: characterId } })
        if (!charCheck || charCheck.adventureId !== req.adventure.id) return res.status(404).json({ error: 'Personagem nao encontrado' })
        if (charCheck.type === 'enemy' && req.adventureRole !== 'master') {
            return res.status(403).json({ error: 'Apenas o mestre pode descansar inimigos' })
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

// ================= Adventure Enemies =================

app.get('/api/adventure/enemies', async (req, res, next) => {
    try {
        const isMaster = req.adventureRole === 'master'

        if (isMaster) {
            const enemies = await prisma.character.findMany({
                where: { type: 'enemy', inAdventure: true, adventureId: req.adventure.id },
                include: { pillars: { include: { abilities: true } } }
            })
            return res.json(enemies)
        }

        const enemies = await prisma.character.findMany({
            where: { type: 'enemy', inAdventure: true, adventureId: req.adventure.id },
            select: { id: true, nome: true }
        })
        res.json(enemies)
    } catch (e) { next(e) }
})

app.get('/api/adventure/dice-rolls', (req, res) => {
    const raw = req.query.characterIds
    if (!raw) return res.json({})

    const characterIds = String(raw).split(',').map(Number).filter(Number.isFinite)
    if (characterIds.length === 0) return res.json({})

    res.json(getRolls(characterIds))
})

app.post('/api/characters/:id/join-adventure', masterOnly, async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const character = await prisma.character.findUnique({ where: { id } })
        if (!character || character.adventureId !== req.adventure.id) return res.status(404).json({ error: 'Personagem não encontrado' })
        if (character.type !== 'enemy') {
            return res.status(400).json({ error: 'Apenas inimigos podem ser colocados na aventura pelo mestre' })
        }
        const updated = await prisma.character.update({
            where: { id },
            data: { inAdventure: true },
            include: { pillars: { include: { abilities: true } } }
        })
        logger.info('inimigo entrou na aventura', { id, nome: updated.nome, requestId: req.requestId })
        res.json(updated)
    } catch (e) { next(e) }
})

app.post('/api/characters/:id/leave-adventure', masterOnly, async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const character = await prisma.character.findUnique({ where: { id } })
        if (!character || character.adventureId !== req.adventure.id) return res.status(404).json({ error: 'Personagem não encontrado' })
        if (character.type !== 'enemy') {
            return res.status(400).json({ error: 'Apenas inimigos podem ser removidos da aventura pelo mestre' })
        }
        const updated = await prisma.character.update({
            where: { id },
            data: { inAdventure: false }
        })
        logger.info('inimigo saiu da aventura', { id, nome: updated.nome, requestId: req.requestId })
        res.json(updated)
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

export { app }

if (process.env.NODE_ENV !== 'test') {
    app.listen(3001, () => {
        logger.info('servidor iniciado', { port: 3001, env: process.env.NODE_ENV || 'development' })
    })
}

import express from 'express'
import prisma from '../db.js'
import logger from '../logger.js'
import masterOnly from '../middleware/masterOnly.js'

const router = express.Router()

const COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/

router.get('/', async (req, res, next) => {
    try {
        const titles = await prisma.title.findMany({
            where: { adventureId: req.adventure.id },
            orderBy: { nome: 'asc' },
        })
        res.json(titles)
    } catch (e) { next(e) }
})

router.post('/', masterOnly, async (req, res, next) => {
    try {
        const { nome, color } = req.body
        if (!nome || typeof nome !== 'string' || !nome.trim()) {
            return res.status(400).json({ error: 'nome e obrigatorio' })
        }
        if (!color || !COLOR_REGEX.test(color)) {
            return res.status(400).json({ error: 'color deve estar no formato #RRGGBB' })
        }

        const title = await prisma.title.create({
            data: { nome: nome.trim(), color, adventureId: req.adventure.id },
        })

        logger.info('titulo criado', { id: title.id, adventureId: req.adventure.id })
        res.status(201).json(title)
    } catch (e) { next(e) }
})

router.patch('/:id', masterOnly, async (req, res, next) => {
    try {
        const id = Number(req.params.id)
        const { nome, color } = req.body

        const existing = await prisma.title.findUnique({ where: { id } })
        if (!existing || existing.adventureId !== req.adventure.id) {
            return res.status(404).json({ error: 'Titulo nao encontrado' })
        }

        const data = {}
        if (nome !== undefined) {
            if (typeof nome !== 'string' || !nome.trim()) {
                return res.status(400).json({ error: 'nome invalido' })
            }
            data.nome = nome.trim()
        }
        if (color !== undefined) {
            if (!COLOR_REGEX.test(color)) {
                return res.status(400).json({ error: 'color deve estar no formato #RRGGBB' })
            }
            data.color = color
        }

        const title = await prisma.title.update({ where: { id }, data })
        logger.info('titulo atualizado', { id })
        res.json(title)
    } catch (e) { next(e) }
})

router.delete('/:id', masterOnly, async (req, res, next) => {
    try {
        const id = Number(req.params.id)

        const existing = await prisma.title.findUnique({ where: { id } })
        if (!existing || existing.adventureId !== req.adventure.id) {
            return res.status(404).json({ error: 'Titulo nao encontrado' })
        }

        await prisma.title.delete({ where: { id } })
        logger.info('titulo deletado', { id })
        res.status(204).end()
    } catch (e) { next(e) }
})

export default router

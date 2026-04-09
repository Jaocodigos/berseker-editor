import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import masterOnly from '../../middleware/masterOnly.js'

function buildApp(role) {
    const app = express()
    app.use((req, _res, next) => {
        req.user = { id: 1, username: 'test', role }
        next()
    })
    app.get('/test', masterOnly, (_req, res) => res.json({ ok: true }))
    return app
}

describe('masterOnly middleware', () => {
    it('retorna 403 para player', async () => {
        const res = await request(buildApp('player')).get('/test')
        expect(res.status).toBe(403)
        expect(res.body.error).toBe('Acesso restrito ao mestre')
    })

    it('permite acesso ao master', async () => {
        const res = await request(buildApp('master')).get('/test')
        expect(res.status).toBe(200)
        expect(res.body.ok).toBe(true)
    })

    it('retorna 403 quando role é undefined', async () => {
        const app = express()
        app.use((req, _res, next) => {
            req.user = { id: 1, username: 'test' }
            next()
        })
        app.get('/test', masterOnly, (_req, res) => res.json({ ok: true }))
        const res = await request(app).get('/test')
        expect(res.status).toBe(403)
    })
})

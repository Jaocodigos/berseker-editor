import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'

vi.mock('../../logger.js', () => ({
    default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import adminAuthMiddleware from '../../middleware/adminAuth.js'

const testApp = express()
testApp.get('/admin', adminAuthMiddleware, (req, res) => res.json({ ok: true }))

describe('adminAuthMiddleware', () => {
    const origToken = process.env.ADMIN_TOKEN

    beforeEach(() => {
        process.env.ADMIN_TOKEN = 'secret-token'
    })

    afterEach(() => {
        process.env.ADMIN_TOKEN = origToken
    })

    it('retorna 500 se ADMIN_TOKEN não está configurado', async () => {
        delete process.env.ADMIN_TOKEN
        const res = await request(testApp).get('/admin')
        expect(res.status).toBe(500)
        expect(res.body.error).toMatch(/ADMIN_TOKEN/)
    })

    it('retorna 403 sem header Authorization', async () => {
        const res = await request(testApp).get('/admin')
        expect(res.status).toBe(403)
        expect(res.body.error).toBe('Acesso restrito ao administrador')
    })

    it('retorna 403 com formato invalido (sem Bearer)', async () => {
        const res = await request(testApp)
            .get('/admin')
            .set('Authorization', 'secret-token')
        expect(res.status).toBe(403)
    })

    it('retorna 403 com token incorreto', async () => {
        const res = await request(testApp)
            .get('/admin')
            .set('Authorization', 'Bearer wrong')
        expect(res.status).toBe(403)
    })

    it('autoriza com Bearer token correto', async () => {
        const res = await request(testApp)
            .get('/admin')
            .set('Authorization', 'Bearer secret-token')
        expect(res.status).toBe(200)
        expect(res.body.ok).toBe(true)
    })
})

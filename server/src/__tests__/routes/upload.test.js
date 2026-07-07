import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import fs from 'fs'

const { mockPrisma } = vi.hoisted(() => ({
    mockPrisma: {
        session: { findUnique: vi.fn() },
        adventureUser: { findUnique: vi.fn() },
    },
}))

vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockPrisma) }))

import { app } from '../../index.js'
import { AVATARS_DIR, MAPS_DIR } from '../../routes/upload.js'

const SESSION = 'sess-token'
const session = {
    token: SESSION,
    userId: 1,
    expiresAt: new Date(Date.now() + 3_600_000),
    user: { id: 1, username: 'player' },
}

// PNG minimo valido (1x1)
const PNG_1x1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
)

function cleanupDir(dir) {
    try {
        for (const f of fs.readdirSync(dir)) {
            fs.rmSync(`${dir}/${f}`, { force: true })
        }
    } catch { /* dir pode nao existir */ }
}
function cleanupAvatars() {
    cleanupDir(AVATARS_DIR)
    cleanupDir(MAPS_DIR)
}

describe('Upload Routes (/api/upload)', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockPrisma.session.findUnique.mockImplementation(({ where }) =>
            Promise.resolve(where.token === SESSION ? session : null)
        )
    })

    afterEach(cleanupAvatars)

    it('retorna 401 sem autenticacao', async () => {
        const res = await request(app)
            .post('/api/upload/avatar')
            .attach('image', PNG_1x1, { filename: 'a.png', contentType: 'image/png' })
        expect(res.status).toBe(401)
    })

    it('faz upload de imagem valida e retorna imageUrl', async () => {
        const res = await request(app)
            .post('/api/upload/avatar')
            .set('Cookie', `session=${SESSION}`)
            .attach('image', PNG_1x1, { filename: 'a.png', contentType: 'image/png' })
        expect(res.status).toBe(201)
        expect(res.body.imageUrl).toMatch(/^\/uploads\/avatars\/.+\.png$/)
        // arquivo realmente gravado
        const filename = res.body.imageUrl.split('/').pop()
        expect(fs.existsSync(`${AVATARS_DIR}/${filename}`)).toBe(true)
    })

    it('retorna 400 sem arquivo', async () => {
        const res = await request(app)
            .post('/api/upload/avatar')
            .set('Cookie', `session=${SESSION}`)
        expect(res.status).toBe(400)
    })

    it('retorna 400 para tipo invalido', async () => {
        const res = await request(app)
            .post('/api/upload/avatar')
            .set('Cookie', `session=${SESSION}`)
            .attach('image', Buffer.from('nao sou imagem'), { filename: 'a.txt', contentType: 'text/plain' })
        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/Formato/)
    })

    it('retorna 400 quando excede o tamanho maximo', async () => {
        const big = Buffer.alloc(6 * 1024 * 1024, 1) // 6MB > limite de 5MB
        const res = await request(app)
            .post('/api/upload/avatar')
            .set('Cookie', `session=${SESSION}`)
            .attach('image', big, { filename: 'big.png', contentType: 'image/png' })
        expect(res.status).toBe(400)
        expect(res.body.error).toMatch(/tamanho/)
    })

    it('faz upload de fundo de mapa em /uploads/maps', async () => {
        const res = await request(app)
            .post('/api/upload/map-background')
            .set('Cookie', `session=${SESSION}`)
            .attach('image', PNG_1x1, { filename: 'bg.png', contentType: 'image/png' })
        expect(res.status).toBe(201)
        expect(res.body.imageUrl).toMatch(/^\/uploads\/maps\/.+\.png$/)
        const filename = res.body.imageUrl.split('/').pop()
        expect(fs.existsSync(`${MAPS_DIR}/${filename}`)).toBe(true)
    })
})

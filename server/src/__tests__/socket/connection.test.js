import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import http from 'http'
import { io as ioClient } from 'socket.io-client'

// Mock do PrismaClient usado por socket/index.js e socket/handlers/grid.js.
const { mockDb } = vi.hoisted(() => ({
    mockDb: {
        session: { findUnique: vi.fn() },
        adventureUser: { findUnique: vi.fn() },
        gameMap: { findUnique: vi.fn() },
        token: { findUnique: vi.fn(), update: vi.fn() },
    },
}))
vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockDb) }))

import { initSocket } from '../../socket/index.js'

const ADV_ID = 7
const SESSION = 'sess-token'

let httpServer, io, port

function connect(cookie) {
    return ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
        extraHeaders: { cookie },
    })
}

describe('socket connection (integracao)', () => {
    beforeEach(async () => {
        vi.clearAllMocks()
        mockDb.session.findUnique.mockImplementation(({ where }) =>
            Promise.resolve(where.token === SESSION
                ? { token: SESSION, expiresAt: new Date(Date.now() + 3_600_000), user: { id: 1, username: 'p' } }
                : null)
        )
        mockDb.adventureUser.findUnique.mockResolvedValue({ userId: 1, adventureId: ADV_ID, role: 'player' })

        httpServer = http.createServer()
        io = initSocket(httpServer)
        await new Promise((resolve) => httpServer.listen(0, resolve))
        port = httpServer.address().port
    })

    afterEach(() => {
        io.close()
        httpServer.close()
    })

    it('rejeita conexao sem cookie de sessao', async () => {
        const client = connect('adventure=7')
        const err = await new Promise((resolve) => client.on('connect_error', resolve))
        expect(err.message).toMatch(/Autenticacao/)
        client.close()
    })

    it('conecta com sessao valida e faz round-trip de grid:move', async () => {
        mockDb.gameMap.findUnique.mockResolvedValue({ id: 1, adventureId: ADV_ID, gridWidth: 20, gridHeight: 15 })
        mockDb.token.findUnique.mockResolvedValue({
            id: 10, gameMapId: 1, gameMap: { id: 1, adventureId: ADV_ID, gridWidth: 20, gridHeight: 15 },
        })
        mockDb.token.update.mockResolvedValue({})

        const client = connect(`session=${SESSION}; adventure=${ADV_ID}`)
        await new Promise((resolve, reject) => {
            client.on('connect', resolve)
            client.on('connect_error', reject)
        })

        client.emit('grid:join', { mapId: 1 })
        const moved = await new Promise((resolve) => {
            client.on('grid:moved', resolve)
            // pequeno atraso garante que o join foi processado antes do move
            setTimeout(() => client.emit('grid:move', { tokenId: 10, posX: 5, posY: 6 }), 50)
        })
        expect(moved).toEqual({ tokenId: 10, posX: 5, posY: 6 })
        client.close()
    })
})

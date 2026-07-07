import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock do PrismaClient antes de importar o modulo (que instancia um no load).
const { mockDb } = vi.hoisted(() => ({
    mockDb: {
        gameMap: { findUnique: vi.fn() },
        token: { findUnique: vi.fn(), update: vi.fn() },
    },
}))
vi.mock('@prisma/client', () => ({ PrismaClient: vi.fn(() => mockDb) }))

import { createGridHandlers } from '../../socket/handlers/grid.js'

const ADV_ID = 7

// Fakes de socket e io que registram as salas / eventos emitidos.
function makeSocket() {
    return {
        data: { adventureId: ADV_ID, user: { id: 1, username: 'p' } },
        joined: [],
        left: [],
        join(room) { this.joined.push(room) },
        leave(room) { this.left.push(room) },
    }
}

function makeIo() {
    const emitted = []
    return {
        emitted,
        to(room) {
            return { emit: (event, payload) => emitted.push({ room, event, payload }) }
        },
    }
}

describe('grid socket handlers', () => {
    let handlers, socket, io
    beforeEach(() => {
        vi.clearAllMocks()
        handlers = createGridHandlers(mockDb)
        socket = makeSocket()
        io = makeIo()
    })

    describe('onJoin', () => {
        it('entra na sala quando o mapa e da aventura', async () => {
            mockDb.gameMap.findUnique.mockResolvedValue({ id: 1, adventureId: ADV_ID })
            await handlers.onJoin(io, socket, { mapId: 1 })
            expect(socket.joined).toContain('map:1')
        })

        it('nao entra quando o mapa e de outra aventura', async () => {
            mockDb.gameMap.findUnique.mockResolvedValue({ id: 1, adventureId: 999 })
            await handlers.onJoin(io, socket, { mapId: 1 })
            expect(socket.joined).toHaveLength(0)
        })

        it('ignora payload sem mapId valido', async () => {
            await handlers.onJoin(io, socket, {})
            expect(mockDb.gameMap.findUnique).not.toHaveBeenCalled()
        })
    })

    describe('onLeave', () => {
        it('sai da sala do mapa', () => {
            handlers.onLeave(io, socket, { mapId: 2 })
            expect(socket.left).toContain('map:2')
        })
    })

    describe('onMove', () => {
        it('move token da aventura, clampa e faz broadcast grid:moved', async () => {
            mockDb.token.findUnique.mockResolvedValue({
                id: 10, gameMapId: 1, gameMap: { id: 1, adventureId: ADV_ID, gridWidth: 20, gridHeight: 15 },
            })
            mockDb.token.update.mockResolvedValue({})
            await handlers.onMove(io, socket, { tokenId: 10, posX: 99, posY: 99 })

            expect(mockDb.token.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { posX: 19, posY: 14 } })
            expect(io.emitted).toContainEqual({
                room: 'map:1', event: 'grid:moved', payload: { tokenId: 10, posX: 19, posY: 14 },
            })
        })

        it('nao move token de outra aventura', async () => {
            mockDb.token.findUnique.mockResolvedValue({
                id: 10, gameMapId: 1, gameMap: { id: 1, adventureId: 999, gridWidth: 20, gridHeight: 15 },
            })
            await handlers.onMove(io, socket, { tokenId: 10, posX: 1, posY: 1 })
            expect(mockDb.token.update).not.toHaveBeenCalled()
            expect(io.emitted).toHaveLength(0)
        })

        it('ignora tokenId invalido', async () => {
            await handlers.onMove(io, socket, { posX: 1, posY: 1 })
            expect(mockDb.token.findUnique).not.toHaveBeenCalled()
        })
    })
})

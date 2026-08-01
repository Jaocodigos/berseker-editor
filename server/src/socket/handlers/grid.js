import prisma from '../../db.js'
import logger from '../../logger.js'
import { mapRoom } from '../io.js'
import { clampPosition } from '../../utils/grid.js'

// Fabrica de handlers (recebe prisma para facilitar testes).
export function createGridHandlers(db = prisma) {
    // Verifica que um mapa pertence a aventura do socket.
    async function mapInAdventure(mapId, adventureId) {
        const map = await db.gameMap.findUnique({ where: { id: mapId } })
        if (!map || map.adventureId !== adventureId) return null
        return map
    }

    // grid:join { mapId } — entra na sala do mapa
    async function onJoin(io, socket, payload) {
        const mapId = Number(payload?.mapId)
        if (!Number.isFinite(mapId)) return
        const map = await mapInAdventure(mapId, socket.data.adventureId)
        if (!map) return
        socket.join(mapRoom(mapId))
        logger.debug('grid:join', { mapId, user: socket.data.user?.username })
    }

    // grid:leave { mapId } — sai da sala do mapa
    function onLeave(io, socket, payload) {
        const mapId = Number(payload?.mapId)
        if (!Number.isFinite(mapId)) return
        socket.leave(mapRoom(mapId))
    }

    // grid:move { tokenId, posX, posY } — move token (qualquer jogador) e faz broadcast
    async function onMove(io, socket, payload) {
        const tokenId = Number(payload?.tokenId)
        if (!Number.isFinite(tokenId)) return

        const token = await db.token.findUnique({
            where: { id: tokenId },
            include: { gameMap: true },
        })
        if (!token || token.gameMap.adventureId !== socket.data.adventureId) return

        const { posX, posY } = clampPosition(
            payload.posX, payload.posY, token.gameMap.gridWidth, token.gameMap.gridHeight
        )

        await db.token.update({ where: { id: tokenId }, data: { posX, posY } })
        io.to(mapRoom(token.gameMapId)).emit('grid:moved', { tokenId, posX, posY })
    }

    return { onJoin, onLeave, onMove }
}

// Conecta os handlers aos eventos do socket.
export function registerGridHandlers(io, socket) {
    const { onJoin, onLeave, onMove } = createGridHandlers()

    socket.on('grid:join', (payload) => onJoin(io, socket, payload).catch((e) =>
        logger.error('grid:join erro', { message: e.message })))
    socket.on('grid:leave', (payload) => onLeave(io, socket, payload))
    socket.on('grid:move', (payload) => onMove(io, socket, payload).catch((e) =>
        logger.error('grid:move erro', { message: e.message })))
}

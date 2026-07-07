// Guarda a instancia do Socket.IO para que as rotas REST possam emitir
// eventos (grid:moved, grid:added, grid:removed, grid:activated) sem criar
// dependencia circular com o setup do socket.
//
// Em ambiente de teste o io permanece null; os `getIo()?.` nas rotas viram no-op.

let io = null

export function setIo(instance) {
    io = instance
}

export function getIo() {
    return io
}

// Nome da sala do Socket.IO para um mapa.
export function mapRoom(mapId) {
    return `map:${mapId}`
}

import { Server } from 'socket.io'
import { PrismaClient } from '@prisma/client'
import logger from '../logger.js'
import { setIo } from './io.js'
import { registerGridHandlers } from './handlers/grid.js'

const prisma = new PrismaClient()

// Parser minimo de Cookie header (evita depender do cookie-parser aqui).
function parseCookies(header = '') {
    const out = {}
    for (const part of header.split(';')) {
        const idx = part.indexOf('=')
        if (idx === -1) continue
        const key = part.slice(0, idx).trim()
        const val = part.slice(idx + 1).trim()
        if (key) out[key] = decodeURIComponent(val)
    }
    return out
}

// Autentica o handshake: valida sessao + pertencimento a aventura (mesma
// logica dos middlewares REST auth.js/adventure.js). Popula socket.data.
async function authenticate(socket, next) {
    try {
        const cookies = parseCookies(socket.handshake.headers?.cookie)
        const token = cookies.session
        const adventureId = Number(cookies.adventure)

        if (!token) return next(new Error('Autenticacao necessaria'))
        if (!adventureId) return next(new Error('Nenhuma aventura selecionada'))

        const session = await prisma.session.findUnique({ where: { token }, include: { user: true } })
        if (!session || session.expiresAt < new Date()) {
            return next(new Error('Sessao invalida'))
        }

        const membership = await prisma.adventureUser.findUnique({
            where: { userId_adventureId: { userId: session.user.id, adventureId } },
        })
        if (!membership) return next(new Error('Voce nao pertence a esta aventura'))

        socket.data.user = { id: session.user.id, username: session.user.username }
        socket.data.adventureId = adventureId
        socket.data.role = membership.role
        next()
    } catch (e) {
        logger.error('socket auth erro', { message: e.message })
        next(new Error('Erro de autenticacao'))
    }
}

// Inicializa o Socket.IO acoplado ao httpServer do Express.
export function initSocket(httpServer) {
    const io = new Server(httpServer, {
        cors: { origin: true, credentials: true },
    })

    io.use(authenticate)

    io.on('connection', (socket) => {
        // Sala da aventura: recebe broadcasts globais (ex.: grid:activated).
        socket.join(`adventure:${socket.data.adventureId}`)
        logger.debug('socket conectado', { user: socket.data.user?.username, adventureId: socket.data.adventureId })

        registerGridHandlers(io, socket)

        socket.on('disconnect', () => {
            logger.debug('socket desconectado', { user: socket.data.user?.username })
        })
    })

    setIo(io)
    return io
}

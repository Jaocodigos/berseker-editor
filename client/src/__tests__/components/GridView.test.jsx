import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Socket fake compartilhado (hoisted p/ o vi.mock).
const { fakeSocket } = vi.hoisted(() => ({
    fakeSocket: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
}))
vi.mock('../../socket', () => ({ getSocket: () => fakeSocket }))

import GridView from '../../components/GridView'

const ok = (data) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) })

const detail = {
    id: 1, nome: 'Arena', gridWidth: 20, gridHeight: 15, cellSize: 40, active: true,
    tokens: [{ id: 10, posX: 1, posY: 1, character: { id: 5, nome: 'Hero', type: 'player_character', actualHp: 8, maxHp: 10 } }],
}

function stubCanvas() {
    HTMLCanvasElement.prototype.getContext = () =>
        new Proxy({}, { get: () => () => {}, set: () => true })
    HTMLCanvasElement.prototype.setPointerCapture = vi.fn()
    HTMLCanvasElement.prototype.releasePointerCapture = vi.fn()
}

function firePointer(canvas, type, clientX, clientY) {
    fireEvent(canvas, new MouseEvent(type, { clientX, clientY, bubbles: true }))
}

describe('GridView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        stubCanvas()
        Object.defineProperty(document, 'fullscreenElement', {
            configurable: true,
            writable: true,
            value: null,
        })
        document.exitFullscreen = vi.fn().mockResolvedValue(undefined)
        HTMLElement.prototype.requestFullscreen = vi.fn().mockResolvedValue(undefined)
        global.fetch = vi.fn((url) => {
            if (url.endsWith('/api/maps')) return ok([{ id: 1, nome: 'Arena', active: true, gridWidth: 20, gridHeight: 15, cellSize: 40 }])
            if (/\/api\/maps\/1$/.test(url)) return ok(detail)
            return ok({})
        })
    })

    it('carrega o mapa ativo e mostra a sidebar com nome + HP', async () => {
        render(<GridView />)
        expect(await screen.findByText('Hero')).toBeInTheDocument()
        expect(screen.getByText('8/10 HP')).toBeInTheDocument()
    })

    it('entra na sala do mapa (grid:join) e registra listeners', async () => {
        render(<GridView />)
        await screen.findByText('Hero')
        expect(fakeSocket.emit).toHaveBeenCalledWith('grid:join', { mapId: 1 })
        const events = fakeSocket.on.mock.calls.map(([e]) => e)
        expect(events).toEqual(expect.arrayContaining(['grid:moved', 'grid:added', 'grid:removed', 'grid:activated', 'connect']))
    })

    it('mostra estado vazio quando nao ha mapa ativo', async () => {
        global.fetch = vi.fn((url) => {
            if (url.endsWith('/api/maps')) return ok([{ id: 1, nome: 'Arena', active: false }])
            return ok({})
        })
        render(<GridView />)
        expect(await screen.findByText('Nenhum mapa ativo')).toBeInTheDocument()
    })

    it('arrastar um token emite grid:move com a celula destino', async () => {
        const { container } = render(<GridView />)
        await screen.findByText('Hero')
        const canvas = container.querySelector('canvas')
        canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 })

        // token em (1,1) -> centro (60,60); solta em (5,6) -> (220,260)
        firePointer(canvas, 'pointerdown', 60, 60)
        firePointer(canvas, 'pointerup', 220, 260)

        await waitFor(() =>
            expect(fakeSocket.emit).toHaveBeenCalledWith('grid:move', { tokenId: 10, posX: 5, posY: 6 })
        )
    })

    it('entra em tela cheia somente com o container do mapa', async () => {
        const { container } = render(<GridView />)
        await screen.findByText('Hero')

        const mapContainer = container.querySelector('.grid-view-main')
        const sidebar = container.querySelector('.grid-sidebar')
        fireEvent.click(screen.getByRole('button', { name: 'Entrar em tela cheia' }))

        await waitFor(() => expect(mapContainer.requestFullscreen).toHaveBeenCalled())
        expect(mapContainer.contains(sidebar)).toBe(false)
        expect(screen.getByRole('button', { name: 'Sair da tela cheia' })).toBeInTheDocument()
    })

    it('sincroniza o botao ao sair da tela cheia com Esc', async () => {
        const { container } = render(<GridView />)
        await screen.findByText('Hero')

        const mapContainer = container.querySelector('.grid-view-main')
        document.fullscreenElement = mapContainer
        fireEvent(document, new Event('fullscreenchange'))
        expect(screen.getByRole('button', { name: 'Sair da tela cheia' })).toBeInTheDocument()

        document.fullscreenElement = null
        fireEvent(document, new Event('fullscreenchange'))
        expect(screen.getByRole('button', { name: 'Entrar em tela cheia' })).toBeInTheDocument()
    })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import GridMap, { snapToCell } from '../../components/GridMap'

// Canvas 2D no jsdom nao existe: stub minimo (qualquer metodo vira no-op, sets permitidos).
function stubCanvas() {
    HTMLCanvasElement.prototype.getContext = () =>
        new Proxy({}, { get: () => () => {}, set: () => true })
    HTMLCanvasElement.prototype.setPointerCapture = vi.fn()
    HTMLCanvasElement.prototype.releasePointerCapture = vi.fn()
}

// jsdom nao implementa PointerEvent (clientX/Y vem undefined via fireEvent.pointer*).
// Despacha um MouseEvent com o tipo do pointer event — carrega as coordenadas e
// dispara o handler React equivalente, dentro de act() (forma fireEvent(node, event)).
function firePointer(canvas, type, clientX, clientY) {
    fireEvent(canvas, new MouseEvent(type, { clientX, clientY, bubbles: true }))
}

const map = { id: 1, nome: 'Arena', gridWidth: 20, gridHeight: 15, cellSize: 40 }

describe('snapToCell', () => {
    it('converte pixels para a celula correspondente', () => {
        expect(snapToCell(100, 140, 40, 20, 15)).toEqual({ cellX: 2, cellY: 3 })
    })

    it('faz clamp aos limites superiores', () => {
        expect(snapToCell(9999, 9999, 40, 20, 15)).toEqual({ cellX: 19, cellY: 14 })
    })

    it('faz clamp de valores negativos para 0', () => {
        expect(snapToCell(-50, -1, 40, 20, 15)).toEqual({ cellX: 0, cellY: 0 })
    })
})

describe('GridMap drag & drop', () => {
    beforeEach(stubCanvas)

    function setup(tokens, onMove) {
        const { container } = render(<GridMap map={map} tokens={tokens} onMove={onMove} />)
        const canvas = container.querySelector('canvas')
        // escala 1:1 (rect igual a resolucao) para mapear clientX->pixel direto
        canvas.getBoundingClientRect = () => ({
            left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600,
        })
        return canvas
    }

    it('arrastar um token chama onMove com a celula destino', () => {
        const onMove = vi.fn()
        const tokens = [{ id: 10, posX: 2, posY: 3, character: { nome: 'Hero', type: 'player_character' } }]
        const canvas = setup(tokens, onMove)

        // centro do token em (2,3): pixel (100,140)
        firePointer(canvas, 'pointerdown', 100, 140)
        // solta no centro da celula (5,6): pixel (220,260)
        firePointer(canvas, 'pointermove', 220, 260)
        firePointer(canvas, 'pointerup', 220, 260)

        expect(onMove).toHaveBeenCalledWith(10, 5, 6)
    })

    it('nao chama onMove ao clicar em area vazia (sem token)', () => {
        const onMove = vi.fn()
        const tokens = [{ id: 10, posX: 2, posY: 3, character: { nome: 'Hero' } }]
        const canvas = setup(tokens, onMove)

        // celula (10,10) — longe do token
        firePointer(canvas, 'pointerdown', 420, 420)
        firePointer(canvas, 'pointerup', 460, 460)

        expect(onMove).not.toHaveBeenCalled()
    })

    it('nao chama onMove quando o token e solto na mesma celula', () => {
        const onMove = vi.fn()
        const tokens = [{ id: 10, posX: 2, posY: 3, character: { nome: 'Hero' } }]
        const canvas = setup(tokens, onMove)

        firePointer(canvas, 'pointerdown', 100, 140)
        firePointer(canvas, 'pointerup', 105, 145) // ainda celula (2,3)

        expect(onMove).not.toHaveBeenCalled()
    })

    it('respeita canMove=false (nao inicia drag)', () => {
        const onMove = vi.fn()
        const tokens = [{ id: 10, posX: 2, posY: 3, character: { nome: 'Hero' } }]
        const { container } = render(
            <GridMap map={map} tokens={tokens} onMove={onMove} canMove={false} />
        )
        const canvas = container.querySelector('canvas')
        canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 })

        firePointer(canvas, 'pointerdown', 100, 140)
        firePointer(canvas, 'pointerup', 220, 260)

        expect(onMove).not.toHaveBeenCalled()
    })
})

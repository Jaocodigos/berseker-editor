import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MapManager from '../../components/MapManager'

const ok = (data, status = 200) => Promise.resolve({ ok: true, status, json: () => Promise.resolve(data) })

function mockFetch({ maps = [], detail = null } = {}) {
    global.fetch = vi.fn((url, opts = {}) => {
        const method = opts.method || 'GET'
        if (url.endsWith('/api/maps') && method === 'GET') return ok(maps)
        if (url.endsWith('/api/maps') && method === 'POST') return ok({ id: 99, ...JSON.parse(opts.body) }, 201)
        if (/\/api\/maps\/\d+\/activate$/.test(url)) return ok({ active: true })
        if (/\/api\/maps\/\d+\/tokens$/.test(url) && method === 'POST') return ok({ id: 1 }, 201)
        if (/\/api\/maps\/\d+$/.test(url) && method === 'GET') return ok(detail)
        if (/\/api\/tokens\/\d+$/.test(url)) return ok({}, 204)
        return ok({}) // logger e demais
    })
    return global.fetch
}

const characters = [
    { id: 5, nome: 'Hero' },
    { id: 6, nome: 'Rogue' },
]

describe('MapManager', () => {
    beforeEach(() => vi.clearAllMocks())

    it('lista os mapas da aventura ao abrir', async () => {
        mockFetch({ maps: [{ id: 1, nome: 'Arena', gridWidth: 20, gridHeight: 15, active: false }] })
        render(<MapManager open onClose={() => {}} characters={characters} />)
        const arena = await screen.findByText('Arena')
        expect(arena).toBeInTheDocument()
        // dimensoes do mapa exibidas ao lado do nome
        expect(within(arena.closest('.map-item')).getByText('20×15')).toBeInTheDocument()
    })

    it('mostra os segmented controls de formato e tamanho', async () => {
        mockFetch({ maps: [] })
        render(<MapManager open onClose={() => {}} characters={characters} />)
        // formato
        expect(await screen.findByRole('button', { name: /Paisagem/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Quadrado/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Retrato/ })).toBeInTheDocument()
        // tamanho
        expect(screen.getByRole('button', { name: /Pequeno/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Médio/ })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Grande/ })).toBeInTheDocument()
    })

    it('seleciona um preset diferente (aria-pressed)', async () => {
        mockFetch({ maps: [] })
        const user = userEvent.setup()
        render(<MapManager open onClose={() => {}} characters={characters} />)
        const grande = await screen.findByRole('button', { name: /Grande/ })
        await user.click(grande)
        expect(grande).toHaveAttribute('aria-pressed', 'true')
    })

    it('cria um mapa enviando nome, shape e size', async () => {
        const fetchMock = mockFetch({ maps: [] })
        const user = userEvent.setup()
        render(<MapManager open onClose={() => {}} characters={characters} />)

        await user.type(screen.getByPlaceholderText('Nome do mapa'), 'Masmorra')
        await user.click(await screen.findByRole('button', { name: /Retrato/ }))
        await user.click(screen.getByRole('button', { name: /Pequeno/ }))
        await user.click(screen.getByRole('button', { name: 'Criar mapa' }))

        await waitFor(() => {
            const call = fetchMock.mock.calls.find(
                ([url, opts]) => url.endsWith('/api/maps') && opts?.method === 'POST'
            )
            expect(call).toBeTruthy()
            expect(JSON.parse(call[1].body)).toEqual({ nome: 'Masmorra', shape: 'portrait', size: 'small', backgroundUrl: null })
        })
    })

    it('ativa um mapa', async () => {
        const fetchMock = mockFetch({ maps: [{ id: 3, nome: 'Campo', gridWidth: 30, gridHeight: 20, active: false }] })
        const user = userEvent.setup()
        render(<MapManager open onClose={() => {}} characters={characters} />)

        await user.click(await screen.findByRole('button', { name: 'Ativar' }))
        await waitFor(() => {
            expect(fetchMock.mock.calls.some(([url, opts]) =>
                url.endsWith('/api/maps/3/activate') && opts?.method === 'POST'
            )).toBe(true)
        })
    })

    it('abre o painel de tokens e lista personagens fora do mapa', async () => {
        mockFetch({
            maps: [{ id: 1, nome: 'Arena', gridWidth: 20, gridHeight: 15, active: true }],
            detail: {
                id: 1, nome: 'Arena', gridWidth: 20, gridHeight: 15,
                tokens: [{ id: 10, character: { id: 5, nome: 'Hero' } }],
            },
        })
        const user = userEvent.setup()
        render(<MapManager open onClose={() => {}} characters={characters} />)

        await user.click(await screen.findByRole('button', { name: 'Tokens' }))

        // Hero ja tem token -> aparece na lista de tokens
        const list = await screen.findByRole('list')
        expect(within(list).getByText('Hero')).toBeInTheDocument()

        // Rogue (sem token) aparece como opcao no select de adicionar
        expect(screen.getByRole('option', { name: 'Rogue' })).toBeInTheDocument()
        expect(screen.queryByRole('option', { name: 'Hero' })).not.toBeInTheDocument()
    })
})

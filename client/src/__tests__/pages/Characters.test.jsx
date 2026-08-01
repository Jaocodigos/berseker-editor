import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Characters from '../../pages/Characters'

vi.mock('../../logger', () => ({
    default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    API_URL: '',
}))

vi.spyOn(console, 'log').mockImplementation(() => {})

const mockCharacters = [
    { id: 1, nome: 'Aragorn', maxHp: 100, actualHp: 100, pillars: [] },
    { id: 2, nome: 'Legolas', maxHp: 80, actualHp: 80, pillars: [] },
]

describe('Characters Page', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([]) })
    })

    it('busca e renderiza lista de personagens', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockCharacters),
        })
        render(<MemoryRouter><Characters /></MemoryRouter>)
        await waitFor(() => {
            expect(screen.getByText('Aragorn')).toBeInTheDocument()
            expect(screen.getByText('Legolas')).toBeInTheDocument()
        })
    })

    it('abre o modal de criação ao clicar no botão +', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([]),
        })
        render(<MemoryRouter><Characters /></MemoryRouter>)
        await userEvent.click(screen.getByRole('button', { name: /adicionar personagem/i }))
        expect(screen.getByText('Adicionar Personagem')).toBeInTheDocument()
    })

    it('carrega títulos e popula o select do formulário', async () => {
        const titles = [
            { id: 5, nome: 'Herói', color: '#ff0000' },
            { id: 6, nome: 'Vilão', color: '#000000' },
        ]
        global.fetch = vi.fn().mockImplementation((url) => {
            if (typeof url === 'string' && url.endsWith('/api/titles')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve(titles) })
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
        })
        render(<MemoryRouter><Characters /></MemoryRouter>)
        const plusBtn = await screen.findByRole('button', { name: /adicionar personagem/i })
        await userEvent.click(plusBtn)
        await waitFor(() => {
            expect(screen.getByRole('option', { name: 'Sem título' })).toBeInTheDocument()
            expect(screen.getByRole('option', { name: 'Herói' })).toBeInTheDocument()
            expect(screen.getByRole('option', { name: 'Vilão' })).toBeInTheDocument()
        })
    })

    it('envia titleId no POST quando título é selecionado', async () => {
        const titles = [{ id: 5, nome: 'Herói', color: '#ff0000' }]
        global.fetch = vi.fn().mockImplementation((url, opts) => {
            if (typeof url === 'string' && url.endsWith('/api/titles')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve(titles) })
            }
            if (opts?.method === 'POST') {
                return Promise.resolve({ ok: true, json: () => Promise.resolve({ id: 9, nome: 'Hero', titleId: 5 }) })
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
        })
        render(<MemoryRouter><Characters /></MemoryRouter>)
        await userEvent.click(await screen.findByRole('button', { name: /adicionar personagem/i }))

        await userEvent.type(screen.getByPlaceholderText('Nome do personagem'), 'Hero')
        const select = await screen.findByRole('combobox')
        await waitFor(() => expect(screen.getByRole('option', { name: 'Herói' })).toBeInTheDocument())
        await userEvent.selectOptions(select, '5')
        await userEvent.click(screen.getByText('Salvar'))

        await waitFor(() => {
            const postCall = vi.mocked(fetch).mock.calls.find(([, o]) => o?.method === 'POST')
            expect(postCall).toBeDefined()
            const body = JSON.parse(postCall[1].body)
            expect(body.titleId).toBe(5)
        })
    })

    it('filtra personagens por nome ao digitar no filtro', async () => {
        global.fetch = vi.fn().mockImplementation((url) => {
            if (typeof url === 'string' && url.endsWith('/api/titles')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCharacters) })
        })
        render(<MemoryRouter><Characters /></MemoryRouter>)
        await waitFor(() => {
            expect(screen.getByText('Aragorn')).toBeInTheDocument()
            expect(screen.getByText('Legolas')).toBeInTheDocument()
        })

        await userEvent.click(screen.getByRole('button', { name: /filtrar/i }))
        await userEvent.type(screen.getByPlaceholderText('Buscar por nome'), 'leg')

        await waitFor(() => {
            expect(screen.queryByText('Aragorn')).not.toBeInTheDocument()
            expect(screen.getByText('Legolas')).toBeInTheDocument()
        })
    })

    it('mostra mensagem de vazio quando filtro nao casa nenhum personagem', async () => {
        global.fetch = vi.fn().mockImplementation((url) => {
            if (typeof url === 'string' && url.endsWith('/api/titles')) {
                return Promise.resolve({ ok: true, json: () => Promise.resolve([]) })
            }
            return Promise.resolve({ ok: true, json: () => Promise.resolve(mockCharacters) })
        })
        render(<MemoryRouter><Characters /></MemoryRouter>)
        await waitFor(() => expect(screen.getByText('Aragorn')).toBeInTheDocument())

        await userEvent.click(screen.getByRole('button', { name: /filtrar/i }))
        await userEvent.type(screen.getByPlaceholderText('Buscar por nome'), 'xyz')

        await waitFor(() => {
            expect(screen.getByText('Nenhum personagem encontrado.')).toBeInTheDocument()
        })
    })

    it('chama POST ao submeter o formulário de criação', async () => {
        const created = { id: 3, nome: 'Gandalf', maxHp: 120, actualHp: 120, pillars: [] }
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // GET inicial
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(created) }) // POST
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([created]) }) // GET após criar

        render(<MemoryRouter><Characters /></MemoryRouter>)
        await userEvent.click(screen.getByRole('button', { name: /adicionar personagem/i }))

        await userEvent.type(screen.getByPlaceholderText('Nome do personagem'), 'Gandalf')
        await userEvent.type(screen.getByPlaceholderText('HP máximo'), '120')
        await userEvent.click(screen.getByText('Salvar'))

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/characters'),
                expect.objectContaining({ method: 'POST' })
            )
        })
    })
})

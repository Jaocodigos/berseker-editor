import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Characters from '../../pages/Characters'

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ authHeader: { Authorization: 'Basic dXNlcjpwYXNz' } }),
}))

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
        await userEvent.click(screen.getByRole('button'))
        expect(screen.getByText('Adicionar Personagem')).toBeInTheDocument()
    })

    it('chama POST ao submeter o formulário de criação', async () => {
        const created = { id: 3, nome: 'Gandalf', maxHp: 120, actualHp: 120, pillars: [] }
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) }) // GET inicial
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(created) }) // POST
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([created]) }) // GET após criar

        render(<MemoryRouter><Characters /></MemoryRouter>)
        await userEvent.click(screen.getByRole('button'))

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

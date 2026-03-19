import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CharacterCard from '../../components/CharacterCard'

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ authHeader: { Authorization: 'Basic dXNlcjpwYXNz' } }),
}))

// Silence console.log from the component
vi.spyOn(console, 'log').mockImplementation(() => {})

const mockChar = {
    id: 1,
    nome: 'Aragorn',
    pillars: [
        { id: 1, nome: 'Ranger', tipo: 'Físico', maxMana: 10, actualMana: 7, abilities: [] },
    ],
}

function renderCard(char = mockChar, onRefresh = vi.fn()) {
    render(<MemoryRouter><CharacterCard character={char} onRefresh={onRefresh} /></MemoryRouter>)
}

describe('CharacterCard', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) })
    })

    it('renderiza o nome do personagem', () => {
        renderCard()
        expect(screen.getByText('Aragorn')).toBeInTheDocument()
    })

    it('renderiza pilares com mana atual e máxima', () => {
        renderCard()
        expect(screen.getByText(/Ranger/)).toBeInTheDocument()
        expect(screen.getByText(/7\/10/)).toBeInTheDocument()
    })

    it('exibe mensagem quando não há pilares', () => {
        renderCard({ ...mockChar, pillars: [] })
        expect(screen.getByText('Ainda sem pilares.')).toBeInTheDocument()
    })

    it('abre modal de confirmação ao clicar no botão delete', async () => {
        renderCard()
        const buttons = screen.getAllByRole('button')
        // 0 = FireIcon (navigate), 1 = TrashIcon (delete)
        await userEvent.click(buttons[1])
        expect(screen.getByText(/Tem certeza que deseja excluir/)).toBeInTheDocument()
        expect(screen.getByText('Confirmar')).toBeInTheDocument()
        expect(screen.getByText('Cancelar')).toBeInTheDocument()
    })

    it('fecha o modal ao clicar em Cancelar', async () => {
        renderCard()
        const buttons = screen.getAllByRole('button')
        await userEvent.click(buttons[1])
        await userEvent.click(screen.getByText('Cancelar'))
        expect(screen.queryByText(/Tem certeza/)).not.toBeInTheDocument()
    })

    it('chama fetch DELETE e onRefresh ao confirmar exclusão', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 })
        const onRefresh = vi.fn()
        renderCard(mockChar, onRefresh)
        const buttons = screen.getAllByRole('button')
        await userEvent.click(buttons[1])
        await userEvent.click(screen.getByText('Confirmar'))
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/characters/1'),
                expect.objectContaining({ method: 'DELETE' })
            )
            expect(onRefresh).toHaveBeenCalled()
        })
    })
})

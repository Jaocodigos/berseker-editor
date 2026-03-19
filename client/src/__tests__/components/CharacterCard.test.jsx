import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CharacterCard from '../../components/CharacterCard'

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ authHeader: { Authorization: 'Basic dXNlcjpwYXNz' } }),
}))

vi.mock('../../logger', () => ({
    default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    API_URL: '',
}))

// Silence console.log from the component
vi.spyOn(console, 'log').mockImplementation(() => {})

const mockChar = {
    id: 1,
    nome: 'Aragorn',
    maxHp: 100,
    actualHp: 80,
    xp: 50,
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

    // Buttons: 0=FireIcon(abilities), 1=PencilSquare(edit), 2=Trash(delete)
    it('abre modal de confirmação ao clicar no botão delete', async () => {
        renderCard()
        const buttons = screen.getAllByRole('button')
        await userEvent.click(buttons[2])
        expect(screen.getByText(/Tem certeza que deseja excluir/)).toBeInTheDocument()
        expect(screen.getByText('Confirmar')).toBeInTheDocument()
        expect(screen.getByText('Cancelar')).toBeInTheDocument()
    })

    it('fecha o modal de delete ao clicar em Cancelar', async () => {
        renderCard()
        const buttons = screen.getAllByRole('button')
        await userEvent.click(buttons[2])
        await userEvent.click(screen.getByText('Cancelar'))
        expect(screen.queryByText(/Tem certeza/)).not.toBeInTheDocument()
    })

    it('chama fetch DELETE e onRefresh ao confirmar exclusão', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204 })
        const onRefresh = vi.fn()
        renderCard(mockChar, onRefresh)
        const buttons = screen.getAllByRole('button')
        await userEvent.click(buttons[2])
        await userEvent.click(screen.getByText('Confirmar'))
        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/characters/1'),
                expect.objectContaining({ method: 'DELETE' })
            )
            expect(onRefresh).toHaveBeenCalled()
        })
    })

    it('abre modal de edição ao clicar no botão de editar', async () => {
        renderCard()
        const buttons = screen.getAllByRole('button')
        await userEvent.click(buttons[1])
        expect(screen.getByPlaceholderText('Nome do personagem')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('HP máx')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('HP atual')).toBeInTheDocument()
        expect(screen.getByPlaceholderText('XP')).toBeInTheDocument()
    })

    it('edita nome do personagem e chama fetch PATCH + onRefresh ao salvar', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) })
        const onRefresh = vi.fn()
        renderCard(mockChar, onRefresh)
        const buttons = screen.getAllByRole('button')
        await userEvent.click(buttons[1])

        const nomeInput = screen.getByPlaceholderText('Nome do personagem')
        await userEvent.clear(nomeInput)
        await userEvent.type(nomeInput, 'Legolas')

        await userEvent.click(screen.getByText('Salvar'))

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/characters/1'),
                expect.objectContaining({ method: 'PATCH' })
            )
            expect(onRefresh).toHaveBeenCalled()
        })
    })

    it('adiciona e remove pilar na edição', async () => {
        renderCard()
        const buttons = screen.getAllByRole('button')
        await userEvent.click(buttons[1])

        // Adicionar novo pilar
        await userEvent.click(screen.getByText('+ Pilar'))
        const nomePillarInputs = screen.getAllByPlaceholderText('Nome do pilar')
        expect(nomePillarInputs).toHaveLength(2)

        // Remover o pilar recém-adicionado (último ✖)
        const removeButtons = screen.getAllByText('✖')
        await userEvent.click(removeButtons[removeButtons.length - 1])
        const nomePillarInputsAfter = screen.getAllByPlaceholderText('Nome do pilar')
        expect(nomePillarInputsAfter).toHaveLength(1)
    })
})

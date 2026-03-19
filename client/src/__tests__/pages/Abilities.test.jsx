import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import Abilities from '../../pages/Abilities'

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ authHeader: { Authorization: 'Basic dXNlcjpwYXNz' } }),
}))

vi.mock('../../logger', () => ({
    default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    API_URL: '',
}))

const mockCharacter = {
    id: 1,
    nome: 'Aragorn',
    pillars: [
        {
            id: 1,
            nome: 'Ranger',
            tipo: 'Físico',
            abilities: [
                { id: 1, nome: 'Flecha', dano: '1d8', custo: 3, descricao: 'Atira uma flecha' },
                { id: 2, nome: 'Golpe', dano: '2d6', custo: 5, descricao: '' },
            ],
        },
    ],
}

function renderAbilities() {
    return render(
        <MemoryRouter initialEntries={['/characters/1/abilities']}>
            <Routes>
                <Route path="/characters/:characterId/abilities" element={<Abilities />} />
            </Routes>
        </MemoryRouter>
    )
}

describe('Abilities Page', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve(mockCharacter),
        })
        vi.spyOn(window, 'alert').mockImplementation(() => {})
    })

    it('busca e renderiza lista de habilidades', async () => {
        renderAbilities()
        await waitFor(() => {
            expect(screen.getByText('Flecha')).toBeInTheDocument()
            expect(screen.getByText('Golpe')).toBeInTheDocument()
        })
    })

    it('abre modal de edição ao clicar em Editar no dropdown', async () => {
        renderAbilities()
        await waitFor(() => expect(screen.getByText('Flecha')).toBeInTheDocument())

        const menuBtns = screen.getAllByText('⋮')
        await userEvent.click(menuBtns[0])
        await userEvent.click(screen.getByText(/Editar/i))

        expect(screen.getByText('Editar Habilidade')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Flecha')).toBeInTheDocument()
        expect(screen.getByDisplayValue('1d8')).toBeInTheDocument()
        expect(screen.getByDisplayValue('3')).toBeInTheDocument()
    })

    it('preenche o modal de edição com os dados da habilidade selecionada', async () => {
        renderAbilities()
        await waitFor(() => expect(screen.getByText('Golpe')).toBeInTheDocument())

        const menuBtns = screen.getAllByText('⋮')
        await userEvent.click(menuBtns[1])
        await userEvent.click(screen.getByText(/Editar/i))

        expect(screen.getByDisplayValue('Golpe')).toBeInTheDocument()
        expect(screen.getByDisplayValue('2d6')).toBeInTheDocument()
        expect(screen.getByDisplayValue('5')).toBeInTheDocument()
    })

    it('chama PUT ao salvar edição', async () => {
        const updatedAbility = { id: 1, nome: 'Flecha', dano: '1d8', custo: 3, descricao: 'Atira uma flecha' }
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCharacter) }) // GET inicial
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(updatedAbility) }) // PUT
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCharacter) })  // GET após salvar

        renderAbilities()
        await waitFor(() => expect(screen.getByText('Flecha')).toBeInTheDocument())

        const menuBtns = screen.getAllByText('⋮')
        await userEvent.click(menuBtns[0])
        await userEvent.click(screen.getByText(/Editar/i))

        await waitFor(() => expect(screen.getByText('Editar Habilidade')).toBeInTheDocument())

        fireEvent.submit(screen.getByDisplayValue('Flecha').closest('form'))

        await waitFor(() => {
            expect(fetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/abilities/1'),
                expect.objectContaining({ method: 'PUT' })
            )
        })
    })

    it('fecha o modal após salvar com sucesso', async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCharacter) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 1, nome: 'Flecha', dano: '1d8', custo: 3, descricao: '' }) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockCharacter) })

        renderAbilities()
        await waitFor(() => expect(screen.getByText('Flecha')).toBeInTheDocument())

        const menuBtns = screen.getAllByText('⋮')
        await userEvent.click(menuBtns[0])
        await userEvent.click(screen.getByText(/Editar/i))

        await waitFor(() => expect(screen.getByText('Editar Habilidade')).toBeInTheDocument())

        fireEvent.submit(screen.getByDisplayValue('Flecha').closest('form'))

        await waitFor(() => {
            expect(screen.queryByText('Editar Habilidade')).not.toBeInTheDocument()
        })
    })
})

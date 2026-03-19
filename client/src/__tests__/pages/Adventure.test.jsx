import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Adventure from '../../pages/Adventure'

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ authHeader: { Authorization: 'Basic dXNlcjpwYXNz' } }),
}))

const mockCharacter = {
    id: 1,
    nome: 'Aragorn',
    maxHp: 100,
    actualHp: 100,
    pillars: [
        {
            id: 1, nome: 'Ranger', tipo: 'Físico', maxMana: 20, actualMana: 20,
            abilities: [{ id: 1, nome: 'Flecha', custo: 5, dano: '1d8' }],
        },
    ],
}

async function addCharacterToSession() {
    // Click "Adicionar" header button
    await userEvent.click(screen.getByRole('button', { name: /Adicionar/i }))
    // Submit modal (click second "Adicionar" button = form submit)
    const addBtns = screen.getAllByRole('button', { name: /Adicionar/i })
    await userEvent.click(addBtns[addBtns.length - 1])
    await waitFor(() => expect(screen.getByText('Aragorn')).toBeInTheDocument())
}

describe('Adventure Page', () => {
    beforeEach(() => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({}) })
        vi.spyOn(window, 'alert').mockImplementation(() => {})
    })

    it('mostra estado de loading durante o fetch inicial', () => {
        global.fetch = vi.fn().mockReturnValue(new Promise(() => {}))
        render(<MemoryRouter><Adventure /></MemoryRouter>)
        expect(screen.getByText(/Carregando personagens/i)).toBeInTheDocument()
    })

    it('exibe mensagem de estado vazio quando não há personagens na sessão', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([mockCharacter]),
        })
        render(<MemoryRouter><Adventure /></MemoryRouter>)
        await waitFor(() =>
            expect(screen.queryByText(/Carregando personagens/i)).not.toBeInTheDocument()
        )
        expect(screen.getByText(/Nenhum personagem na mesa/i)).toBeInTheDocument()
    })

    it('exibe mensagem de erro quando o fetch falha', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false })
        render(<MemoryRouter><Adventure /></MemoryRouter>)
        await waitFor(() =>
            expect(screen.getByText(/Erro ao carregar/i)).toBeInTheDocument()
        )
    })

    it('clamp de HP: dano maior que HP atual não deixa HP negativo', async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([mockCharacter]) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ ...mockCharacter, actualHp: 0 }) })

        render(<MemoryRouter><Adventure /></MemoryRouter>)
        await waitFor(() =>
            expect(screen.queryByText(/Carregando/i)).not.toBeInTheDocument()
        )

        await addCharacterToSession()

        await userEvent.click(screen.getByRole('button', { name: /Receber Dano/i }))
        await userEvent.type(screen.getByPlaceholderText('Dano'), '999')
        await userEvent.click(screen.getByRole('button', { name: /Aplicar/i }))

        await waitFor(() => {
            const calls = vi.mocked(fetch).mock.calls
            const patchCall = calls.find(([, opts]) => opts?.method === 'PATCH')
            expect(patchCall).toBeDefined()
            const body = JSON.parse(patchCall[1].body)
            expect(body.actualHp).toBe(0) // Math.max(0, 100 - 999) = 0
        })
    })

    it('não chama fetch quando dano é inválido (zero ou negativo)', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve([mockCharacter]),
        })
        render(<MemoryRouter><Adventure /></MemoryRouter>)
        await waitFor(() => expect(screen.queryByText(/Carregando/i)).not.toBeInTheDocument())

        await addCharacterToSession()

        await userEvent.click(screen.getByRole('button', { name: /Receber Dano/i }))
        await userEvent.type(screen.getByPlaceholderText('Dano'), '0')
        await userEvent.click(screen.getByRole('button', { name: /Aplicar/i }))

        expect(window.alert).toHaveBeenCalled()
        // Apenas o fetch inicial (GET) — nenhum PATCH
        const patchCalls = vi.mocked(fetch).mock.calls.filter(([, opts]) => opts?.method === 'PATCH')
        expect(patchCalls).toHaveLength(0)
    })

    it('recarrega HP e mana dos personagens em sessão a cada 5 segundos', async () => {
        vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })

        const updatedCharacter = { ...mockCharacter, actualHp: 42 }
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([mockCharacter]) }) // GET inicial
            .mockResolvedValue({ ok: true, json: () => Promise.resolve(updatedCharacter) })    // polls

        render(<MemoryRouter><Adventure /></MemoryRouter>)
        await waitFor(() => expect(screen.queryByText(/Carregando/i)).not.toBeInTheDocument())

        await addCharacterToSession()

        // Avança 5 segundos para disparar o intervalo
        await act(async () => {
            vi.advanceTimersByTime(10000)
        })

        // HP atualizado deve aparecer na tela
        await waitFor(() => expect(screen.getByText(/42/)).toBeInTheDocument())

        vi.useRealTimers()
    })

    it('usa habilidade e envia abilityId correto', async () => {
        const abilityResponse = {
            pillar: { ...mockCharacter.pillars[0], actualMana: 15 },
        }
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([mockCharacter]) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(abilityResponse) })

        render(<MemoryRouter><Adventure /></MemoryRouter>)
        await waitFor(() => expect(screen.queryByText(/Carregando/i)).not.toBeInTheDocument())

        await addCharacterToSession()

        await userEvent.click(screen.getByRole('button', { name: /Usar Habilidade/i }))
        await userEvent.click(screen.getByRole('button', { name: /^Usar$/i }))

        await waitFor(() => {
            const calls = vi.mocked(fetch).mock.calls
            const abilityCall = calls.find(([, opts]) => opts?.method === 'POST')
            expect(abilityCall).toBeDefined()
            const body = JSON.parse(abilityCall[1].body)
            expect(body.abilityId).toBe(1)
        })
    })
})

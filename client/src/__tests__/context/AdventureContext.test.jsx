import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { AuthProvider } from '../../context/AuthContext'
import { AdventureProvider, useAdventure } from '../../context/AdventureContext'

vi.mock('../../logger', () => ({
    default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    API_URL: '',
}))

function Consumer() {
    const { adventures, currentAdventure, isMaster, loading, selectAdventure, deselectAdventure } = useAdventure()
    if (loading) return <span data-testid="loading">loading</span>
    return (
        <div>
            <span data-testid="current">{currentAdventure ? currentAdventure.nome : 'none'}</span>
            <span data-testid="role">{currentAdventure?.role ?? 'none'}</span>
            <span data-testid="is-master">{String(isMaster)}</span>
            <span data-testid="count">{adventures.length}</span>
            <button onClick={() => selectAdventure(7)}>Select7</button>
            <button onClick={() => deselectAdventure()}>Deselect</button>
        </div>
    )
}

function renderTree() {
    return render(
        <AuthProvider>
            <AdventureProvider>
                <Consumer />
            </AdventureProvider>
        </AuthProvider>
    )
}

describe('AdventureContext', () => {
    beforeEach(() => {
        global.fetch = vi.fn()
    })

    it('quando usuário tem 0 aventuras, fica sem currentAdventure', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 1, username: 'u', adventures: [], currentAdventure: null }) })
        renderTree()
        await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument())
        expect(screen.getByTestId('current').textContent).toBe('none')
        expect(screen.getByTestId('count').textContent).toBe('0')
    })

    it('quando usuário tem 1 aventura e nenhuma selecionada, auto-seleciona', async () => {
        fetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({
                id: 1, username: 'u',
                adventures: [{ id: 7, nome: 'Solo', role: 'master' }],
                currentAdventure: null,
            }) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({
                adventure: { id: 7, nome: 'Solo' }, role: 'master',
            }) })
        renderTree()
        await waitFor(() => expect(screen.getByTestId('current').textContent).toBe('Solo'))
        expect(fetch).toHaveBeenCalledWith('/api/adventures/7/select', expect.objectContaining({ method: 'POST' }))
        expect(screen.getByTestId('is-master').textContent).toBe('true')
    })

    it('quando currentAdventure já vem do /me, usa direto', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({
            id: 1, username: 'u',
            adventures: [
                { id: 1, nome: 'A', role: 'player' },
                { id: 2, nome: 'B', role: 'master' },
            ],
            currentAdventure: { id: 2, nome: 'B', role: 'master' },
        }) })
        renderTree()
        await waitFor(() => expect(screen.getByTestId('current').textContent).toBe('B'))
        expect(screen.getByTestId('is-master').textContent).toBe('true')
        expect(fetch).toHaveBeenCalledTimes(1) // não chamou /select
    })

    it('com N aventuras e nenhuma selecionada, não auto-seleciona', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({
            id: 1, username: 'u',
            adventures: [
                { id: 1, nome: 'A', role: 'player' },
                { id: 2, nome: 'B', role: 'master' },
            ],
            currentAdventure: null,
        }) })
        renderTree()
        await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument())
        expect(screen.getByTestId('current').textContent).toBe('none')
        expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('deselectAdventure chama o endpoint e limpa o estado', async () => {
        fetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({
                id: 1, username: 'u',
                adventures: [{ id: 1, nome: 'A', role: 'player' }],
                currentAdventure: { id: 1, nome: 'A', role: 'player' },
            }) })
            .mockResolvedValueOnce({ ok: true, status: 204, json: () => Promise.resolve({}) })

        renderTree()
        await waitFor(() => expect(screen.getByTestId('current').textContent).toBe('A'))
        await act(async () => { screen.getByText('Deselect').click() })
        await waitFor(() => expect(screen.getByTestId('current').textContent).toBe('none'))
        expect(fetch).toHaveBeenCalledWith('/api/adventures/deselect', expect.objectContaining({ method: 'POST' }))
    })
})

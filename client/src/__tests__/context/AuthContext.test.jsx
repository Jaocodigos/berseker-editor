import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../../context/AuthContext'

vi.mock('../../logger', () => ({
    default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    API_URL: '',
}))

function AuthConsumer() {
    const { credentials, loading, login, logout, authHeader } = useAuth()
    if (loading) return <span data-testid="loading">loading</span>
    return (
        <div>
            <span data-testid="credentials">{credentials ? credentials.username : 'none'}</span>
            <span data-testid="auth-header">{JSON.stringify(authHeader)}</span>
            <button onClick={() => login('user', 'pass')}>Login</button>
            <button onClick={logout}>Logout</button>
        </div>
    )
}

describe('AuthContext', () => {
    beforeEach(() => {
        // Simula /api/auth/me retornando 401 por padrão (sem sessão)
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, json: () => Promise.resolve({}) })
    })

    it('começa em loading e depois mostra sem credentials quando /me retorna 401', async () => {
        render(<AuthProvider><AuthConsumer /></AuthProvider>)
        expect(screen.getByTestId('loading')).toBeInTheDocument()
        await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument())
        expect(screen.getByTestId('credentials').textContent).toBe('none')
    })

    it('carrega credentials da sessão ativa ao inicializar (/me retorna usuário)', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ id: 1, username: 'user' }),
        })
        render(<AuthProvider><AuthConsumer /></AuthProvider>)
        await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument())
        expect(screen.getByTestId('credentials').textContent).toBe('user')
    })

    it('login bem-sucedido atualiza credentials', async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 401 })             // /me inicial
            .mockResolvedValueOnce({                                        // POST /login
                ok: true,
                json: () => Promise.resolve({ id: 1, username: 'user' }),
            })
        render(<AuthProvider><AuthConsumer /></AuthProvider>)
        await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument())
        await userEvent.click(screen.getByText('Login'))
        await waitFor(() => expect(screen.getByTestId('credentials').textContent).toBe('user'))
    })

    it('login chama POST /api/auth/login com JSON body', async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: false, status: 401 })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({ id: 1, username: 'user' }),
            })
        let loginFn
        function Capture() { loginFn = useAuth().login; return null }
        render(<AuthProvider><Capture /></AuthProvider>)
        await waitFor(() => expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(0))
        await act(() => loginFn('user', 'pass'))
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/auth/login'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ username: 'user', password: 'pass' }),
            })
        )
    })

    it('login falho lança erro e não altera credentials', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 })
        let loginFn
        function Capture() { loginFn = useAuth().login; return null }
        render(<AuthProvider><Capture /></AuthProvider>)
        await waitFor(() => expect(vi.mocked(fetch).mock.calls.length).toBeGreaterThan(0))
        await expect(loginFn('bad', 'creds')).rejects.toThrow('Credenciais inválidas')
    })

    it('logout chama POST /api/auth/logout e limpa credentials', async () => {
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 1, username: 'user' }) })
            .mockResolvedValueOnce({ ok: true, status: 204 })
        render(<AuthProvider><AuthConsumer /></AuthProvider>)
        await waitFor(() => expect(screen.getByTestId('credentials').textContent).toBe('user'))
        await userEvent.click(screen.getByText('Logout'))
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/auth/logout'),
            expect.objectContaining({ method: 'POST' })
        )
        await waitFor(() => expect(screen.getByTestId('credentials').textContent).toBe('none'))
    })

    it('authHeader é sempre objeto vazio (cookies são automáticos)', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 })
        render(<AuthProvider><AuthConsumer /></AuthProvider>)
        await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument())
        expect(JSON.parse(screen.getByTestId('auth-header').textContent)).toEqual({})
    })
})

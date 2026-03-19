import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from '../../context/AuthContext'

// Evita que logger.js chame fetch e exporta API_URL (usado em AuthContext)
vi.mock('../../logger', () => ({
    default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    API_URL: '',
}))

function AuthConsumer() {
    const { credentials, login, logout, authHeader } = useAuth()
    return (
        <div>
            <span data-testid="credentials">{credentials ?? 'none'}</span>
            <span data-testid="auth-header">{JSON.stringify(authHeader)}</span>
            <button onClick={() => login('user', 'pass')}>Login</button>
            <button onClick={logout}>Logout</button>
        </div>
    )
}

describe('AuthContext', () => {
    beforeEach(() => {
        localStorage.clear()
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204, json: () => Promise.resolve({}) })
    })

    it('começa sem credentials quando localStorage está vazio', () => {
        render(<AuthProvider><AuthConsumer /></AuthProvider>)
        expect(screen.getByTestId('credentials').textContent).toBe('none')
    })

    it('carrega credentials do localStorage na inicialização', () => {
        localStorage.setItem('auth_credentials', 'dXNlcjpwYXNz')
        render(<AuthProvider><AuthConsumer /></AuthProvider>)
        expect(screen.getByTestId('credentials').textContent).toBe('dXNlcjpwYXNz')
    })

    it('login bem-sucedido salva credentials no localStorage', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ id: 1, username: 'user' }),
        })
        render(<AuthProvider><AuthConsumer /></AuthProvider>)
        await userEvent.click(screen.getByText('Login'))
        await waitFor(() => {
            expect(localStorage.getItem('auth_credentials')).not.toBeNull()
            expect(screen.getByTestId('credentials').textContent).not.toBe('none')
        })
    })

    it('login chama fetch com header Authorization Base64', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ id: 1, username: 'user' }),
        })
        let loginFn
        function Capture() {
            loginFn = useAuth().login
            return null
        }
        render(<AuthProvider><Capture /></AuthProvider>)
        await act(() => loginFn('user', 'pass'))
        const expectedEncoded = btoa('user:pass')
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('/api/auth/login'),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: `Basic ${expectedEncoded}`,
                }),
            })
        )
    })

    it('login falho lança erro e não salva credentials', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false })
        let loginFn
        function Capture() {
            loginFn = useAuth().login
            return null
        }
        render(<AuthProvider><Capture /></AuthProvider>)
        await expect(loginFn('bad', 'creds')).rejects.toThrow('Credenciais inválidas')
        expect(localStorage.getItem('auth_credentials')).toBeNull()
    })

    it('logout limpa credentials e remove do localStorage', async () => {
        localStorage.setItem('auth_credentials', 'dXNlcjpwYXNz')
        render(<AuthProvider><AuthConsumer /></AuthProvider>)
        await userEvent.click(screen.getByText('Logout'))
        expect(localStorage.getItem('auth_credentials')).toBeNull()
        expect(screen.getByTestId('credentials').textContent).toBe('none')
    })

    it('authHeader retorna Authorization quando autenticado', () => {
        localStorage.setItem('auth_credentials', 'dXNlcjpwYXNz')
        render(<AuthProvider><AuthConsumer /></AuthProvider>)
        const header = JSON.parse(screen.getByTestId('auth-header').textContent)
        expect(header.Authorization).toBe('Basic dXNlcjpwYXNz')
    })

    it('authHeader retorna objeto vazio quando não autenticado', () => {
        render(<AuthProvider><AuthConsumer /></AuthProvider>)
        const header = JSON.parse(screen.getByTestId('auth-header').textContent)
        expect(header).toEqual({})
    })
})

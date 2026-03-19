import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from '../../pages/Login'

const mockLogin = vi.fn()
const mockNavigate = vi.fn()

vi.mock('../../context/AuthContext', () => ({
    useAuth: () => ({ login: mockLogin }),
}))

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom')
    return { ...actual, useNavigate: () => mockNavigate }
})

describe('Login Page', () => {
    beforeEach(() => vi.clearAllMocks())

    it('renderiza campos de usuário e senha', () => {
        render(<MemoryRouter><Login /></MemoryRouter>)
        expect(screen.getByLabelText('Usuário')).toBeInTheDocument()
        expect(screen.getByLabelText('Senha')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /Entrar/i })).toBeInTheDocument()
    })

    it('chama login com os valores dos campos', async () => {
        mockLogin.mockResolvedValue({ id: 1, username: 'admin' })
        render(<MemoryRouter><Login /></MemoryRouter>)
        await userEvent.type(screen.getByLabelText('Usuário'), 'admin')
        await userEvent.type(screen.getByLabelText('Senha'), 'senha123')
        await userEvent.click(screen.getByRole('button', { name: /Entrar/i }))
        await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('admin', 'senha123'))
    })

    it('navega para / após login bem-sucedido', async () => {
        mockLogin.mockResolvedValue({ id: 1, username: 'admin' })
        render(<MemoryRouter><Login /></MemoryRouter>)
        await userEvent.type(screen.getByLabelText('Usuário'), 'admin')
        await userEvent.type(screen.getByLabelText('Senha'), 'pass')
        await userEvent.click(screen.getByRole('button', { name: /Entrar/i }))
        await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }))
    })

    it('exibe mensagem de erro quando login falha', async () => {
        mockLogin.mockRejectedValue(new Error('Credenciais inválidas'))
        render(<MemoryRouter><Login /></MemoryRouter>)
        await userEvent.type(screen.getByLabelText('Usuário'), 'user')
        await userEvent.type(screen.getByLabelText('Senha'), 'errada')
        await userEvent.click(screen.getByRole('button', { name: /Entrar/i }))
        await waitFor(() =>
            expect(screen.getByText('Usuário ou senha inválidos.')).toBeInTheDocument()
        )
    })

    it('não navega quando login falha', async () => {
        mockLogin.mockRejectedValue(new Error('Credenciais inválidas'))
        render(<MemoryRouter><Login /></MemoryRouter>)
        await userEvent.type(screen.getByLabelText('Usuário'), 'user')
        await userEvent.type(screen.getByLabelText('Senha'), 'errada')
        await userEvent.click(screen.getByRole('button', { name: /Entrar/i }))
        await waitFor(() => expect(mockLogin).toHaveBeenCalled())
        expect(mockNavigate).not.toHaveBeenCalled()
    })

    it('mostra "Entrando..." durante o loading e desabilita o botão', async () => {
        let resolve
        mockLogin.mockReturnValue(new Promise((r) => { resolve = r }))
        render(<MemoryRouter><Login /></MemoryRouter>)
        await userEvent.type(screen.getByLabelText('Usuário'), 'admin')
        await userEvent.type(screen.getByLabelText('Senha'), 'pass')
        await userEvent.click(screen.getByRole('button', { name: /Entrar/i }))
        await waitFor(() => {
            const btn = screen.getByRole('button', { name: /Entrando/i })
            expect(btn).toBeDisabled()
        })
        resolve({ id: 1, username: 'admin' })
    })
})

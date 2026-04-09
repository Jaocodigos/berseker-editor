import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../../components/ProtectedRoute'

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn(),
}))

import { useAuth } from '../../context/AuthContext'

function renderWithRouter(credentials, loading = false, { masterOnly = false } = {}) {
    const isMaster = credentials?.role === 'master'
    useAuth.mockReturnValue({ credentials, loading, isMaster })
    render(
        <MemoryRouter initialEntries={['/protected']}>
            <Routes>
                <Route
                    path="/protected"
                    element={
                        <ProtectedRoute masterOnly={masterOnly}>
                            <div>Conteúdo protegido</div>
                        </ProtectedRoute>
                    }
                />
                <Route path="/login" element={<div>Página de login</div>} />
                <Route path="/" element={<div>Home</div>} />
            </Routes>
        </MemoryRouter>
    )
}

describe('ProtectedRoute', () => {
    it('renderiza children quando há credentials', () => {
        renderWithRouter({ id: 1, username: 'user', role: 'player' })
        expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
        expect(screen.queryByText('Página de login')).not.toBeInTheDocument()
    })

    it('redireciona para /login quando credentials é null', () => {
        renderWithRouter(null)
        expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
        expect(screen.getByText('Página de login')).toBeInTheDocument()
    })

    it('não renderiza nada durante o loading (evita flash do login)', () => {
        renderWithRouter(null, true)
        expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
        expect(screen.queryByText('Página de login')).not.toBeInTheDocument()
    })

    it('redireciona player para Home quando masterOnly é true', () => {
        renderWithRouter({ id: 1, username: 'user', role: 'player' }, false, { masterOnly: true })
        expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
        expect(screen.getByText('Home')).toBeInTheDocument()
    })

    it('permite acesso ao master quando masterOnly é true', () => {
        renderWithRouter({ id: 1, username: 'gm', role: 'master' }, false, { masterOnly: true })
        expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
    })
})

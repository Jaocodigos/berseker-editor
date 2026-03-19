import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../../components/ProtectedRoute'

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn(),
}))

import { useAuth } from '../../context/AuthContext'

function renderWithRouter(credentials, loading = false) {
    useAuth.mockReturnValue({ credentials, loading })
    render(
        <MemoryRouter initialEntries={['/protected']}>
            <Routes>
                <Route
                    path="/protected"
                    element={
                        <ProtectedRoute>
                            <div>Conteúdo protegido</div>
                        </ProtectedRoute>
                    }
                />
                <Route path="/login" element={<div>Página de login</div>} />
            </Routes>
        </MemoryRouter>
    )
}

describe('ProtectedRoute', () => {
    it('renderiza children quando há credentials', () => {
        renderWithRouter({ id: 1, username: 'user' })
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
})

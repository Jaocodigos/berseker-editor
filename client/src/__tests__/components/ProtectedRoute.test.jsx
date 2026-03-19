import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../../components/ProtectedRoute'

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn(),
}))

import { useAuth } from '../../context/AuthContext'

function renderWithRouter(credentials) {
    useAuth.mockReturnValue({ credentials })
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
        renderWithRouter('dXNlcjpwYXNz')
        expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
        expect(screen.queryByText('Página de login')).not.toBeInTheDocument()
    })

    it('redireciona para /login quando credentials é null', () => {
        renderWithRouter(null)
        expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
        expect(screen.getByText('Página de login')).toBeInTheDocument()
    })

    it('redireciona para /login quando credentials é string vazia', () => {
        renderWithRouter('')
        expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
        expect(screen.getByText('Página de login')).toBeInTheDocument()
    })
})

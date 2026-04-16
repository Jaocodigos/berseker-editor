import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import ProtectedRoute from '../../components/ProtectedRoute'

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn(),
}))

vi.mock('../../context/AdventureContext', () => ({
    useAdventure: vi.fn(),
}))

import { useAuth } from '../../context/AuthContext'
import { useAdventure } from '../../context/AdventureContext'

function renderWithRouter(credentials, {
    authLoading = false,
    advLoading = false,
    currentAdventure = { id: 1, nome: 'main', role: 'player' },
    masterOnly = false,
    requireAdventure = true,
} = {}) {
    const isMaster = currentAdventure?.role === 'master'
    useAuth.mockReturnValue({ credentials, loading: authLoading })
    useAdventure.mockReturnValue({ currentAdventure, isMaster, loading: advLoading })
    render(
        <MemoryRouter initialEntries={['/protected']}>
            <Routes>
                <Route
                    path="/protected"
                    element={
                        <ProtectedRoute masterOnly={masterOnly} requireAdventure={requireAdventure}>
                            <div>Conteúdo protegido</div>
                        </ProtectedRoute>
                    }
                />
                <Route path="/login" element={<div>Página de login</div>} />
                <Route path="/select-adventure" element={<div>Selecionar aventura</div>} />
                <Route path="/" element={<div>Home</div>} />
            </Routes>
        </MemoryRouter>
    )
}

describe('ProtectedRoute', () => {
    it('renderiza children quando há credentials e aventura selecionada', () => {
        renderWithRouter({ id: 1, username: 'user' })
        expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
        expect(screen.queryByText('Página de login')).not.toBeInTheDocument()
    })

    it('redireciona para /login quando credentials é null', () => {
        renderWithRouter(null)
        expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
        expect(screen.getByText('Página de login')).toBeInTheDocument()
    })

    it('não renderiza nada durante o loading do auth (evita flash do login)', () => {
        renderWithRouter(null, { authLoading: true })
        expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
        expect(screen.queryByText('Página de login')).not.toBeInTheDocument()
    })

    it('não renderiza nada durante o loading da aventura', () => {
        renderWithRouter({ id: 1, username: 'user' }, { advLoading: true, currentAdventure: null })
        expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
        expect(screen.queryByText('Selecionar aventura')).not.toBeInTheDocument()
    })

    it('redireciona para /select-adventure quando não há aventura e requireAdventure=true', () => {
        renderWithRouter({ id: 1, username: 'user' }, { currentAdventure: null })
        expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
        expect(screen.getByText('Selecionar aventura')).toBeInTheDocument()
    })

    it('permite renderizar sem aventura quando requireAdventure=false', () => {
        renderWithRouter({ id: 1, username: 'user' }, { currentAdventure: null, requireAdventure: false })
        expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
    })

    it('redireciona player para Home quando masterOnly é true', () => {
        renderWithRouter({ id: 1, username: 'user' }, {
            masterOnly: true,
            currentAdventure: { id: 1, nome: 'main', role: 'player' },
        })
        expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument()
        expect(screen.getByText('Home')).toBeInTheDocument()
    })

    it('permite acesso ao master quando masterOnly é true', () => {
        renderWithRouter({ id: 1, username: 'gm' }, {
            masterOnly: true,
            currentAdventure: { id: 1, nome: 'main', role: 'master' },
        })
        expect(screen.getByText('Conteúdo protegido')).toBeInTheDocument()
    })
})

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Home from '../../pages/Home'

describe('Home Page', () => {
    it('renderiza o título principal', () => {
        render(<MemoryRouter><Home /></MemoryRouter>)
        expect(screen.getByText('Bersekerlandia')).toBeInTheDocument()
    })

    it('renderiza os três passos do guia', () => {
        render(<MemoryRouter><Home /></MemoryRouter>)
        expect(screen.getByText('Crie seus Personagens')).toBeInTheDocument()
        expect(screen.getByText('Configure as Habilidades')).toBeInTheDocument()
        expect(screen.getByText('Inicie a Aventura')).toBeInTheDocument()
    })

    it('renderiza os links de ação do hero', () => {
        render(<MemoryRouter><Home /></MemoryRouter>)
        expect(screen.getByText('Criar Personagem')).toBeInTheDocument()
        expect(screen.getByText('Iniciar Aventura')).toBeInTheDocument()
    })

    it('renderiza as ações de combate', () => {
        render(<MemoryRouter><Home /></MemoryRouter>)
        expect(screen.getByText('Receber Dano')).toBeInTheDocument()
        expect(screen.getByText('Usar Habilidade')).toBeInTheDocument()
        expect(screen.getByText('Descanso Curto')).toBeInTheDocument()
        expect(screen.getByText('Descanso Longo')).toBeInTheDocument()
    })

    it('renderiza a seção de dicas', () => {
        render(<MemoryRouter><Home /></MemoryRouter>)
        expect(screen.getByText('Dicas Rápidas')).toBeInTheDocument()
    })

    it('links apontam para as rotas corretas', () => {
        render(<MemoryRouter><Home /></MemoryRouter>)
        const createLink = screen.getByText('Criar Personagem')
        expect(createLink.closest('a')).toHaveAttribute('href', '/characters')
        const adventureLink = screen.getByText('Iniciar Aventura')
        expect(adventureLink.closest('a')).toHaveAttribute('href', '/adventure')
    })
})

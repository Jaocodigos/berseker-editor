import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CharacterFilter from '../../components/CharacterFilter'

const titles = [
    { id: 5, nome: 'Herói', color: '#ff0000' },
    { id: 6, nome: 'Vilão', color: '#000000' },
]

function setup(initial = { name: '', titleIds: [] }) {
    const onFiltersChange = vi.fn()
    const utils = render(
        <CharacterFilter
            titles={titles}
            filters={initial}
            onFiltersChange={onFiltersChange}
        />,
    )
    return { ...utils, onFiltersChange }
}

describe('CharacterFilter', () => {
    it('renderiza botao com label "Filtrar"', () => {
        setup()
        expect(screen.getByRole('button', { name: /filtrar/i })).toBeInTheDocument()
    })

    it('painel começa fechado e abre ao clicar', async () => {
        setup()
        expect(screen.queryByText('Títulos')).not.toBeInTheDocument()
        await userEvent.click(screen.getByRole('button', { name: /filtrar/i }))
        expect(screen.getByText('Títulos')).toBeInTheDocument()
    })

    it('fecha o painel ao clicar novamente', async () => {
        setup()
        const btn = screen.getByRole('button', { name: /filtrar/i })
        await userEvent.click(btn)
        await userEvent.click(btn)
        expect(screen.queryByText('Títulos')).not.toBeInTheDocument()
    })

    it('digitar no input chama onFiltersChange com name atualizado', async () => {
        const { onFiltersChange } = setup()
        await userEvent.click(screen.getByRole('button', { name: /filtrar/i }))
        const input = screen.getByPlaceholderText('Buscar por nome')
        await userEvent.type(input, 'A')
        expect(onFiltersChange).toHaveBeenCalledWith({ name: 'A', titleIds: [] })
    })

    it('clique em checkbox de titulo adiciona ID em titleIds', async () => {
        const { onFiltersChange } = setup()
        await userEvent.click(screen.getByRole('button', { name: /filtrar/i }))
        const heroCheckbox = screen.getByLabelText('Herói')
        await userEvent.click(heroCheckbox)
        expect(onFiltersChange).toHaveBeenCalledWith({ name: '', titleIds: [5] })
    })

    it('clique em checkbox ja marcada remove o ID', async () => {
        const { onFiltersChange } = setup({ name: '', titleIds: [5] })
        await userEvent.click(screen.getByRole('button', { name: /filtrar/i }))
        await userEvent.click(screen.getByLabelText('Herói'))
        expect(onFiltersChange).toHaveBeenCalledWith({ name: '', titleIds: [] })
    })

    it('checkbox "Sem titulo" alterna sentinel "null"', async () => {
        const { onFiltersChange } = setup()
        await userEvent.click(screen.getByRole('button', { name: /filtrar/i }))
        await userEvent.click(screen.getByLabelText('Sem título'))
        expect(onFiltersChange).toHaveBeenCalledWith({ name: '', titleIds: ['null'] })
    })

    it('checkboxes nao sao mutuamente exclusivas', async () => {
        const { onFiltersChange } = setup({ name: '', titleIds: [5] })
        await userEvent.click(screen.getByRole('button', { name: /filtrar/i }))
        await userEvent.click(screen.getByLabelText('Vilão'))
        expect(onFiltersChange).toHaveBeenCalledWith({ name: '', titleIds: [5, 6] })
    })

    it('botao "Limpar" reseta filters', async () => {
        const { onFiltersChange } = setup({ name: 'ara', titleIds: [5, 'null'] })
        await userEvent.click(screen.getByRole('button', { name: /filtrar/i }))
        await userEvent.click(screen.getByRole('button', { name: /limpar/i }))
        expect(onFiltersChange).toHaveBeenCalledWith({ name: '', titleIds: [] })
    })

    it('badge aparece com contador quando ha nome preenchido', () => {
        setup({ name: 'ara', titleIds: [] })
        expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('badge soma nome + titulos (max 2)', () => {
        setup({ name: 'ara', titleIds: [5, 6] })
        expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('nao renderiza badge quando sem filtros', () => {
        setup()
        expect(screen.queryByText(/^[12]$/)).not.toBeInTheDocument()
    })
})

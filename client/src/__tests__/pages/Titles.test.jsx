import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Titles from '../../pages/Titles'

vi.mock('../../logger', () => ({
    default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    API_URL: '',
}))

describe('Titles Page', () => {
    beforeEach(() => {
        global.confirm = vi.fn(() => true)
        global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([]) })
    })

    it('exibe mensagem quando não há títulos', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
        render(<Titles />)
        await waitFor(() => {
            expect(screen.getByText(/Nenhum título cadastrado/)).toBeInTheDocument()
        })
    })

    it('lista títulos com nome colorido', async () => {
        const titles = [
            { id: 1, nome: 'Herói', color: '#ff0000' },
            { id: 2, nome: 'Vilão', color: '#00ff00' },
        ]
        global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(titles) })
        render(<Titles />)
        await waitFor(() => {
            const nome = screen.getByText('Herói')
            expect(nome).toBeInTheDocument()
            expect(nome).toHaveStyle({ color: 'rgb(255, 0, 0)' })
            expect(screen.getByText('Vilão')).toBeInTheDocument()
        })
    })

    it('cria novo título com POST', async () => {
        const created = { id: 3, nome: 'Sábio', color: '#f1f5f9' }
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(created) })

        render(<Titles />)
        await waitFor(() => expect(screen.getByPlaceholderText('Nome do título')).toBeInTheDocument())

        await userEvent.type(screen.getByPlaceholderText('Nome do título'), 'Sábio')
        await userEvent.click(screen.getByText('Criar'))

        await waitFor(() => {
            const postCall = vi.mocked(fetch).mock.calls.find(([, opts]) => opts?.method === 'POST')
            expect(postCall).toBeDefined()
            const body = JSON.parse(postCall[1].body)
            expect(body.nome).toBe('Sábio')
            expect(body.color).toMatch(/^#[0-9a-fA-F]{6}$/)
        })
    })

    it('exibe erro quando submit sem nome', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) })
        render(<Titles />)
        await waitFor(() => expect(screen.getByText('Criar')).toBeInTheDocument())
        await userEvent.click(screen.getByText('Criar'))
        expect(screen.getByText('Nome obrigatório')).toBeInTheDocument()
    })

    it('deleta título após confirmação', async () => {
        const titles = [{ id: 1, nome: 'Herói', color: '#ff0000' }]
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(titles) })
            .mockResolvedValueOnce({ ok: true, status: 204 })

        render(<Titles />)
        await waitFor(() => expect(screen.getByText('Herói')).toBeInTheDocument())

        const deleteBtn = screen.getByTitle('Deletar')
        await userEvent.click(deleteBtn)

        await waitFor(() => {
            const deleteCall = vi.mocked(fetch).mock.calls.find(([, opts]) => opts?.method === 'DELETE')
            expect(deleteCall).toBeDefined()
            expect(deleteCall[0]).toContain('/api/titles/1')
        })
    })

    it('cancela delete se usuário negar', async () => {
        global.confirm = vi.fn(() => false)
        const titles = [{ id: 1, nome: 'Herói', color: '#ff0000' }]
        global.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(titles) })

        render(<Titles />)
        await waitFor(() => expect(screen.getByText('Herói')).toBeInTheDocument())

        await userEvent.click(screen.getByTitle('Deletar'))

        const deleteCall = vi.mocked(fetch).mock.calls.find(([, opts]) => opts?.method === 'DELETE')
        expect(deleteCall).toBeUndefined()
    })

    it('edita título com PATCH', async () => {
        const titles = [{ id: 1, nome: 'Herói', color: '#ff0000' }]
        const updated = { id: 1, nome: 'Lenda', color: '#ff0000' }
        global.fetch = vi.fn()
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(titles) })
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(updated) })

        render(<Titles />)
        await waitFor(() => expect(screen.getByText('Herói')).toBeInTheDocument())

        await userEvent.click(screen.getByTitle('Editar'))
        const editInput = screen.getByDisplayValue('Herói')
        await userEvent.clear(editInput)
        await userEvent.type(editInput, 'Lenda')
        await userEvent.click(screen.getByTitle('Salvar'))

        await waitFor(() => {
            const patchCall = vi.mocked(fetch).mock.calls.find(([, opts]) => opts?.method === 'PATCH')
            expect(patchCall).toBeDefined()
            const body = JSON.parse(patchCall[1].body)
            expect(body.nome).toBe('Lenda')
        })
    })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Modal from '../../components/Modal'

describe('Modal', () => {
    it('não renderiza nada quando open é false', () => {
        const { container } = render(
            <Modal title="Teste" open={false} onClose={() => {}}>
                <p>conteúdo</p>
            </Modal>
        )
        expect(container.innerHTML).toBe('')
    })

    it('renderiza título e conteúdo quando open é true', () => {
        render(
            <Modal title="Meu Modal" open={true} onClose={() => {}}>
                <p>conteúdo do modal</p>
            </Modal>
        )
        expect(screen.getByText('Meu Modal')).toBeInTheDocument()
        expect(screen.getByText('conteúdo do modal')).toBeInTheDocument()
    })

    it('chama onClose ao clicar no botão de fechar', async () => {
        const user = userEvent.setup()
        const onClose = vi.fn()
        render(
            <Modal title="Fechar" open={true} onClose={onClose}>
                <p>corpo</p>
            </Modal>
        )
        await user.click(screen.getByText('✖'))
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('renderiza sem título quando title não é fornecido', () => {
        render(
            <Modal open={true} onClose={() => {}}>
                <p>sem título</p>
            </Modal>
        )
        expect(screen.getByText('sem título')).toBeInTheDocument()
        expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    })
})

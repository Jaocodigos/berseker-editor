import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdventure } from '../context/AdventureContext'

export default function AdventureSelect() {
    const { adventures, currentAdventure, loading, selectAdventure } = useAdventure()
    const navigate = useNavigate()
    const [error, setError] = useState('')
    const [pendingId, setPendingId] = useState(null)

    useEffect(() => {
        if (currentAdventure) navigate('/', { replace: true })
    }, [currentAdventure, navigate])

    const handleSelect = async (id) => {
        setError('')
        setPendingId(id)
        try {
            await selectAdventure(id)
            navigate('/', { replace: true })
        } catch {
            setError('Não foi possível selecionar a aventura. Tente novamente.')
        } finally {
            setPendingId(null)
        }
    }

    if (loading || currentAdventure || adventures.length === 1) return null

    if (adventures.length === 0) {
        return (
            <div className="adventure-select-page">
                <div className="adventure-select-empty">
                    <div className="adventure-select-icon">⚔</div>
                    <h1>Nenhuma aventura disponível</h1>
                    <p>Você ainda não foi adicionado a nenhuma aventura. Fale com o administrador.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="adventure-select-page">
            <header className="adventure-select-header">
                <h1>Escolha sua Aventura</h1>
                <p>Selecione uma aventura para começar.</p>
            </header>

            {error && <div className="adventure-select-error">{error}</div>}

            <ul className="adventure-select-list">
                {adventures.map((adv) => (
                    <li key={adv.id} className="adventure-select-item">
                        <button
                            type="button"
                            className="adventure-select-card"
                            onClick={() => handleSelect(adv.id)}
                            disabled={pendingId === adv.id}
                        >
                            <span className="adventure-select-name">{adv.nome}</span>
                            <span className={`adventure-select-role adventure-select-role--${adv.role}`}>
                                {adv.role === 'master' ? 'Mestre' : 'Jogador'}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    )
}

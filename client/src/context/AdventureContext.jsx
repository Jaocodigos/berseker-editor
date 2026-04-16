import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import logger, { API_URL } from '../logger'
import { useAuth } from './AuthContext'

const AdventureContext = createContext(null)

export function AdventureProvider({ children }) {
    const { credentials, loading: authLoading } = useAuth()
    const [currentAdventure, setCurrentAdventure] = useState(null)
    const [loading, setLoading] = useState(true)
    const autoSelectedRef = useRef(false)

    const adventures = credentials?.adventures ?? []

    // Sincroniza a aventura atual a partir das credenciais e faz auto-seleção se houver apenas uma.
    useEffect(() => {
        if (authLoading) return

        if (!credentials) {
            setCurrentAdventure(null)
            autoSelectedRef.current = false
            setLoading(false)
            return
        }

        if (credentials.currentAdventure) {
            setCurrentAdventure(credentials.currentAdventure)
            setLoading(false)
            return
        }

        if (adventures.length === 1 && !autoSelectedRef.current) {
            autoSelectedRef.current = true
            selectAdventure(adventures[0].id)
                .catch(() => { autoSelectedRef.current = false })
                .finally(() => setLoading(false))
            return
        }

        setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [credentials, authLoading])

    const selectAdventure = useCallback(async (id) => {
        const res = await fetch(`${API_URL}/api/adventures/${id}/select`, { method: 'POST' })
        if (!res.ok) {
            logger.warn('adventure: falha ao selecionar', { id })
            throw new Error('Falha ao selecionar aventura')
        }
        const data = await res.json()
        const next = { id: data.adventure.id, nome: data.adventure.nome, role: data.role }
        setCurrentAdventure(next)
        logger.info('adventure: selecionada', { id: next.id })
        return next
    }, [])

    const deselectAdventure = useCallback(async () => {
        await fetch(`${API_URL}/api/adventures/deselect`, { method: 'POST' })
        setCurrentAdventure(null)
        autoSelectedRef.current = false
        logger.info('adventure: deselecionada')
    }, [])

    const isMaster = currentAdventure?.role === 'master'

    return (
        <AdventureContext.Provider value={{
            adventures,
            currentAdventure,
            loading: authLoading || loading,
            isMaster,
            selectAdventure,
            deselectAdventure,
        }}>
            {children}
        </AdventureContext.Provider>
    )
}

export function useAdventure() {
    return useContext(AdventureContext)
}

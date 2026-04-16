import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import logger, { API_URL } from '../logger'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [credentials, setCredentials] = useState(null)
    const [loading, setLoading] = useState(true)

    // Verifica sessão ativa ao carregar a aplicação
    useEffect(() => {
        fetch(`${API_URL}/api/auth/me`)
            .then(res => res.ok ? res.json() : null)
            .then(user => setCredentials(user))
            .catch(() => setCredentials(null))
            .finally(() => setLoading(false))
    }, [])

    const login = useCallback(async (username, password) => {
        const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        })

        if (!res.ok) {
            logger.warn('login: falha', { username })
            throw new Error('Credenciais inválidas')
        }

        const user = await res.json()
        logger.info('login: sucesso', { username })
        setCredentials(user)
        return user
    }, [])

    const logout = useCallback(async () => {
        logger.info('logout')
        await fetch(`${API_URL}/api/auth/logout`, { method: 'POST' })
        setCredentials(null)
    }, [])

    // authHeader mantido como {} para compatibilidade — cookies são enviados automaticamente
    const authHeader = {}

    return (
        <AuthContext.Provider value={{ credentials, login, logout, authHeader, loading }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext)
}

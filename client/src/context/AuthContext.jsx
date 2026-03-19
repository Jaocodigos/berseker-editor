import { createContext, useContext, useState, useCallback } from 'react'
import logger, { API_URL } from '../logger'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
    const [credentials, setCredentials] = useState(() => {
        return localStorage.getItem('auth_credentials') || null
    })

    const login = useCallback(async (username, password) => {
        const encoded = btoa(`${username}:${password}`)
        const res = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Authorization': `Basic ${encoded}` }
        })

        if (!res.ok) {
            logger.warn('login: falha', { username })
            throw new Error('Credenciais inválidas')
        }

        localStorage.setItem('auth_credentials', encoded)
        setCredentials(encoded)
        const user = await res.json()
        logger.info('login: sucesso', { username })
        return user
    }, [])

    const logout = useCallback(() => {
        logger.info('logout')
        localStorage.removeItem('auth_credentials')
        setCredentials(null)
    }, [])

    const authHeader = credentials
        ? { 'Authorization': `Basic ${credentials}` }
        : {}

    return (
        <AuthContext.Provider value={{ credentials, login, logout, authHeader }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return useContext(AuthContext)
}

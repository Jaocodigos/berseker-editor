import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, masterOnly = false }) {
    const { credentials, loading, isMaster } = useAuth()

    if (loading) return null

    if (!credentials) {
        return <Navigate to="/login" replace />
    }

    if (masterOnly && !isMaster) {
        return <Navigate to="/" replace />
    }

    return children
}

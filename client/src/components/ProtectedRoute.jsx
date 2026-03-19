import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
    const { credentials, loading } = useAuth()

    if (loading) return null

    if (!credentials) {
        return <Navigate to="/login" replace />
    }

    return children
}

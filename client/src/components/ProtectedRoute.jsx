import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
    const { credentials } = useAuth()

    if (!credentials) {
        return <Navigate to="/login" replace />
    }

    return children
}

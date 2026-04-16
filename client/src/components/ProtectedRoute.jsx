import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useAdventure } from '../context/AdventureContext'

export default function ProtectedRoute({ children, masterOnly = false, requireAdventure = true }) {
    const { credentials, loading: authLoading } = useAuth()
    const { currentAdventure, isMaster, loading: advLoading } = useAdventure()

    if (authLoading || advLoading) return null

    if (!credentials) {
        return <Navigate to="/login" replace />
    }

    if (requireAdventure && !currentAdventure) {
        return <Navigate to="/select-adventure" replace />
    }

    if (masterOnly && !isMaster) {
        return <Navigate to="/" replace />
    }

    return children
}

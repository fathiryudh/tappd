import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-zinc-950">
        <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return children
}

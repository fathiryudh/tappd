import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-4" style={{ background: '#F7F7F9' }}>
        <div
          className="rounded-[1.5rem] border p-2"
          style={{ background: '#FFFFFF', borderColor: '#E4E7EC' }}
        >
          <div
            className="flex items-center gap-3 rounded-[calc(1.5rem-0.5rem)] px-6 py-4"
            style={{ background: '#F9FAFB' }}
          >
            <div className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ background: '#1F69FF' }} />
            <span style={{ color: '#667085' }}>Restoring session…</span>
          </div>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return children
}

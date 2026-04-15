import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Roster from './pages/Roster'
import Dashboard from './pages/Dashboard'
import LegacyLoginPreview from './pages/preview/LegacyLoginPreview'
import LegacyRegisterPreview from './pages/preview/LegacyRegisterPreview'
import LegacyRosterPreview from './pages/preview/LegacyRosterPreview'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/roster" element={<Roster />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/preview/legacy/login" element={<LegacyLoginPreview />} />
          <Route path="/preview/legacy/register" element={<LegacyRegisterPreview />} />
          <Route path="/preview/legacy/roster" element={<LegacyRosterPreview />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

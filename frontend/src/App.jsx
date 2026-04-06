import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import Home from './pages/Home'
import Services from './pages/Services'
import Suspension from './pages/Suspension'
import Booking from './pages/Booking'
import Admin from './pages/Admin'
import SuperAdmin from './pages/SuperAdmin'
import Login from './pages/Login'
import CarProgress from './pages/CarProgress'
import UserDashboard from './pages/UserDashboard'
import SignUp from './pages/SignUp'

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('App crash:', error, info) }
  render() {
    if (this.state.error) {
      const msg = typeof this.state.error?.message === 'string'
        ? this.state.error.message
        : JSON.stringify(this.state.error, null, 2)
      return (
        <div style={{padding:'4rem 2rem',maxWidth:'600px',margin:'0 auto',fontFamily:'sans-serif'}}>
          <h2 style={{color:'#073590',marginBottom:'1rem'}}>⚠️ Algo salió mal</h2>
          <p style={{color:'#5a6a8a',marginBottom:'1.5rem'}}>Hubo un error en esta página. Intenta recargar.</p>
          <pre style={{background:'#f5f7ff',padding:'1rem',fontSize:'0.75rem',color:'#c0392b',whiteSpace:'pre-wrap',borderRadius:'4px',marginBottom:'1.5rem'}}>{msg}</pre>
          <button onClick={() => { this.setState({ error: null }); window.location.href = '/' }}
            style={{background:'#073590',color:'white',border:'none',padding:'0.75rem 1.5rem',borderRadius:'4px',cursor:'pointer'}}>
            Volver al inicio
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{padding:'4rem',textAlign:'center',color:'var(--black)'}}>Cargando…</div>
  if (!user) return <Navigate to="/login" replace />
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: '64px', minHeight: 'calc(100vh - 64px)' }}>
        <Routes>
          <Route path="/"             element={<ErrorBoundary><Home /></ErrorBoundary>} />
          <Route path="/servicios"    element={<ErrorBoundary><Services /></ErrorBoundary>} />
          <Route path="/suspension"   element={<ErrorBoundary><Suspension /></ErrorBoundary>} />
          <Route path="/reservar"     element={<ErrorBoundary><Booking /></ErrorBoundary>} />
          <Route path="/login"        element={<ErrorBoundary><Login /></ErrorBoundary>} />
          <Route path="/registro"     element={<ErrorBoundary><SignUp /></ErrorBoundary>} />
          <Route path="/mi-cuenta"    element={
            <ProtectedRoute roles={['user','admin','superadmin']}>
              <ErrorBoundary><UserDashboard /></ErrorBoundary>
            </ProtectedRoute>
          }/>
          <Route path="/admin"        element={<ProtectedRoute roles={['admin','superadmin']}><ErrorBoundary><Admin /></ErrorBoundary></ProtectedRoute>}/>
          <Route path="/car-progress" element={<ProtectedRoute roles={['admin','superadmin']}><ErrorBoundary><CarProgress /></ErrorBoundary></ProtectedRoute>}/>
          <Route path="/superadmin"   element={<ProtectedRoute roles={['superadmin']}><ErrorBoundary><SuperAdmin /></ErrorBoundary></ProtectedRoute>}/>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <Footer />
    </>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ErrorBoundary>
  )
}

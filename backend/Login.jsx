import { extractError } from '../api/errors.js'
import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { LogIn, User, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { login } from '../api/index.js'
import { useAuth } from '../context/AuthContext'
import './Login.css'

export default function Login() {
  const [form, setForm]       = useState({ email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw]   = useState(false)
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await login(form)
      loginUser(res.data.access_token, res.data.user)
      const role = res.data.user.role
      navigate(role === 'superadmin' ? '/superadmin' : role === 'admin' ? '/admin' : '/mi-cuenta')
    } catch (err) {
      setError(extractError(err, 'Error al iniciar sesión'))
    } finally {
      setLoading(false)
    }
  }

  const DEMO_USERS = [
    { label: 'SuperAdmin', email: 'superadmin@wecautomotriz.pe', pw: 'SuperWec2024!', color: '#F7C416', text: '#073590' },
    { label: 'Admin',      email: 'admin@wecautomotriz.pe',      pw: 'AdminWec2024!', color: '#073590', text: 'white' },
    { label: 'Usuario',    email: 'user@wecautomotriz.pe',       pw: 'UserWec2024!',  color: '#f0f4ff', text: '#073590' },
  ]

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__header">
          <span className="login-card__icon">🔧</span>
          <div>
            <div className="login-card__talleres-label">TALLERES</div><div className="login-card__bobby">BOBBY</div>
            <div className="login-card__talleres">TALLERES</div>
          </div>
        </div>

        <h2 className="login-card__title">WEC Taller Automotriz</h2>

        {error && <div className="login-error"><AlertCircle size={16} /> {error}</div>}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label><User size={14} /> Email</label>
            <input type="email" placeholder="admin@wecautomotriz.pe" value={form.email}
              onChange={e => setForm({...form, email: e.target.value})} required />
          </div>
          <div className="form-group">
            <label><Lock size={14} /> Contraseña</label>
            <div className="login-pw-wrap">
              <input type={showPw ? 'text' : 'password'} placeholder="••••••••" value={form.password}
                onChange={e => setForm({...form, password: e.target.value})} required />
              <button type="button" className="login-pw-toggle" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
          <button type="submit" className="login-submit" disabled={loading}>
            {loading ? 'Entrando…' : <><LogIn size={16} /> Iniciar Sesión</>}
          </button>
        </form>

        <Link to="/" className="login-back">← Volver al inicio</Link>
        <div style={{marginTop:'1rem',textAlign:'center',fontSize:'0.85rem',color:'var(--gray)'}}>
          ¿No tienes cuenta?{' '}
          <Link to="/registro" style={{color:'var(--black)',fontWeight:'700',textDecoration:'underline'}}>Crear cuenta gratis</Link>
        </div>
      </div>
    </div>
  )
}

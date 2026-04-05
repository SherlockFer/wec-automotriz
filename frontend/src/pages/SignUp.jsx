import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'
import { register } from '../api/index.js'
import { extractError } from '../api/errors.js'
import { useAuth } from '../context/AuthContext'
import './Login.css'

export default function SignUp() {
  const [form,     setForm]     = useState({ name:'', email:'', password:'', confirm:'' })
  const [showPw,   setShowPw]   = useState(false)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const { loginUser } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) { setError('Las contraseñas no coinciden'); return }
    if (form.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return }
    setError(''); setLoading(true)
    try {
      const res = await register({ name: form.name, email: form.email, password: form.password, role: 'user' })
      loginUser(res.data.access_token, res.data.user)
      navigate('/mi-cuenta')
    } catch(err) { setError(extractError(err, 'Error al crear cuenta')) }
    finally { setLoading(false) }
  }

  const BENEFITS = ['Seguimiento en tiempo real de tu vehículo','Historial completo de reparaciones','Chat directo con el taller','Reservas en línea en menos de 5 min','Notificaciones de estado por email']

  return (
    <div className="login-page" style={{alignItems:'flex-start',paddingTop:'3rem'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'3rem',maxWidth:'900px',width:'100%',margin:'0 auto'}}>

        {/* Benefits panel */}
        <div style={{padding:'2rem'}}>
          <div className="login-card__header" style={{marginBottom:'1.5rem'}}>
            <span className="login-card__icon">🔧</span>
            <div>
              <div className="login-card__talleres-label">TALLERES</div>
              <div className="login-card__bobby">BOBBY</div>
            </div>
          </div>
          <h2 style={{fontFamily:'var(--font-display)',fontSize:'2rem',color:'var(--black)',marginBottom:'0.5rem',letterSpacing:'0.03em'}}>CREA TU CUENTA</h2>
          <p style={{color:'var(--gray)',fontSize:'0.9rem',lineHeight:'1.7',marginBottom:'1.5rem'}}>
            Registra tu cuenta gratis y controla el estado de tu vehículo desde cualquier lugar.
          </p>
          <ul style={{listStyle:'none',display:'flex',flexDirection:'column',gap:'0.75rem'}}>
            {BENEFITS.map(b=>(
              <li key={b} style={{display:'flex',alignItems:'center',gap:'0.6rem',fontSize:'0.875rem',color:'var(--text-main)'}}>
                <CheckCircle size={16} color="#1a8a3a" style={{flexShrink:0}}/>
                {b}
              </li>
            ))}
          </ul>
        </div>

        {/* Form */}
        <div className="login-card" style={{maxWidth:'100%'}}>
          <h2 className="login-card__title">Crear cuenta</h2>
          {error && <div className="login-error"><AlertCircle size={15}/> {error}</div>}

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label><User size={13}/> Nombre completo *</label>
              <input type="text" placeholder="Juan Pérez" value={form.name}
                onChange={e=>setForm({...form,name:e.target.value})} required/>
            </div>
            <div className="form-group">
              <label><Mail size={13}/> Email *</label>
              <input type="email" placeholder="correo@ejemplo.com" value={form.email}
                onChange={e=>setForm({...form,email:e.target.value})} required/>
            </div>
            <div className="form-group">
              <label><Lock size={13}/> Contraseña *</label>
              <div className="login-pw-wrap">
                <input type={showPw?'text':'password'} placeholder="Mínimo 6 caracteres" value={form.password}
                  onChange={e=>setForm({...form,password:e.target.value})} required/>
                <button type="button" className="login-pw-toggle" onClick={()=>setShowPw(!showPw)}>
                  {showPw?<EyeOff size={15}/>:<Eye size={15}/>}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label><Lock size={13}/> Confirmar contraseña *</label>
              <input type={showPw?'text':'password'} placeholder="Repite tu contraseña" value={form.confirm}
                onChange={e=>setForm({...form,confirm:e.target.value})} required/>
            </div>
            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? 'Creando cuenta…' : '🚗 Crear mi cuenta gratis'}
            </button>
          </form>

          <div style={{marginTop:'1.5rem',paddingTop:'1.25rem',borderTop:'1px solid #dde5f5',textAlign:'center',fontSize:'0.85rem',color:'var(--gray)'}}>
            ¿Ya tienes cuenta?{' '}
            <Link to="/login" style={{color:'var(--black)',fontWeight:'700',textDecoration:'underline'}}>Iniciar sesión</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

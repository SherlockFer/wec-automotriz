import React, { useState } from 'react'
import { Crown, Shield, User, Eye, ChevronUp, ChevronDown, LogIn } from 'lucide-react'
import { login } from '../api/index.js'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import './DevUserSwitcher.css'

const DEMO_ACCOUNTS = [
  {
    role: 'superadmin',
    label: 'Super Admin',
    email: 'superadmin@wecautomotriz.pe',
    password: 'SuperWec2024!',
    icon: <Crown size={15}/>,
    color: 'white',
    bg: '#073590',
    description: 'Gestión total: usuarios, roles, seed'
  },
  {
    role: 'admin',
    label: 'Admin WEC',
    email: 'admin@wecautomotriz.pe',
    password: 'AdminWec2024!',
    icon: <Shield size={15}/>,
    color: 'white',
    bg: '#052870',
    description: 'Reservas, progreso de autos'
  },
  {
    role: 'admin',
    label: 'Roberto (seed)',
    email: 'roberto@wecautomotriz.pe',
    password: 'Admin2024!',
    icon: <Shield size={15}/>,
    color: 'white',
    bg: '#334e7a',
    description: 'Admin creado por seed'
  },
  {
    role: 'admin',
    label: 'Claudia (seed)',
    email: 'claudia@wecautomotriz.pe',
    password: 'Admin2024!',
    icon: <Shield size={15}/>,
    color: 'white',
    bg: '#334e7a',
    description: 'Admin creado por seed'
  },
  {
    role: 'user',
    label: 'Usuario',
    email: 'user@wecautomotriz.pe',
    password: 'UserWec2024!',
    icon: <User size={15}/>,
    color: '#073590',
    bg: '#e8f0ff',
    description: 'Vista pública del sitio'
  },
  {
    role: 'viewer',
    label: 'Visitante',
    email: null,
    password: null,
    icon: <Eye size={15}/>,
    color: '#5a6a8a',
    bg: '#f5f7ff',
    description: 'Sin sesión — vista de cliente'
  },
]

export default function DevUserSwitcher() {
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(null)
  const { loginUser, logout, user } = useAuth()
  const navigate = useNavigate()

  const switchTo = async (account) => {
    setLoading(account.role)
    try {
      if (account.role === 'viewer') {
        logout()
        navigate('/')
      } else {
        const res = await login({ email: account.email, password: account.password })
        loginUser(res.data.access_token, res.data.user)
        navigate(account.role === 'superadmin' ? '/superadmin' : account.role === 'admin' ? '/admin' : '/')
      }
      setOpen(false)
    } catch(e) {
      console.error('Switch failed', e)
    } finally {
      setLoading(null)
    }
  }

  const currentAccount = DEMO_ACCOUNTS.find(a => a.role === (user?.role || 'viewer'))

  return (
    <div className="dev-switcher">
      <button className="dev-switcher__toggle" onClick={() => setOpen(!open)}>
        <span className="dev-switcher__label">DEV</span>
        <span className="dev-switcher__current">
          {currentAccount?.icon}
          {currentAccount?.label}
        </span>
        {open ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}
      </button>

      {open && (
        <div className="dev-switcher__panel">
          <div className="dev-switcher__panel-title">🔧 Cambiar usuario demo</div>
          {DEMO_ACCOUNTS.map(account => {
            const isActive = (user?.role === account.role) || (!user && account.role === 'viewer')
            return (
              <button
                key={account.role}
                className={`dev-switcher__option ${isActive ? 'dev-switcher__option--active' : ''}`}
                style={{ '--accent-bg': account.bg }}
                onClick={() => switchTo(account)}
                disabled={loading === account.role || isActive}
              >
                <div className="dev-switcher__option-icon" style={{ background: account.bg, color: account.role === 'user' ? '#073590' : 'white' }}>
                  {loading === account.role ? '…' : account.icon}
                </div>
                <div className="dev-switcher__option-info">
                  <div className="dev-switcher__option-name">
                    {account.label}
                    {isActive && <span className="dev-switcher__active-tag">activo</span>}
                  </div>
                  <div className="dev-switcher__option-desc">{account.description}</div>
                </div>
                {!isActive && <LogIn size={14} className="dev-switcher__option-arrow"/>}
              </button>
            )
          })}
          <div className="dev-switcher__footer">Solo visible en desarrollo</div>
        </div>
      )}
    </div>
  )
}

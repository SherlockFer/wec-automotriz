import React, { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Phone, Menu, X, LogOut, User, Shield, Crown } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import './Navbar.css'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open,     setOpen]     = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleLogout = () => { logout(); navigate('/'); setOpen(false) }

  const links = [
    { to: '/',           label: 'Inicio' },
    { to: '/servicios',  label: 'Servicios' },
    { to: '/suspension', label: 'Suspensión' },
    { to: '/reservar',   label: 'Reservar' },
    ...(user && user.role === 'user' ? [{ to: '/mi-cuenta', label: 'Mi Cuenta' }] : []),
    ...(user?.role === 'superadmin' ? [{ to: '/superadmin', label: 'SuperAdmin' }] : []),
    ...(user?.role === 'admin' || user?.role === 'superadmin' ? [{ to: '/admin', label: 'Admin' }] : []),
  ]

  const roleIcon = user?.role === 'superadmin' ? <Crown size={13} /> : user?.role === 'admin' ? <Shield size={13} /> : <User size={13} />

  return (
    <nav className={`navbar ${scrolled ? 'navbar--scrolled' : ''}`}>
      <div className="navbar__inner container">

        {/* LOGO — WEC TALLER AUTOMOTRIZ */}
        <Link to="/" className="navbar__logo">
          <img src="/logo.png" alt="WEC Taller Automotriz" className="navbar__logo-img"
            onError={e=>{e.target.style.display='none'}}/>
          <div className="navbar__logo-text">
            <span className="navbar__logo-talleres">WEC</span>
            <span className="navbar__logo-bobby">TALLER AUTOMOTRIZ</span>
          </div>
        </Link>

        <ul className={`navbar__links ${open ? 'navbar__links--open' : ''}`}>
          {links.map(l => (
            <li key={l.to}>
              <Link to={l.to}
                className={`navbar__link ${location.pathname === l.to ? 'navbar__link--active' : ''}`}
                onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            </li>
          ))}
          <li>
            {user ? (
              <div className="navbar__user">
                <span className="navbar__user-info">{roleIcon} {user.name.split(' ')[0]}</span>
                <button className="navbar__logout" onClick={handleLogout} title="Cerrar sesión"><LogOut size={14} /></button>
              </div>
            ) : (
              <Link to="/login" className="navbar__login-btn" onClick={() => setOpen(false)}>
                <User size={14} /> Acceder
              </Link>
            )}
          </li>
          <li>
            <a href="tel:959868604" className="navbar__phone"><Phone size={14} /> 959 868 604</a>
          </li>
        </ul>

        <button className="navbar__burger" onClick={() => setOpen(!open)}>
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
    </nav>
  )
}

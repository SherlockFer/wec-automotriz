import { extractError } from '../api/errors.js'
import React, { useState, useEffect } from 'react'
import { Crown, Users, Trash2, RefreshCw, ToggleLeft, ToggleRight, Database, Shield, User } from 'lucide-react'
import { getUsers, toggleUser, changeRole, deleteUser, seedData, seedUsers } from '../api/index.js'
import { useAuth } from '../context/AuthContext'
import './SuperAdmin.css'

const ROLE_COLORS = { superadmin: '#F7C416', admin: '#073590', user: '#5a6a8a' }
const ROLE_ICONS  = { superadmin: <Crown size={13}/>, admin: <Shield size={13}/>, user: <User size={13}/> }

export default function SuperAdmin() {
  const { user: me } = useAuth()
  const [users,   setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [msg,     setMsg]     = useState('')
  const [seeding, setSeeding] = useState(false)

  const load = async () => {
    setLoading(true)
    try { const r = await getUsers(); setUsers(r.data) } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const handleToggle = async (id) => {
    await toggleUser(id); load(); flash('Estado actualizado')
  }

  const handleRole = async (id, role) => {
    await changeRole(id, role); load(); flash('Rol actualizado')
  }

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar este usuario?')) return
    await deleteUser(id); load(); flash('Usuario eliminado')
  }

  const handleSeed = async () => {
    if (!confirm('¿Ejecutar el seed completo? Esto creará:\n• 2 cuentas admin\n• 20 reservas por estado (160 total)\n• Entradas de progreso\n\nEsto puede tardar 15-30 segundos.')) return
    setSeeding(true)
    try {
      const r = await seedData()
      const d = r.data.details
      flash(`✅ Seed completado — ${d.admins_created} admins, ${d.total_bookings} reservas, ${d.progress_entries} entradas de progreso`)
    } catch(e) { flash('❌ Error: ' + extractError(e)) }
    finally { setSeeding(false) }
  }

  const handleSeedUsers = async () => {
    if (!confirm('¿Crear 3 usuarios demo con 2 coches cada uno y reservas variadas?')) return
    setSeeding(true)
    try {
      const r = await seedUsers()
      flash(`✅ ${r.data.message} — Contraseña: Demo2024!`)
    } catch(e) { flash('❌ ' + extractError(e)) }
    finally { setSeeding(false) }
  }

  const counts = { superadmin: users.filter(u=>u.role==='superadmin').length, admin: users.filter(u=>u.role==='admin').length, user: users.filter(u=>u.role==='user').length }

  return (
    <div className="sa-page">
      <div className="sa-hero container">
        <div className="section-tag">Panel de control</div>
        <h1 className="section-title" style={{color:'white'}}>SUPER<br /><span style={{color:'var(--accent)'}}>ADMIN</span></h1>
        <p style={{color:'rgba(255,255,255,0.65)'}}>Gestión completa de usuarios, roles y datos del sistema.</p>
      </div>

      <div className="sa-layout container">
        {/* Stats */}
        <div className="sa-stats">
          {[['SuperAdmins',counts.superadmin,'#F7C416','#073590'],['Admins',counts.admin,'#073590','white'],['Usuarios',counts.user,'#f0f4ff','#073590'],['Total',users.length,'#dde5f5','#073590']].map(([label,num,bg,color])=>(
            <div key={label} className="sa-stat" style={{background:bg}}>
              <div className="sa-stat__num" style={{color}}>{num}</div>
              <div className="sa-stat__label" style={{color: color === 'white' ? 'rgba(255,255,255,0.7)' : 'var(--gray)'}}>{label}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="sa-actions">
          <div className="sa-seed-info">
            <strong>Seed completo:</strong> 2 admins · 20 reservas por estado (160 total) · entradas de progreso<br/>
            <strong>Seed usuarios:</strong> 3 usuarios demo · 2 coches cada uno · reservas con estados variados · mensajes de bienvenida
          </div>
          <button className="sa-seed-btn" onClick={handleSeed} disabled={seeding}>
            <Database size={16} />
            {seeding ? 'Ejecutando…' : '🌱 Seed General'}
          </button>
          <button className="sa-seed-btn" style={{background:'#1a8a3a'}} onClick={handleSeedUsers} disabled={seeding}>
            <Users size={16} />
            {seeding ? '…' : '👤 Seed Usuarios'}
          </button>
          <button className="sa-refresh-btn" onClick={load}><RefreshCw size={16} /></button>
        </div>

        {msg && <div className="sa-msg">✅ {msg}</div>}

        {/* Users table */}
        <div className="sa-table-wrap">
          <div className="sa-table-header">
            <Users size={18} color="var(--black)" />
            <h3>Gestión de Usuarios</h3>
          </div>
          {loading ? (
            <div className="sa-loading">Cargando usuarios…</div>
          ) : (
            <table className="sa-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Creado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className={!u.is_active ? 'sa-row--inactive' : ''}>
                    <td className="sa-td-name">{u.name}</td>
                    <td className="sa-td-email">{u.email}</td>
                    <td>
                      <select className="sa-role-select" value={u.role}
                        onChange={e => handleRole(u.id, e.target.value)}
                        disabled={u.id === me?.id}
                        style={{borderColor: ROLE_COLORS[u.role], color: ROLE_COLORS[u.role]}}>
                        <option value="user">Usuario</option>
                        <option value="admin">Admin</option>
                        <option value="superadmin">SuperAdmin</option>
                      </select>
                    </td>
                    <td>
                      <span className={`sa-status ${u.is_active ? 'sa-status--active' : 'sa-status--inactive'}`}>
                        {u.is_active ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="sa-td-date">{new Date(u.created_at).toLocaleDateString('es-PE')}</td>
                    <td>
                      <div className="sa-actions-cell">
                        <button className="sa-toggle-btn" onClick={() => handleToggle(u.id)} disabled={u.id === me?.id}
                          title={u.is_active ? 'Desactivar' : 'Activar'}>
                          {u.is_active ? <ToggleRight size={20} color="#1a8a3a"/> : <ToggleLeft size={20} color="#aaa"/>}
                        </button>
                        <button className="sa-delete-btn" onClick={() => handleDelete(u.id)} disabled={u.id === me?.id}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Default credentials */}
        <div className="sa-creds">
          <h4>🔑 Credenciales del sistema</h4>
          {[
            {role:'SuperAdmin',  email:'superadmin@wecautomotriz.pe',  pw:'SuperWec2024!'},
            {role:'Admin',       email:'wilmer@wecautomotriz.pe',      pw:'AdminWec2026!'},
            {role:'Admin',       email:'angelica@wecaurtomotriz.pe',   pw:'AdminWec2026!'},
            {role:'Usuario',     email:'user@wecautomotriz.pe',        pw:'UserWec2024!'},
            {role:'Demo User 1', email:'juan@demo.com',               pw:'Demo2024!'},
            {role:'Demo User 2', email:'maria@demo.com',              pw:'Demo2024!'},
            {role:'Demo User 3', email:'carlos@demo.com',             pw:'Demo2024!'},
          ].map(c=>(
            <div key={c.email} className="sa-cred-row">
              <span className="sa-cred-role">{c.role}</span>
              <code>{c.email}</code>
              <code>{c.pw}</code>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

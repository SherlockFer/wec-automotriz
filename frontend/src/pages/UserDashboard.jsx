import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Car, Calendar, MessageCircle, Plus, Edit3, Trash2, Send,
  Clock, CheckCircle, AlertTriangle, ChevronRight, LogOut,
  X, Bell, RefreshCw, FileText, Shield
} from 'lucide-react'
import {
  getMyCars, addMyCar, updateMyCar, deleteMyCar,
  getMyBookings, createMyBooking, getMyBookingProg,
  getMyMessages, sendMyMessage, getMyUnread, getAvailability,
  approveMyBooking
} from '../api/index.js'
import { extractError } from '../api/errors.js'
import { useAuth } from '../context/AuthContext'
import './UserDashboard.css'

/* ── Status config ── */
const STATUS = {
  requested:        { label:'Solicitada',          emoji:'📋', color:'#5a6a8a',  bg:'#f0f4ff' },
  confirmed:        { label:'Confirmada',           emoji:'✅', color:'#1a8a3a',  bg:'#eaf3de' },
  received:         { label:'Recepcionada en taller',emoji:'🏭', color:'#073590', bg:'#e8f0ff' },
  in_progress:      { label:'En reparación',        emoji:'🔧', color:'#c87800',  bg:'#fff8e1' },
  waiting_approval: { label:'Esperando tu aprobación',emoji:'⏳',color:'#9b3e00',bg:'#fff3e0' },
  finished:         { label:'¡Listo para recoger!', emoji:'🎉', color:'#1a8a3a',  bg:'#eaf3de' },
  delivered:        { label:'Entregado',            emoji:'🏁', color:'#5a6a8a',  bg:'#f5f5f5' },
  cancelled:        { label:'Cancelada',            emoji:'❌', color:'#c0392b',  bg:'#fff3f3' },
}

const SERVICES = [
  'Mantenimiento Preventivo','Reparación de Frenos','Alineación y Balanceo',
  'Cambio de Aceite y Filtros','Reparación de Suspensión','Cremallera Mecánica',
  'Cremallera Hidráulica','Amortiguadores','Diagnóstico General','Otro',
]

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function StatusBadge({ status }) {
  const s = STATUS[status] || { label: status, emoji:'•', color:'#888', bg:'#f5f5f5' }
  return <span className="ud-status-badge" style={{color:s.color,background:s.bg,borderColor:s.color+'44'}}>{s.emoji} {s.label}</span>
}

function pad(n) { return String(n).padStart(2,'0') }
function fmt(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function isSun(d) { return d.getDay()===0 }

/* ── Car Form Modal ── */
function CarModal({ car, onSave, onClose }) {
  const [form, setForm] = useState({
    brand: car?.brand||'', model: car?.model||'', year: car?.year||'',
    plate: car?.plate||'', color: car?.color||'', km: car?.km||'', notes: car?.notes||''
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.brand || !form.model) { setErr('Marca y modelo son requeridos'); return }
    setSaving(true)
    try { await onSave(form); onClose() }
    catch(e) { setErr(extractError(e)) }
    finally { setSaving(false) }
  }

  return (
    <div className="ud-modal-overlay" onClick={onClose}>
      <div className="ud-modal" onClick={e=>e.stopPropagation()}>
        <div className="ud-modal-header">
          <h3><Car size={16}/> {car ? 'Editar vehículo' : 'Agregar vehículo'}</h3>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        <form className="ud-modal-body" onSubmit={handleSave}>
          {err && <div className="ud-error">{err}</div>}
          <div className="ud-form-grid">
            {[['brand','Marca *','Toyota'],['model','Modelo *','Corolla'],['year','Año','2020'],
              ['plate','Placa','ABC-123'],['color','Color','Blanco'],['km','Kilometraje','45000']
            ].map(([k,l,ph])=>(
              <div key={k} className="ud-form-group">
                <label>{l}</label>
                <input type={k==='year'||k==='km'?'number':'text'} placeholder={ph}
                  value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/>
              </div>
            ))}
          </div>
          <div className="ud-form-group" style={{marginTop:'0.75rem'}}>
            <label>Notas (alergias a marcas, preferencias)</label>
            <textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}
              placeholder="Ej: Solo aceite sintético, repuestos originales..."/>
          </div>
          <div className="ud-modal-footer">
            <button type="button" className="ud-btn-outline" onClick={onClose}>Cancelar</button>
            <button type="submit" className="ud-btn-primary" disabled={saving}>
              {saving ? 'Guardando…' : <><CheckCircle size={15}/> Guardar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Booking Form Modal ── */
function BookingModal({ cars, onSave, onClose }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const [month,    setMonth]    = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selDate,  setSelDate]  = useState(null)
  const [avail,    setAvail]    = useState(null)
  const [loadAvail,setLoadAvail]= useState(false)
  const [selSlot,  setSelSlot]  = useState(null)
  const [form,     setForm]     = useState({ service:'', notes:'', car_id:'' })
  const [step,     setStep]     = useState(1)
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState('')

  function pickDay(d) {
    if (!d || d < today || isSun(d)) return
    setSelDate(d); setSelSlot(null); setAvail(null); setLoadAvail(true)
    const allowedSlots = d.getDay()===6 ? ['09:00'] : ['09:00','14:00','15:00']
    getAvailability(fmt(d)).then(r => {
      setAvail({ ...r.data, time_slots: r.data.time_slots.filter(s=>allowedSlots.includes(s.time)) })
    }).catch(()=>setAvail(null)).finally(()=>setLoadAvail(false))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!form.service) { setErr('Selecciona un servicio'); return }
    setSaving(true)
    try {
      await onSave({ ...form, booking_date: fmt(selDate), time_slot: selSlot, car_id: form.car_id || null })
      onClose()
    } catch(e) { setErr(extractError(e)) }
    finally { setSaving(false) }
  }

  const yr = month.getFullYear(), mo = month.getMonth()
  const firstPad = new Date(yr,mo,1).getDay()
  const daysInMo = new Date(yr,mo+1,0).getDate()
  const cells = [...Array(firstPad).fill(null), ...Array.from({length:daysInMo},(_,i)=>new Date(yr,mo,i+1))]
  const DAYS  = ['D','L','M','M','J','V','S']

  return (
    <div className="ud-modal-overlay" onClick={onClose}>
      <div className="ud-modal ud-modal--wide" onClick={e=>e.stopPropagation()}>
        <div className="ud-modal-header">
          <h3><Calendar size={16}/> Nueva reserva</h3>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        <div className="ud-modal-body">
          {err && <div className="ud-error">{err}</div>}
          {step === 1 && (
            <div className="ud-booking-step1">
              <div className="ud-mini-cal">
                <div className="ud-cal-nav">
                  <button type="button" onClick={()=>setMonth(new Date(yr,mo-1,1))}>‹</button>
                  <span>{MONTHS[mo]} {yr}</span>
                  <button type="button" onClick={()=>setMonth(new Date(yr,mo+1,1))}>›</button>
                </div>
                <div className="ud-cal-grid">
                  {DAYS.map((d,i)=><div key={i} className="ud-cal-dn">{d}</div>)}
                  {cells.map((d,i)=>{
                    const sel = d && selDate && fmt(d)===fmt(selDate)
                    const past = d && d<today
                    const sun  = d && isSun(d)
                    return (
                      <button key={i} type="button"
                        className={`ud-cal-day ${!d?'empty':''} ${sel?'selected':''} ${(past||sun)?'disabled':''}`}
                        onClick={()=>d && pickDay(d)} disabled={!d||past||sun}>
                        {d?.getDate()}
                      </button>
                    )
                  })}
                </div>
              </div>
              {selDate && (
                <div className="ud-slots">
                  <h4>{selDate.toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'})}</h4>
                  {loadAvail && <div className="ud-loading-sm">Cargando horarios…</div>}
                  {avail && avail.time_slots.map(slot=>(
                    <button key={slot.time} type="button"
                      className={`ud-slot ${slot.booked?'taken':''} ${selSlot===slot.time?'selected':''}`}
                      onClick={()=>!slot.booked && setSelSlot(slot.time)} disabled={slot.booked}>
                      <Clock size={13}/> {slot.time} hrs
                      <span>{slot.booked?'Ocupado':'Libre'}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <form onSubmit={handleSave}>
              <div className="ud-booking-summary">
                <Calendar size={14}/> {selDate?.toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'})} · {selSlot} hrs
              </div>
              <div className="ud-form-group">
                <label>Vehículo (opcional)</label>
                <select value={form.car_id} onChange={e=>setForm({...form,car_id:e.target.value})}>
                  <option value="">— Sin vehículo específico —</option>
                  {cars.map(c=><option key={c.id} value={c.id}>{c.brand} {c.model} {c.plate&&`· ${c.plate}`}</option>)}
                </select>
              </div>
              <div className="ud-form-group">
                <label>Servicio *</label>
                <select value={form.service} onChange={e=>setForm({...form,service:e.target.value})} required>
                  <option value="">— Selecciona —</option>
                  {SERVICES.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="ud-form-group">
                <label>Notas adicionales</label>
                <textarea rows={2} placeholder="Descripción del problema..."
                  value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
              </div>
              <div className="ud-modal-footer">
                <button type="button" className="ud-btn-outline" onClick={()=>setStep(1)}>‹ Cambiar fecha</button>
                <button type="submit" className="ud-btn-primary" disabled={saving}>
                  {saving?'Enviando…':<><CheckCircle size={15}/> Confirmar</>}
                </button>
              </div>
            </form>
          )}
          {step === 1 && selDate && selSlot && (
            <div className="ud-modal-footer" style={{borderTop:'1px solid #dde5f5',marginTop:'1rem',paddingTop:'1rem'}}>
              <button type="button" className="ud-btn-primary" onClick={()=>setStep(2)}>
                Continuar → <ChevronRight size={15}/>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Progress drawer ── */
function ProgressDrawer({ booking, onApprove, onClose }) {
  const [progress, setProgress] = useState([])
  const [loading,  setLoading]  = useState(true)
  const PROG_STATUS = { in_progress:'🔧 En reparación', waiting_parts:'⏳ Esperando repuestos', ready:'✅ Listo', delivered:'🏁 Entregado' }

  useEffect(() => {
    getMyBookingProg(booking.id).then(r=>setProgress(r.data)).finally(()=>setLoading(false))
  }, [booking.id])

  return (
    <div className="ud-modal-overlay" onClick={onClose}>
      <div className="ud-modal ud-modal--progress" onClick={e=>e.stopPropagation()}>
        <div className="ud-modal-header">
          <h3>📋 Progreso — {booking.service}</h3>
          <button onClick={onClose}><X size={18}/></button>
        </div>
        <div className="ud-modal-body">
          <div className="ud-booking-summary" style={{marginBottom:'1rem'}}>
            <Calendar size={13}/> {booking.booking_date} · {booking.time_slot} hrs
            &nbsp;·&nbsp;<StatusBadge status={booking.status}/>
          </div>
          {booking.status === 'waiting_approval' && booking.approval_note && (
            <div className="ud-approval-alert">
              <AlertTriangle size={16}/>
              <div>
                <strong>Tu aprobación es necesaria</strong>
                <p>{booking.approval_note}</p>
                <p>Llámanos al <strong>959 868 604</strong> o aprueba directamente aquí:</p>
                <button className="ud-approve-btn" style={{marginTop:'0.5rem'}} onClick={()=>{onApprove(booking.id);onClose()}}>
                  <CheckCircle size={14}/> ✅ Aprobar reparación ahora
                </button>
              </div>
            </div>
          )}
          {loading ? <div className="ud-loading-sm">Cargando progreso…</div>
          : progress.length === 0 ? <div className="ud-empty-sm">El equipo aún no ha registrado actualizaciones.</div>
          : (
            <div className="ud-prog-timeline">
              {progress.map((p,i)=>(
                <div key={p.id} className="ud-prog-entry">
                  <div className="ud-prog-dot">{p.status==='delivered'?'🏁':p.status==='ready'?'✅':p.status==='waiting_parts'?'⏳':'🔧'}</div>
                  <div className="ud-prog-body">
                    <div className="ud-prog-title">{p.title}</div>
                    {p.description && <div className="ud-prog-desc">{p.description}</div>}
                    {p.parts_needed?.length>0 && (
                      <div className="ud-prog-parts">
                        🔩 {p.parts_needed.join(' · ')}
                      </div>
                    )}
                    <div className="ud-prog-date">{new Date(p.created_at).toLocaleDateString('es-PE',{day:'numeric',month:'short',year:'numeric'})} {new Date(p.created_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Main Dashboard ── */
export default function UserDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [tab,          setTab]          = useState('cars')   // cars | bookings | messages
  const [cars,         setCars]         = useState([])
  const [bookings,     setBookings]     = useState([])
  const [messages,     setMessages]     = useState([])
  const [unread,       setUnread]       = useState(0)
  const [loading,      setLoading]      = useState(true)
  const [showCarModal, setShowCarModal] = useState(false)
  const [editCar,      setEditCar]      = useState(null)
  const [showBookModal,setShowBookModal]= useState(false)
  const [viewProgress, setViewProgress] = useState(null)
  const [msgText,      setMsgText]      = useState('')
  const [sendingMsg,   setSendingMsg]   = useState(false)
  const [msgBookingId, setMsgBookingId] = useState('')
  const msgEndRef = useRef()

  const load = async () => {
    setLoading(true)
    try {
      const [cRes, bRes, mRes, uRes] = await Promise.all([getMyCars(), getMyBookings(), getMyMessages(), getMyUnread()])
      setCars(cRes.data)
      setBookings(bRes.data)
      setMessages(mRes.data)
      setUnread(uRes.data.count)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (tab==='messages') msgEndRef.current?.scrollIntoView({behavior:'smooth'}) }, [messages, tab])

  const handleSaveCar = async (form) => {
    if (editCar) { await updateMyCar(editCar.id, form); setEditCar(null) }
    else await addMyCar(form)
    await load()
  }

  const handleDeleteCar = async (id) => {
    if (!confirm('¿Eliminar este vehículo?')) return
    await deleteMyCar(id); await load()
  }

  const handleSaveBooking = async (form) => {
    await createMyBooking({ ...form, captcha_token: 'dev-bypass-local' })
    await load(); setTab('bookings')
  }

  const handleApprove = async (bookingId) => {
    if (!confirm('¿Confirmas que apruebas continuar con la reparación?')) return
    try {
      await approveMyBooking(bookingId)
      await load()
      alert('✅ ¡Aprobación registrada! El taller continuará con la reparación.')
    } catch(e) {
      alert('Error: ' + extractError(e))
    }
  }

  const handleSendMsg = async (e) => {
    e.preventDefault()
    if (!msgText.trim()) return
    setSendingMsg(true)
    try {
      await sendMyMessage({ body: msgText, booking_id: msgBookingId ? Number(msgBookingId) : null })
      setMsgText(''); setMsgBookingId('')
      const r = await getMyMessages(); setMessages(r.data)
    } finally { setSendingMsg(false) }
  }

  const activeBookings   = bookings.filter(b=>!['delivered','cancelled'].includes(b.status))
  const historyBookings  = bookings.filter(b=> ['delivered','cancelled'].includes(b.status))

  if (loading) return <div style={{padding:'6rem 2rem',textAlign:'center',color:'var(--black)'}}>Cargando tu cuenta…</div>

  return (
    <div className="ud-page">
      {/* Header */}
      <div className="ud-header">
        <div className="container ud-header-inner">
          <div>
            <div className="section-tag">Mi cuenta</div>
            <h1 className="ud-title">Hola, <span style={{color:'var(--accent)'}}>{user?.name?.split(' ')[0]}</span> 👋</h1>
            <div style={{color:'rgba(255,255,255,0.55)',fontSize:'0.82rem',marginTop:'0.25rem'}}>{user?.email}</div>
          </div>
          <button className="ud-logout" onClick={()=>{logout();navigate('/')}}>
            <LogOut size={14}/> Salir
          </button>
        </div>
      </div>

      {/* Summary pills */}
      <div className="ud-summary container">
        <div className="ud-pill" onClick={()=>setTab('cars')}>
          <Car size={16}/> {cars.length} vehículo{cars.length!==1?'s':''}
        </div>
        <div className="ud-pill" onClick={()=>setTab('bookings')}>
          <Calendar size={16}/> {activeBookings.length} reserva{activeBookings.length!==1?'s':''} activa{activeBookings.length!==1?'s':''}
        </div>
        {unread > 0 && (
          <div className="ud-pill ud-pill--alert" onClick={()=>setTab('messages')}>
            <Bell size={16}/> {unread} mensaje{unread!==1?'s':''} nuevo{unread!==1?'s':''}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="ud-tabs container">
        {[['cars',`🚗 Mis vehículos (${cars.length})`],['bookings',`📅 Reservas (${bookings.length})`],['messages',`💬 Mensajes${unread>0?` (${unread})`:''}`]].map(([v,l])=>(
          <button key={v} className={`ud-tab ${tab===v?'ud-tab--active':''}`} onClick={()=>setTab(v)}>{l}</button>
        ))}
      </div>

      <div className="ud-body container">

        {/* ── CARS TAB ── */}
        {tab === 'cars' && (
          <div className="ud-section">
            <div className="ud-section-header">
              <h2>Mis vehículos</h2>
              <button className="ud-btn-primary" onClick={()=>{setEditCar(null);setShowCarModal(true)}}>
                <Plus size={15}/> Agregar vehículo
              </button>
            </div>
            {cars.length === 0 ? (
              <div className="ud-empty">
                <Car size={48} color="#c8d5ee"/>
                <p>No tienes vehículos registrados aún.</p>
                <button className="ud-btn-primary" onClick={()=>setShowCarModal(true)}><Plus size={15}/> Agregar mi primer vehículo</button>
              </div>
            ) : (
              <div className="ud-cars-grid">
                {cars.map(c=>{
                  const carBookings = bookings.filter(b=>b.car_id===c.id)
                  const active = carBookings.find(b=>!['delivered','cancelled'].includes(b.status))
                  return (
                    <div key={c.id} className={`ud-car-card ${active?'ud-car-card--active':''}`}>
                      <div className="ud-car-card__top">
                        <div className="ud-car-icon">🚗</div>
                        <div>
                          <div className="ud-car-name">{c.brand} {c.model}</div>
                          <div className="ud-car-meta">{c.year && `${c.year} · `}{c.plate && `${c.plate} · `}{c.color}</div>
                          {c.km && <div className="ud-car-meta">{c.km.toLocaleString()} km</div>}
                        </div>
                        <div className="ud-car-actions">
                          <button onClick={()=>{setEditCar(c);setShowCarModal(true)}}><Edit3 size={14}/></button>
                          <button onClick={()=>handleDeleteCar(c.id)}><Trash2 size={14}/></button>
                        </div>
                      </div>
                      {active && (
                        <div className="ud-car-status">
                          <StatusBadge status={active.status}/>
                          <button className="ud-link-btn" onClick={()=>setViewProgress(active)}>
                            Ver progreso <ChevronRight size={13}/>
                          </button>
                        </div>
                      )}
                      {c.notes && <div className="ud-car-notes">{c.notes}</div>}
                      <button className="ud-book-car-btn" onClick={()=>setShowBookModal(true)}>
                        <Calendar size={13}/> Reservar servicio para este auto
                      </button>
                    </div>
                  )
                })}
                <button className="ud-add-car-card" onClick={()=>{setEditCar(null);setShowCarModal(true)}}>
                  <Plus size={24}/>
                  <span>Agregar vehículo</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── BOOKINGS TAB ── */}
        {tab === 'bookings' && (
          <div className="ud-section">
            <div className="ud-section-header">
              <h2>Mis reservas</h2>
              <button className="ud-btn-primary" onClick={()=>setShowBookModal(true)}>
                <Plus size={15}/> Nueva reserva
              </button>
            </div>

            {activeBookings.length > 0 && (
              <div className="ud-bookings-group">
                <h3 className="ud-group-label">Activas</h3>
                {activeBookings.map(b=>(
                  <div key={b.id} className={`ud-booking-card ud-booking-card--${b.status}`}>
                    <div className="ud-booking-card__left">
                      <StatusBadge status={b.status}/>
                      <div className="ud-booking-card__service">{b.service}</div>
                      <div className="ud-booking-card__meta">
                        <span><Calendar size={12}/> {b.booking_date}</span>
                        <span><Clock size={12}/> {b.time_slot} hrs</span>
                        {b.car_brand && <span>🚗 {b.car_brand} {b.car_model}</span>}
                      </div>
                      {b.status==='waiting_approval' && b.approval_note && (
                        <div className="ud-approval-pill"><AlertTriangle size={12}/> {b.approval_note}</div>
                      )}
                      {b.status==='waiting_approval' && (
                        <button className="ud-approve-btn" onClick={()=>handleApprove(b.id)}>
                          <CheckCircle size={14}/> ✅ Aprobar reparación
                        </button>
                      )}
                      {b.status==='finished' && (
                        <div className="ud-ready-pill">🎉 ¡Tu auto está listo para recoger!</div>
                      )}
                      {b.approval_comment && (
                        <div className="ud-approved-pill"><CheckCircle size={12}/> {b.approval_comment}</div>
                      )}
                    </div>
                    <div className="ud-booking-card__right">
                      <button className="ud-view-prog-btn" onClick={()=>setViewProgress(b)}>
                        <FileText size={13}/> Ver progreso
                      </button>
                      <button className="ud-msg-btn" onClick={()=>{setMsgBookingId(String(b.id));setTab('messages')}}>
                        <MessageCircle size={13}/> Preguntar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {historyBookings.length > 0 && (
              <div className="ud-bookings-group">
                <h3 className="ud-group-label">Historial</h3>
                {historyBookings.map(b=>(
                  <div key={b.id} className="ud-booking-card ud-booking-card--history">
                    <div className="ud-booking-card__left">
                      <StatusBadge status={b.status}/>
                      <div className="ud-booking-card__service">{b.service}</div>
                      <div className="ud-booking-card__meta">
                        <span><Calendar size={12}/> {b.booking_date}</span>
                        {b.car_brand && <span>🚗 {b.car_brand} {b.car_model}</span>}
                      </div>
                    </div>
                    <button className="ud-view-prog-btn" onClick={()=>setViewProgress(b)}>
                      <FileText size={13}/> Ver historial
                    </button>
                  </div>
                ))}
              </div>
            )}

            {bookings.length === 0 && (
              <div className="ud-empty">
                <Calendar size={48} color="#c8d5ee"/>
                <p>No tienes reservas aún.</p>
                <button className="ud-btn-primary" onClick={()=>setShowBookModal(true)}><Plus size={15}/> Hacer mi primera reserva</button>
              </div>
            )}
          </div>
        )}

        {/* ── MESSAGES TAB ── */}
        {tab === 'messages' && (
          <div className="ud-section">
            <div className="ud-section-header">
              <h2>💬 Chat con WEC Taller Automotriz</h2>
              <button className="ud-btn-outline" onClick={load}><RefreshCw size={14}/></button>
            </div>
            <div className="ud-chat">
              <div className="ud-chat-messages">
                {messages.length===0 && (
                  <div className="ud-chat-empty">
                    <MessageCircle size={36} color="#c8d5ee"/>
                    <p>Envíanos un mensaje con cualquier pregunta sobre tu vehículo o reserva.</p>
                  </div>
                )}
                {messages.map(m=>(
                  <div key={m.id} className={`ud-msg ${m.sender_role==='user'?'ud-msg--user':'ud-msg--admin'}`}>
                    <div className="ud-msg-bubble">
                      {m.booking_id && <div className="ud-msg-ref">📅 Reserva #{m.booking_id}</div>}
                      {m.body}
                    </div>
                    <div className="ud-msg-time">
                      {m.sender_role==='admin'?'🔧 WEC Taller Automotriz':'Tú'} · {new Date(m.created_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})} {new Date(m.created_at).toLocaleDateString('es-PE',{day:'numeric',month:'short'})}
                    </div>
                  </div>
                ))}
                <div ref={msgEndRef}/>
              </div>
              <form className="ud-chat-form" onSubmit={handleSendMsg}>
                {bookings.filter(b=>!['delivered','cancelled'].includes(b.status)).length > 0 && (
                  <select className="ud-msg-booking-sel" value={msgBookingId} onChange={e=>setMsgBookingId(e.target.value)}>
                    <option value="">Consulta general</option>
                    {bookings.filter(b=>!['delivered','cancelled'].includes(b.status)).map(b=>(
                      <option key={b.id} value={b.id}>Reserva {b.service} · {b.booking_date}</option>
                    ))}
                  </select>
                )}
                <div className="ud-chat-input-row">
                  <textarea rows={2} placeholder="Escribe tu mensaje…" value={msgText}
                    onChange={e=>setMsgText(e.target.value)}
                    onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSendMsg(e)}}}/>
                  <button type="submit" className="ud-send-btn" disabled={sendingMsg||!msgText.trim()}>
                    <Send size={18}/>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCarModal    && <CarModal     car={editCar} onSave={handleSaveCar}    onClose={()=>{setShowCarModal(false);setEditCar(null)}}/>}
      {showBookModal   && <BookingModal cars={cars}   onSave={handleSaveBooking} onClose={()=>setShowBookModal(false)}/>}
      {viewProgress    && <ProgressDrawer booking={viewProgress} onApprove={handleApprove} onClose={()=>setViewProgress(null)}/>}
    </div>
  )
}

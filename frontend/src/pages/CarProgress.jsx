import { extractError } from '../api/errors.js'
import React, { useState, useEffect, useRef } from 'react'
import {
  Search, Plus, Camera, Send, Trash2, RefreshCw, Clock,
  Car, Package, AlertTriangle, CheckCircle, TrendingUp,
  Wrench, Hourglass, X, MessageCircle, ChevronDown, BarChart2, Mail
} from 'lucide-react'
import {
  getAllBookings, getProgress, createProgress, updateProgressStatus,
  deleteProgress, uploadProgressImage, getAnalytics, getWaLink, updateBookingStatus
} from '../api/index.js'
import { useAuth } from '../context/AuthContext'
import './CarProgress.css'

/* ── Inline ApprovalModal (mirrors Admin.jsx version) ── */
const APPROVAL_METHODS = [
  { value:'phone',     label:'📞 Llamada telefónica' },
  { value:'whatsapp',  label:'💬 WhatsApp' },
  { value:'in_person', label:'🤝 En persona en el taller' },
  { value:'email',     label:'📧 Correo electrónico' },
  { value:'portal',    label:'🖥️ Portal web del cliente' },
]

function ApprovalModal({ booking, onSave, onClose }) {
  const now = new Date()
  const [method,    setMethod]    = useState('phone')
  const [dateVal,   setDateVal]   = useState(now.toISOString().split('T')[0])
  const [timeVal,   setTimeVal]   = useState(now.toTimeString().slice(0,5))
  const [extraNote, setExtraNote] = useState('')
  const [sendEmail, setSendEmail] = useState(!!booking?.client_email)
  const [sendWA,    setSendWA]    = useState(false)
  const [waLink,    setWaLink]    = useState(null)
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (sendWA && booking) getWaLink(booking.id).then(r=>setWaLink(r.data.wa_link)).catch(()=>{})
  }, [sendWA])

  const buildComment = () => {
    const label = APPROVAL_METHODS.find(m=>m.value===method)?.label || method
    const dateStr = new Date(`${dateVal}T${timeVal}`).toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
    let c = `✅ Aprobado por el cliente (${label}) el ${dateStr} a las ${timeVal} hrs`
    if (extraNote.trim()) c += ` — ${extraNote.trim()}`
    return c
  }

  const handleSave = async () => {
    setSaving(true)
    try { await onSave(booking.id, buildComment(), sendEmail, sendWA); onClose() }
    catch(e) { alert(extractError(e)) }
    finally { setSaving(false) }
  }

  if (!booking) return null
  return (
    <div className="modal-overlay-cp" onClick={onClose}>
      <div className="modal-box-cp" onClick={e=>e.stopPropagation()}>
        <div className="modal-hdr-cp">
          <h3><CheckCircle size={15}/> Registrar aprobación — {booking.client_name}</h3>
          <button onClick={onClose}><X size={17}/></button>
        </div>
        <div className="modal-body-cp">
          {booking.approval_note && (
            <div className="ap-required-note">📋 <strong>Se requería:</strong> {booking.approval_note}</div>
          )}
          <div className="cp-form-group">
            <label>¿Cómo aprobó el cliente?</label>
            <select value={method} onChange={e=>setMethod(e.target.value)}>
              {APPROVAL_METHODS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
            <div className="cp-form-group">
              <label>Fecha</label>
              <input type="date" value={dateVal} onChange={e=>setDateVal(e.target.value)}/>
            </div>
            <div className="cp-form-group">
              <label>Hora</label>
              <input type="time" value={timeVal} onChange={e=>setTimeVal(e.target.value)}/>
            </div>
          </div>
          <div className="cp-form-group">
            <label>Nota adicional (opcional)</label>
            <input type="text" placeholder="Ej: Solo aprobó el guardapolvo"
              value={extraNote} onChange={e=>setExtraNote(e.target.value)}/>
          </div>
          <div className="ap-preview">{buildComment()}</div>
          <div className="cp-notify-opts">
            <label><input type="checkbox" checked={sendEmail} onChange={e=>setSendEmail(e.target.checked)} disabled={!booking.client_email}/>
              <Mail size={13}/> Notificar por email {!booking.client_email && <span className="cp-no-email">(sin email)</span>}
            </label>
            <label><input type="checkbox" checked={sendWA} onChange={e=>setSendWA(e.target.checked)}/>
              <MessageCircle size={13}/> Notificar por WhatsApp
            </label>
          </div>
          {sendWA && waLink && (
            <a href={waLink} target="_blank" rel="noreferrer" className="wa-preview-cp">
              <MessageCircle size={13}/> Abrir WhatsApp → {booking.client_phone}
            </a>
          )}
        </div>
        <div className="modal-ftr-cp">
          <button className="cp-btn-outline" onClick={onClose}>Cancelar</button>
          <button className="cp-btn-approve" onClick={handleSave} disabled={saving}>
            {saving ? 'Guardando…' : <><CheckCircle size={14}/> Confirmar aprobación</>}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Constants ── */
const PROG_STATUS = [
  { value:'in_progress',   label:'En reparación',      icon:'🔧', color:'#c87800', bg:'#fff8e1' },
  { value:'waiting_parts', label:'Esperando repuestos', icon:'⏳', color:'#9b3e00', bg:'#fff3e0' },
  { value:'ready',         label:'Listo para recoger',  icon:'✅', color:'#1a8a3a', bg:'#eaf3de' },
  { value:'delivered',     label:'Entregado',           icon:'🏁', color:'#5a6a8a', bg:'#f5f5f5' },
]

const BOOKING_STATUS_COLORS = {
  received:         { color:'#073590', bg:'#e8f0ff', emoji:'🏭', label:'Recepcionado' },
  in_progress:      { color:'#c87800', bg:'#fff8e1', emoji:'🔧', label:'En Progreso' },
  waiting_approval: { color:'#9b3e00', bg:'#fff3e0', emoji:'⏳', label:'Esperando Aprobación' },
  finished:         { color:'#1a8a3a', bg:'#eaf3de', emoji:'🎉', label:'Finalizado' },
}

const TIME_RANGES = [
  { value:'today',   label:'Hoy' },
  { value:'week',    label:'Esta semana' },
  { value:'month',   label:'Este mes' },
  { value:'custom',  label:'Personalizado' },
]

function getDateRange(range) {
  const today = new Date()
  const fmt = (d) => d.toISOString().split('T')[0]
  if (range === 'today')  return { from: fmt(today), to: fmt(today) }
  if (range === 'week')   { const s = new Date(today); s.setDate(today.getDate()-7);  return { from: fmt(s), to: fmt(today) } }
  if (range === 'month')  { const s = new Date(today); s.setDate(today.getDate()-30); return { from: fmt(s), to: fmt(today) } }
  return null
}

function ProgBadge({ status }) {
  const s = PROG_STATUS.find(o=>o.value===status) || PROG_STATUS[0]
  return <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', background:s.bg, color:s.color, border:`1px solid ${s.color}44`, fontFamily:'var(--font-condensed)', fontWeight:700, fontSize:'0.68rem', letterSpacing:'0.08em', textTransform:'uppercase', padding:'0.18rem 0.5rem', borderRadius:'2px', whiteSpace:'nowrap' }}>{s.icon} {s.label}</span>
}

function BookingBadge({ status }) {
  const s = BOOKING_STATUS_COLORS[status] || { color:'#888', bg:'#f5f5f5', emoji:'•', label: status }
  return <span style={{ display:'inline-flex', alignItems:'center', gap:'0.3rem', background:s.bg, color:s.color, border:`1px solid ${s.color}44`, fontFamily:'var(--font-condensed)', fontWeight:700, fontSize:'0.68rem', letterSpacing:'0.08em', textTransform:'uppercase', padding:'0.18rem 0.5rem', borderRadius:'2px', whiteSpace:'nowrap' }}>{s.emoji} {s.label}</span>
}

/* ── Stat card ── */
function StatCard({ emoji, label, value, color, sub, onClick, active }) {
  return (
    <button className={`stat-card ${active?'stat-card--active':''}`} onClick={onClick}
      style={active?{'--sc-color':color}:{}}>
      <div className="stat-card__emoji">{emoji}</div>
      <div className="stat-card__value" style={{color}}>{value}</div>
      <div className="stat-card__label">{label}</div>
      {sub && <div className="stat-card__sub">{sub}</div>}
    </button>
  )
}

/* ── Active car row ── */
function ActiveCarRow({ car, onWA, onApproval }) {
  const sc = BOOKING_STATUS_COLORS[car.status] || {}
  const hasApproval = car.status === 'waiting_approval'
  return (
    <div className={`active-car-row ${hasApproval ? 'active-car-row--approval' : ''}`}>
      <div className="active-car-row__status">
        <span style={{fontSize:'1.4rem'}}>{sc.emoji||'🔧'}</span>
      </div>
      <div className="active-car-row__info">
        <div className="active-car-row__name">{car.client_name}</div>
        <div className="active-car-row__meta">
          {car.car_brand && <span><Car size={11}/> {car.car_brand} {car.car_model} {car.car_plate && `· ${car.car_plate}`}</span>}
          <span>🔧 {car.service}</span>
          <span>📅 {car.booking_date}</span>
          {car.last_title && <span>📋 {car.last_title}</span>}
        </div>
        {hasApproval && car.approval_note && (
          <div className="active-car-row__approval-note">
            <AlertTriangle size={12}/> {car.approval_note}
          </div>
        )}
        {car.parts_needed?.length > 0 && (
          <div className="active-car-row__parts">
            {car.parts_needed.map((p,i) => <span key={i} className="parts-tag">{p}</span>)}
          </div>
        )}
      </div>
      <div className="active-car-row__actions">
        <BookingBadge status={car.status}/>
        <button className="wa-mini-btn" title="WhatsApp" onClick={()=>onWA(car.id)}>
          <MessageCircle size={14}/>
        </button>
        {hasApproval && (
          <button className="approval-mini-btn" title="Marcar aprobado" onClick={()=>onApproval(car.id)}>
            <CheckCircle size={14}/> Aprobado
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Main component ── */
export default function CarProgress() {
  const { user } = useAuth()

  // Analytics
  const [analytics,    setAnalytics]    = useState(null)
  const [loadingAn,    setLoadingAn]    = useState(true)
  const [timeRange,    setTimeRange]    = useState('month')
  const [customFrom,   setCustomFrom]   = useState('')
  const [customTo,     setCustomTo]     = useState('')
  const [statusFilter, setStatusFilter] = useState(null)
  const [approvalTarget, setApprovalTarget] = useState(null)  // booking to approve

  // Booking progress panel
  const [bookings,        setBookings]        = useState([])
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [progressList,    setProgressList]    = useState([])
  const [search,          setSearch]          = useState('')
  const [showForm,        setShowForm]        = useState(false)
  const [uploading,       setUploading]       = useState(false)
  const [loading,         setLoading]         = useState(true)
  const [msg,             setMsg]             = useState('')
  const [activeTab,       setActiveTab]       = useState('dashboard') // dashboard | progress

  const [form, setForm] = useState({ title:'', description:'', status:'in_progress', parts_needed:[''], notify_customer:false })

  const flash = (m) => { setMsg(m); setTimeout(()=>setMsg(''),3500) }

  const loadAnalytics = async (range, from, to) => {
    setLoadingAn(true)
    try {
      let df = from, dt = to
      if (range !== 'custom') { const r = getDateRange(range); if (r) { df = r.from; dt = r.to } else { df = ''; dt = '' } }
      const r = await getAnalytics(df || undefined, dt || undefined)
      setAnalytics(r.data)
    } catch(e) { console.error(e) } finally { setLoadingAn(false) }
  }

  const loadBookings = async () => {
    setLoading(true)
    try {
      const r = await getAllBookings()
      setBookings(r.data.filter(b => !['cancelled','delivered'].includes(b.status)))
    } finally { setLoading(false) }
  }

  useEffect(() => { loadAnalytics(timeRange, customFrom, customTo); loadBookings() }, [])

  const selectBooking = async (b) => {
    setSelectedBooking(b); setShowForm(false)
    const r = await getProgress(b.id)
    setProgressList(r.data)
  }

  const handleCreateProgress = async (e) => {
    e.preventDefault()
    const parts = form.parts_needed.filter(p=>p.trim())
    try {
      await createProgress({ ...form, booking_id: selectedBooking.id, parts_needed: parts })
      flash('✅ Actualización guardada' + (form.notify_customer ? ' · Email enviado' : ''))
      setShowForm(false)
      setForm({ title:'', description:'', status:'in_progress', parts_needed:[''], notify_customer:false })
      const r = await getProgress(selectedBooking.id)
      setProgressList(r.data)
      loadAnalytics(timeRange, customFrom, customTo)
    } catch(e) { flash('❌ ' + (extractError(e, 'Error'))) }
  }

  const handleStatusChange = async (pid, status) => {
    await updateProgressStatus(pid, status, false)
    const r = await getProgress(selectedBooking.id); setProgressList(r.data)
    flash('Estado actualizado')
  }

  const handleNotify = async (pid, status) => {
    await updateProgressStatus(pid, status, true)
    flash('✅ Email enviado al cliente')
  }

  const handleDelete = async (pid) => {
    if (!confirm('¿Eliminar?')) return
    await deleteProgress(pid)
    const r = await getProgress(selectedBooking.id); setProgressList(r.data)
  }

  const handleImageUpload = async (pid, files) => {
    setUploading(true)
    for (const file of Array.from(files)) {
      const reader = new FileReader()
      await new Promise(res => {
        reader.onload = async (ev) => {
          await uploadProgressImage({ progress_id: pid, filename: file.name, data: ev.target.result })
          res()
        }
        reader.readAsDataURL(file)
      })
    }
    const r = await getProgress(selectedBooking.id); setProgressList(r.data)
    setUploading(false); flash(`✅ Foto subida`)
  }

  const handleWAFromDashboard = async (bookingId) => {
    try { const r = await getWaLink(bookingId); window.open(r.data.wa_link, '_blank') } catch {}
  }

  // Open approval modal — find the booking from active_cars
  const handleApproval = (bookingId) => {
    const car = analytics?.active_cars?.find(c => c.id === bookingId)
    if (car) {
      // Build a booking-like object the modal needs
      setApprovalTarget({
        id: car.id, client_name: car.client_name, client_phone: car.client_phone,
        client_email: null, service: car.service, approval_note: car.approval_note,
      })
    }
  }

  const handleApprovalSave = async (bookingId, comment, sendEmail, sendWA) => {
    await updateBookingStatus(bookingId, 'in_progress', '', sendEmail, sendWA, comment)
    flash('✅ Aprobado — estado actualizado a En Progreso')
    setApprovalTarget(null)
    loadAnalytics(timeRange, customFrom, customTo)
    loadBookings()
  }

  const addPart = () => setForm(f=>({...f,parts_needed:[...f.parts_needed,'']}))
  const removePart = (i) => setForm(f=>({...f,parts_needed:f.parts_needed.filter((_,j)=>j!==i)}))
  const setPart = (i,v) => setForm(f=>({...f,parts_needed:f.parts_needed.map((p,j)=>j===i?v:p)}))

  const filteredBookings = bookings.filter(b =>
    (!search || b.client_name.toLowerCase().includes(search.toLowerCase()) ||
     b.client_phone.includes(search) || (b.car_plate||'').toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || b.status === statusFilter)
  )

  const s = analytics?.summary
  const activeCars = analytics?.active_cars || []
  const filteredActiveCars = statusFilter ? activeCars.filter(c=>c.status===statusFilter) : activeCars

  return (
    <div className="cp-page">
      <div className="cp-hero container">
        <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',flexWrap:'wrap',gap:'1rem'}}>
          <div>
            <div className="section-tag">Estado del taller</div>
            <h1 className="section-title" style={{color:'white'}}>PROGRESO<br/><span style={{color:'var(--accent)'}}>DEL TALLER</span></h1>
          </div>
          <div className="cp-tabs">
            <button className={`cp-tab ${activeTab==='dashboard'?'cp-tab--active':''}`} onClick={()=>setActiveTab('dashboard')}>
              <BarChart2 size={15}/> Dashboard
            </button>
            <button className={`cp-tab ${activeTab==='progress'?'cp-tab--active':''}`} onClick={()=>setActiveTab('progress')}>
              <Wrench size={15}/> Progreso de autos
            </button>
          </div>
        </div>
      </div>

      {msg && <div className="cp-flash">{msg}</div>}

      {/* ── DASHBOARD TAB ── */}
      {activeTab === 'dashboard' && (
        <div className="cp-dashboard container">
          {/* Approval modal */}
          {approvalTarget && (
            <ApprovalModal
              booking={approvalTarget}
              onSave={handleApprovalSave}
              onClose={()=>setApprovalTarget(null)}
            />
          )}

          {/* Time range selector */}
          <div className="time-range-bar">
            {TIME_RANGES.map(tr => (
              <button key={tr.value}
                className={`time-range-btn ${timeRange===tr.value?'time-range-btn--active':''}`}
                onClick={()=>{ setTimeRange(tr.value); if(tr.value!=='custom') loadAnalytics(tr.value,'','') }}>
                {tr.label}
              </button>
            ))}
            {timeRange==='custom' && (
              <div className="custom-range">
                <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}/>
                <span style={{color:'var(--gray)'}}>→</span>
                <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}/>
                <button className="time-range-btn time-range-btn--active" onClick={()=>loadAnalytics('custom',customFrom,customTo)}>Aplicar</button>
              </div>
            )}
            <button className="cp-refresh-btn" onClick={()=>loadAnalytics(timeRange,customFrom,customTo)} title="Recargar">
              <RefreshCw size={15}/>
            </button>
          </div>

          {loadingAn ? (
            <div className="cp-loading">Cargando datos del taller…</div>
          ) : s && (
            <>
              {/* KPI Cards */}
              <div className="kpi-grid">
                <StatCard emoji="🏭" label="Autos en taller" value={s.total_in_garage} color="#073590"
                  active={statusFilter===null} onClick={()=>setStatusFilter(null)}/>
                <StatCard emoji="🔧" label="En reparación" value={s.in_progress} color="#c87800"
                  active={statusFilter==='in_progress'} onClick={()=>setStatusFilter(f=>f==='in_progress'?null:'in_progress')}/>
                <StatCard emoji="⏳" label="Esperando aprobación" value={s.waiting_approval} color="#9b3e00"
                  active={statusFilter==='waiting_approval'} onClick={()=>setStatusFilter(f=>f==='waiting_approval'?null:'waiting_approval')}
                  sub={s.waiting_approval>0?"⚠️ Requieren atención":null}/>
                <StatCard emoji="🎉" label="Terminados / pendientes entrega" value={s.finished_not_delivered} color="#1a8a3a"
                  active={statusFilter==='finished'} onClick={()=>setStatusFilter(f=>f==='finished'?null:'finished')}/>
                <StatCard emoji="🏁" label="Entregados esta semana" value={s.delivered_this_week} color="#5a6a8a"
                  sub={`${s.delivered_this_month} este mes`}/>
                <StatCard emoji="📋" label="Solicitudes pendientes" value={s.pending_requests} color="#334e7a"
                  sub="Sin confirmar"/>
              </div>

              {/* Waiting for approval — highlighted section */}
              {analytics.waiting_approval_list?.length > 0 && (
                <div className="approval-section">
                  <div className="approval-section__header">
                    <AlertTriangle size={18} color="#9b3e00"/>
                    <h3>⏳ Esperando aprobación del cliente ({analytics.waiting_approval_list.length})</h3>
                    <span className="approval-section__sub">Estos clientes deben aprobar antes de continuar la reparación</span>
                  </div>
                  <div className="approval-list">
                    {analytics.waiting_approval_list.map(item => (
                      <div key={item.id} className="approval-item">
                        <div className="approval-item__left">
                          <div className="approval-item__name">{item.client_name}</div>
                          <div className="approval-item__meta">
                            {item.car && <span><Car size={11}/> {item.car}</span>}
                            <span>🔧 {item.service}</span>
                            <span>📅 {item.booking_date}</span>
                          </div>
                          {item.approval_note && (
                            <div className="approval-item__note">{item.approval_note}</div>
                          )}
                        </div>
                        <div className="approval-item__actions">
                          <button className="wa-mini-btn" onClick={()=>handleWAFromDashboard(item.id)} title="Enviar WhatsApp">
                            <MessageCircle size={14}/>
                          </button>
                          <button className="approval-mini-btn" onClick={()=>handleApproval(item.id)}>
                            <CheckCircle size={14}/> Marcar aprobado
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Service breakdown */}
              {Object.keys(analytics.service_counts||{}).length > 0 && (
                <div className="service-breakdown">
                  <h3 className="section-h3">🔧 Distribución por servicio (autos en taller)</h3>
                  <div className="service-bars">
                    {Object.entries(analytics.service_counts).sort((a,b)=>b[1]-a[1]).map(([svc,cnt])=>{
                      const max = Math.max(...Object.values(analytics.service_counts))
                      return (
                        <div key={svc} className="service-bar-row">
                          <div className="service-bar-label">{svc}</div>
                          <div className="service-bar-track">
                            <div className="service-bar-fill" style={{width:`${(cnt/max)*100}%`}}/>
                          </div>
                          <div className="service-bar-count">{cnt}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Active cars list */}
              <div className="active-cars-section">
                <div className="active-cars-header">
                  <h3 className="section-h3">
                    🏭 Autos en taller {statusFilter ? `— ${BOOKING_STATUS_COLORS[statusFilter]?.label}` : ''}
                    <span style={{fontWeight:400,fontSize:'0.85rem',marginLeft:'0.5rem',color:'var(--gray)'}}>({filteredActiveCars.length})</span>
                  </h3>
                  {statusFilter && <button className="clear-filter-btn" onClick={()=>setStatusFilter(null)}><X size={14}/> Limpiar filtro</button>}
                </div>
                {filteredActiveCars.length === 0
                  ? <div className="cp-empty-row">No hay autos con este estado en el taller</div>
                  : filteredActiveCars.map(car => (
                    <ActiveCarRow key={car.id} car={car}
                      onWA={handleWAFromDashboard}
                      onApproval={handleApproval}/>
                  ))
                }
              </div>
            </>
          )}
        </div>
      )}

      {/* ── PROGRESS TAB ── */}
      {activeTab === 'progress' && (
        <div className="cp-layout container">
          {/* Sidebar */}
          <div className="cp-sidebar">
            <div className="cp-sidebar__search">
              <Search size={15}/>
              <input placeholder="Buscar cliente, placa…" value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>
            <div className="cp-sidebar__label">Autos en taller ({filteredBookings.length})</div>
            {loading ? <div className="cp-sidebar__empty">Cargando…</div>
             : filteredBookings.length===0 ? <div className="cp-sidebar__empty">Sin resultados</div>
             : filteredBookings.map(b=>(
              <button key={b.id}
                className={`cp-booking-item ${selectedBooking?.id===b.id?'cp-booking-item--active':''}`}
                onClick={()=>selectBooking(b)}>
                <div className="cp-booking-item__name"><Car size={13}/> {b.client_name}</div>
                {(b.car_brand||b.car_plate) && <div className="cp-booking-item__meta">{b.car_brand} {b.car_model} {b.car_plate && `· ${b.car_plate}`}</div>}
                <div className="cp-booking-item__meta">🔧 {b.service}</div>
                <div className="cp-booking-item__meta">📅 {b.booking_date} · {b.time_slot}</div>
                <BookingBadge status={b.status}/>
              </button>
            ))}
          </div>

          {/* Main panel */}
          <div className="cp-main">
            {!selectedBooking ? (
              <div className="cp-empty">
                <Car size={48} color="#c8d5ee"/>
                <p>Selecciona un auto de la lista para ver y gestionar su progreso</p>
              </div>
            ) : (
              <>
                <div className="cp-booking-header">
                  <div>
                    <h2 className="cp-booking-header__name">{selectedBooking.client_name}</h2>
                    <div className="cp-booking-header__meta">
                      {selectedBooking.car_brand && <span><Car size={12}/> {selectedBooking.car_brand} {selectedBooking.car_model} {selectedBooking.car_plate&&`· ${selectedBooking.car_plate}`}</span>}
                      <span>🔧 {selectedBooking.service}</span>
                      <span>📅 {selectedBooking.booking_date}</span>
                      <span>📞 {selectedBooking.client_phone}</span>
                      <BookingBadge status={selectedBooking.status}/>
                    </div>
                    {selectedBooking.approval_note && (
                      <div style={{background:'#fff8e1',border:'1px solid #F7C416',padding:'0.4rem 0.75rem',fontSize:'0.78rem',color:'#7a4f00',marginTop:'0.5rem',display:'flex',gap:'0.4rem',alignItems:'flex-start'}}>
                        <AlertTriangle size={13} style={{flexShrink:0,marginTop:'1px'}}/> {selectedBooking.approval_note}
                      </div>
                    )}
                  </div>
                  <div style={{display:'flex',gap:'0.5rem'}}>
                    <button className="wa-mini-btn" style={{width:'auto',padding:'0.45rem 0.75rem',borderRadius:'4px'}} onClick={()=>handleWAFromDashboard(selectedBooking.id)}>
                      <MessageCircle size={14}/> WA
                    </button>
                    <button className="cp-add-btn" onClick={()=>setShowForm(!showForm)}>
                      <Plus size={15}/> Nueva actualización
                    </button>
                  </div>
                </div>

                {showForm && (
                  <form className="cp-form" onSubmit={handleCreateProgress}>
                    <h3>Nueva actualización</h3>
                    <div className="cp-form__row">
                      <div className="form-group">
                        <label>Título *</label>
                        <input type="text" placeholder="Ej: Diagnóstico completado" value={form.title}
                          onChange={e=>setForm({...form,title:e.target.value})} required/>
                      </div>
                      <div className="form-group">
                        <label>Estado</label>
                        <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                          {PROG_STATUS.map(s=><option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="form-group">
                      <label>Descripción</label>
                      <textarea rows={3} placeholder="Detalles del trabajo realizado…" value={form.description}
                        onChange={e=>setForm({...form,description:e.target.value})}/>
                    </div>
                    <div className="form-group">
                      <label>🔩 Repuestos</label>
                      {form.parts_needed.map((p,i)=>(
                        <div key={i} className="cp-part-row">
                          <input type="text" placeholder={`Repuesto ${i+1}…`} value={p} onChange={e=>setPart(i,e.target.value)}/>
                          <button type="button" className="cp-part-remove" onClick={()=>removePart(i)}>✕</button>
                        </div>
                      ))}
                      <button type="button" className="cp-add-part-btn" onClick={addPart}>+ Agregar repuesto</button>
                    </div>
                    <div className="cp-form__notify">
                      <input type="checkbox" id="notify" checked={form.notify_customer}
                        onChange={e=>setForm({...form,notify_customer:e.target.checked})}/>
                      <label htmlFor="notify">
                        <Send size={13}/> Notificar por email al cliente
                        {selectedBooking.client_email
                          ? <span className="cp-email-target"> → {selectedBooking.client_email}</span>
                          : <span className="cp-email-warn"> (sin email)</span>}
                      </label>
                    </div>
                    <div className="cp-form__actions">
                      <button type="submit" className="btn-primary" style={{clipPath:'none',borderRadius:'4px',background:'var(--black)',color:'white'}}>
                        <CheckCircle size={15}/> Guardar
                      </button>
                      <button type="button" className="cp-cancel-btn" onClick={()=>setShowForm(false)}>Cancelar</button>
                    </div>
                  </form>
                )}

                <div className="cp-timeline">
                  {progressList.length===0
                    ? <div className="cp-empty" style={{padding:'2rem'}}><p>Sin actualizaciones. Crea la primera.</p></div>
                    : progressList.map(p=>(
                    <div key={p.id} className="cp-entry">
                      <div className="cp-entry__header">
                        <div style={{flex:1}}>
                          <ProgBadge status={p.status}/>
                          <h4 className="cp-entry__title">{p.title}</h4>
                          {p.description && <p className="cp-entry__desc">{p.description}</p>}
                        </div>
                        <div className="cp-entry__actions">
                          <select className="cp-status-select" value={p.status}
                            onChange={e=>handleStatusChange(p.id,e.target.value)}>
                            {PROG_STATUS.map(s=><option key={s.value} value={s.value}>{s.icon} {s.label}</option>)}
                          </select>
                          <button className="cp-notify-btn" title="Notificar por email"
                            onClick={()=>handleNotify(p.id,p.status)}
                            disabled={!selectedBooking.client_email}>
                            <Send size={13}/>
                          </button>
                          <button className="cp-delete-btn" onClick={()=>handleDelete(p.id)}>
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      </div>
                      {p.parts_needed?.length>0 && (
                        <div className="cp-entry__parts">
                          <span className="cp-entry__parts-label"><Package size={12}/> Repuestos:</span>
                          {p.parts_needed.map((part,i)=><span key={i} className="cp-part-tag">{part}</span>)}
                        </div>
                      )}
                      <div className="cp-entry__images">
                        {(p.image_urls||[]).map((url,i)=>(
                          <a key={i} href={`http://localhost:8000${url}`} target="_blank" rel="noreferrer">
                            <img src={`http://localhost:8000${url}`} alt="" className="cp-entry__img"/>
                          </a>
                        ))}
                        <label className="cp-upload-btn">
                          <Camera size={18}/><span>{uploading?'…':'Foto'}</span>
                          <input type="file" accept="image/*" multiple hidden
                            onChange={e=>handleImageUpload(p.id,e.target.files)} disabled={uploading}/>
                        </label>
                      </div>
                      <div className="cp-entry__date">🕒 {new Date(p.created_at).toLocaleDateString('es-PE',{day:'numeric',month:'short',year:'numeric'})} {new Date(p.created_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

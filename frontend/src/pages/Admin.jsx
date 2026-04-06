import { extractError } from '../api/errors.js'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Calendar, Settings, Trash2, RefreshCw, LogOut, Shield,
  ChevronDown, Car, Phone, Mail, MessageCircle, Edit3, CheckCircle,
  Clock, AlertCircle, Send, Camera, X, Plus, Bell, BarChart2,
  RotateCcw, RotateCw, List, Wrench, AlertTriangle, Package
} from 'lucide-react'
import {
  getAllBookings, getBookingStats, updateBookingStatus, updateCarProfile,
  cancelBooking, setCapacity, getWaLink, uploadReceptionImage, getProgress,
  getAdminUsers, adminGetMessages, adminReplyMessage, adminUnreadCount,
  getAuditLogs, undoAction, redoAction, getAnalytics, getApprovalHistory, getWorkflowHistory,
  getPageAnalytics
} from '../api/index.js'
import { useAuth } from '../context/AuthContext'
import './Admin.css'

/* ── Status config ── */
const STATUSES = [
  { value:'requested',        label:'Solicitada',           emoji:'📋', color:'#5a6a8a', bg:'#f0f4ff' },
  { value:'confirmed',        label:'Confirmada',           emoji:'✅', color:'#1a8a3a', bg:'#eaf3de' },
  { value:'received',         label:'Recepcionada',         emoji:'🏭', color:'#073590', bg:'#e8f0ff' },
  { value:'in_progress',      label:'En Progreso',          emoji:'🔧', color:'#c87800', bg:'#fff8e1' },
  { value:'waiting_approval', label:'Esp. Aprobación',      emoji:'⏳', color:'#9b3e00', bg:'#fff3e0' },
  { value:'finished',         label:'Finalizada',           emoji:'🎉', color:'#1a5e20', bg:'#e3f2fd' },
  { value:'delivered',        label:'Entregada',            emoji:'🏁', color:'#444',    bg:'#f5f5f5' },
  { value:'cancelled',        label:'Cancelada',            emoji:'❌', color:'#c0392b', bg:'#fff3f3' },
]
const STATUS_MAP = Object.fromEntries(STATUSES.map(s=>[s.value,s]))
const APPROVAL_METHODS = [
  { value:'phone',     label:'📞 Llamada telefónica' },
  { value:'whatsapp',  label:'💬 WhatsApp' },
  { value:'in_person', label:'🤝 En persona' },
  { value:'email',     label:'📧 Email' },
  { value:'portal',    label:'🖥️ Portal web' },
]

function StatusBadge({ status, size='md' }) {
  const s = STATUS_MAP[status] || { label:status, emoji:'•', color:'#888', bg:'#f5f5f5' }
  return (
    <span style={{display:'inline-flex',alignItems:'center',gap:'0.3rem',background:s.bg,color:s.color,
      border:`1px solid ${s.color}44`,fontFamily:'var(--font-condensed)',fontWeight:700,
      fontSize:size==='sm'?'0.65rem':'0.72rem',letterSpacing:'0.08em',textTransform:'uppercase',
      padding:size==='sm'?'0.15rem 0.4rem':'0.25rem 0.6rem',borderRadius:'2px',whiteSpace:'nowrap'}}>
      {s.emoji} {s.label}
    </span>
  )
}

function fmt(d) { const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}` }

/* ── ApprovalModal ── */
function ApprovalModal({ booking, onSave, onClose }) {
  const now = new Date()
  const [method,    setMethod]    = useState('phone')
  const [dateVal,   setDateVal]   = useState(now.toISOString().split('T')[0])
  const [timeVal,   setTimeVal]   = useState(now.toTimeString().slice(0,5))
  const [extraNote, setExtraNote] = useState('')
  const [sendEmail, setSendEmail] = useState(!!booking?.client_email)
  const [sendWA,    setSendWA]    = useState(false)
  const [waLink,    setWaLink]    = useState(null)

  useEffect(() => {
    if (sendWA && booking) getWaLink(booking.id).then(r=>setWaLink(r.data.wa_link)).catch(()=>{})
  }, [sendWA])

  const buildComment = () => {
    const label = APPROVAL_METHODS.find(m=>m.value===method)?.label || method
    const ds = new Date(`${dateVal}T${timeVal}`).toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
    let c = `✅ Aprobado (${label}) el ${ds} a las ${timeVal} hrs`
    if (extraNote.trim()) c += ` — ${extraNote.trim()}`
    return c
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--sm" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h3><CheckCircle size={15}/> Registrar aprobación — {booking?.client_name}</h3>
          <button className="modal-close" onClick={onClose}><X size={17}/></button>
        </div>
        <div className="modal-body">
          {booking?.approval_note && (
            <div style={{background:'#fff8e1',border:'1px solid #F7C416',padding:'0.65rem 0.875rem',
              borderRadius:'4px',fontSize:'0.8rem',color:'#7a4f00',marginBottom:'0.875rem'}}>
              📋 <strong>Se requería:</strong> {booking.approval_note}
            </div>
          )}
          <div className="form-group">
            <label>¿Cómo aprobó el cliente?</label>
            <select value={method} onChange={e=>setMethod(e.target.value)}>
              {APPROVAL_METHODS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.75rem'}}>
            <div className="form-group"><label>Fecha</label>
              <input type="date" value={dateVal} onChange={e=>setDateVal(e.target.value)}/></div>
            <div className="form-group"><label>Hora</label>
              <input type="time" value={timeVal} onChange={e=>setTimeVal(e.target.value)}/></div>
          </div>
          <div className="form-group">
            <label>Nota adicional (opcional)</label>
            <input type="text" placeholder="Ej: Solo aprobó el guardapolvo"
              value={extraNote} onChange={e=>setExtraNote(e.target.value)}/>
          </div>
          <div style={{background:'#eaf3de',border:'1px solid #a8d5a2',padding:'0.6rem 0.8rem',
            borderRadius:'4px',fontSize:'0.75rem',color:'#1a5e20',marginBottom:'0.75rem'}}>
            📝 {buildComment()}
          </div>
          <div className="notify-options">
            <label className="notify-option">
              <input type="checkbox" checked={sendEmail} onChange={e=>setSendEmail(e.target.checked)} disabled={!booking?.client_email}/>
              <Mail size={13}/> Email {!booking?.client_email && <span style={{color:'#c0392b',fontSize:'0.7rem'}}>(sin email)</span>}
            </label>
            <label className="notify-option">
              <input type="checkbox" checked={sendWA} onChange={e=>setSendWA(e.target.checked)}/>
              <MessageCircle size={13}/> WhatsApp
            </label>
          </div>
          {sendWA && waLink && (
            <a href={waLink} target="_blank" rel="noreferrer" className="wa-preview-link">
              <MessageCircle size={13}/> Abrir WhatsApp → {booking?.client_phone}
            </a>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn-outline" style={{color:'var(--black)',borderColor:'#dde5f5'}} onClick={onClose}>Cancelar</button>
          <button className="btn-primary" style={{background:'#1a8a3a',color:'white',clipPath:'none',borderRadius:'4px'}}
            onClick={()=>onSave(buildComment(), sendEmail, sendWA)}>
            <CheckCircle size={14}/> Confirmar aprobación
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── CarProfileModal ── */
function CarProfileModal({ booking, onSave, onClose }) {
  const [form, setForm] = useState({
    car_brand:booking.car_brand||'', car_model:booking.car_model||'',
    car_year:booking.car_year||'', car_plate:booking.car_plate||'',
    car_color:booking.car_color||'', car_km:booking.car_km||'',
    failure_desc:booking.failure_desc||'', reception_notes:booking.reception_notes||''
  })
  const [images, setImages] = useState(booking.reception_images||[])
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (files) => {
    setUploading(true)
    for (const file of Array.from(files)) {
      const reader = new FileReader()
      await new Promise(res => {
        reader.onload = async (ev) => {
          try { const r = await uploadReceptionImage({booking_id:booking.id,filename:file.name,data:ev.target.result}); setImages(p=>[...p,r.data.url]) } catch{}
          res()
        }
        reader.readAsDataURL(file)
      })
    }
    setUploading(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h3><Car size={16}/> Perfil del Vehículo — {booking.client_name}</h3>
          <button className="modal-close" onClick={onClose}><X size={17}/></button>
        </div>
        <div className="modal-body">
          <div style={{fontSize:'0.78rem',color:'#9b3e00',background:'#fff3e0',border:'1px solid #f5c07a',padding:'0.5rem 0.75rem',borderRadius:'4px',marginBottom:'0.75rem'}}>
            ⚠️ <strong>Marca, Modelo, Año y mínimo 3 fotos</strong> son requeridos para marcar como Recepcionada.
          </div>
          <div className="car-profile-grid">
            {[['car_brand','Marca *','Toyota'],['car_model','Modelo *','Corolla'],['car_year','Año *','2020'],
              ['car_plate','Placa','ABC-123'],['car_color','Color','Blanco'],['car_km','Km','45000']
            ].map(([k,l,ph])=>(
              <div key={k} className="form-group">
                <label>{l}</label>
                <input type={k==='car_year'||k==='car_km'?'number':'text'} placeholder={ph}
                  value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/>
              </div>
            ))}
          </div>
          <div className="form-group" style={{marginTop:'0.75rem'}}>
            <label>Falla reportada</label>
            <textarea rows={2} value={form.failure_desc} onChange={e=>setForm({...form,failure_desc:e.target.value})}/>
          </div>
          <div className="form-group">
            <label>Notas de recepción</label>
            <textarea rows={2} value={form.reception_notes} onChange={e=>setForm({...form,reception_notes:e.target.value})}/>
          </div>
          <div className="form-group">
            <label><Camera size={12}/> Fotos ({images.length}/3 mínimo) {images.length < 3 && <span style={{color:'#c0392b',fontSize:'0.72rem'}}>— requeridas</span>}</label>
            <div className="reception-photos">
              {images.map((url,i)=>(
                <a key={i} href={`http://localhost:8000${url}`} target="_blank" rel="noreferrer">
                  <img src={`http://localhost:8000${url}`} alt="" className="reception-photo"/>
                </a>
              ))}
              <label className="photo-upload-btn">
                <Camera size={16}/><span>{uploading?'…':'Foto'}</span>
                <input type="file" accept="image/*" multiple hidden onChange={e=>handleUpload(e.target.files)}/>
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-outline" style={{color:'var(--black)',borderColor:'#dde5f5'}} onClick={onClose}>Cancelar</button>
          <button className="btn-primary" style={{background:'var(--black)',color:'white',clipPath:'none',borderRadius:'4px'}}
            onClick={()=>onSave(form)}>
            <CheckCircle size={14}/> Guardar perfil
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── RequireApprovalModal ── */
function RequireApprovalModal({ booking, onSave, onClose }) {
  const [approvalNote, setApprovalNote] = useState(booking?.approval_note || '')
  const [sendEmail, setSendEmail] = useState(!!booking?.client_email)
  const [sendWA, setSendWA] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef(null)

  useEffect(() => {
    // focus textarea when modal opens
    textareaRef.current?.focus()
  }, [])

  const handleSave = () => {
    if (!approvalNote.trim()) {
      setError('Debe ingresar la aprobación requerida')
      textareaRef.current?.focus()
      return
    }
    setError('')
    onSave(approvalNote.trim(), sendEmail, sendWA)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box modal-box--sm" onClick={e=>e.stopPropagation()}>
        <div className="modal-header">
          <h3>⏳ Aprobación requerida — {booking?.client_name}</h3>
          <button className="modal-close" onClick={onClose}><X size={17}/></button>
        </div>
        <div className="modal-body">
          <div style={{marginBottom:'0.6rem',color:'#7a4f00',background:'#fff8e1',padding:'0.6rem',borderRadius:4}}>
            Indica la aprobación requerida para que el cliente autorice la reparación.
          </div>
          <div className="form-group">
            <label>Texto de Aprobación requerida</label>
            <textarea ref={textareaRef} rows={3} value={approvalNote} onChange={e=>setApprovalNote(e.target.value)} placeholder="Ej: Reemplazo de guardapolvo del palier — S/. 180 adicionales" />
            {error && <div style={{color:'#c0392b',marginTop:'0.5rem',fontSize:'0.85rem'}}>{error}</div>}
          </div>
          <div style={{display:'flex',gap:'0.6rem',alignItems:'center',marginTop:'0.4rem'}}>
            <label className="notify-option" style={{marginRight:'0.6rem'}}>
              <input type="checkbox" checked={sendEmail} onChange={e=>setSendEmail(e.target.checked)} disabled={!booking?.client_email}/> <Mail size={13}/> Email
            </label>
            <label className="notify-option">
              <input type="checkbox" checked={sendWA} onChange={e=>setSendWA(e.target.checked)}/> <MessageCircle size={13}/> WhatsApp
            </label>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-outline" style={{color:'var(--black)',borderColor:'#dde5f5'}} onClick={onClose}>Cancelar</button>
          <button className="btn-primary" style={{background:'#9b3e00',color:'white',clipPath:'none',borderRadius:'4px'}}
            onClick={handleSave}>
            <CheckCircle size={14}/> Guardar aprobación requerida
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   TAB 1 — KANBAN BOARD (Reservas)
   ══════════════════════════════════════════════════════════ */

/* Compact booking card for kanban column */
function KanbanCard({ booking, onDragStart, onClick }) {
  const isUrgent = booking.status === 'waiting_approval'
  const hasCar   = booking.car_brand || booking.car_plate

  return (
    <div
      className={`kanban-card ${isUrgent?'kanban-card--urgent':''}`}
      draggable
      onDragStart={e=>onDragStart(e, booking)}
      onClick={()=>onClick(booking)}
    >
      <div className="kanban-card__grip">⠿</div>
      <div className="kanban-card__body">
        <div className="kanban-card__name">{booking.client_name}</div>
        <div className="kanban-card__service">{booking.service}</div>
        {hasCar && <div className="kanban-card__car">🚗 {booking.car_brand} {booking.car_model} {booking.car_plate&&`· ${booking.car_plate}`}</div>}
        <div className="kanban-card__meta">
          <span><Calendar size={11}/> {booking.booking_date}</span>
          <span><Clock size={11}/> {booking.time_slot}</span>
        </div>
        {/* Approval status — simplified single pill */}
        {booking.approval_comment && booking.approval_note && (
          <div className="kanban-card__approved">✅ Aprobado — {booking.approval_note.length>50 ? booking.approval_note.slice(0,50)+'…' : booking.approval_note}</div>
        )}
        {!booking.approval_comment && booking.approval_note && (
          <div className="kanban-card__approval">⏳ {booking.approval_note.length>60 ? booking.approval_note.slice(0,60)+'…' : booking.approval_note}</div>
        )}
      </div>
    </div>
  )
}

/* Kanban column */
function KanbanColumn({ status, bookings, onDrop, onDragOver, onCardClick }) {
  const s = STATUS_MAP[status]
  const [over, setOver] = useState(false)
  return (
    <div
      className={`kanban-col ${over?'kanban-col--over':''}`}
      onDragOver={e=>{e.preventDefault();setOver(true);onDragOver(e,status)}}
      onDragLeave={()=>setOver(false)}
      onDrop={e=>{setOver(false);onDrop(e,status)}}
    >
      <div className="kanban-col__header" style={{'--col-color':s.color}}>
        <span className="kanban-col__emoji">{s.emoji}</span>
        <span className="kanban-col__label">{s.label}</span>
        <span className="kanban-col__count">{bookings.length}</span>
      </div>
      <div className="kanban-col__body">
        {bookings.length===0
          ? <div className="kanban-empty">Sin reservas</div>
          : bookings.map(b=>(
            <KanbanCard key={b.id} booking={b}
              onDragStart={(e,b)=>{e.dataTransfer.setData('bookingId',String(b.id));e.dataTransfer.setData('fromStatus',b.status)}}
              onClick={onCardClick}/>
          ))}
      </div>
    </div>
  )
}

/* Booking detail drawer */
function BookingDrawer({ booking, onClose, onStatusChange, onRefresh }) {
  const [showCarModal,     setShowCarModal]     = useState(false)
  const [showApprovalModal,setShowApprovalModal] = useState(false)
  const [showRequireApprovalModal, setShowRequireApprovalModal] = useState(false)
  const [progress,         setProgress]         = useState([])
  const [loading,          setLoading]          = useState(true)
  const [newStatus,        setNewStatus]        = useState(booking.status)
  const [sendEmail,        setSendEmail]        = useState(!!booking.client_email)
  const [sendWA,           setSendWA]           = useState(false)
  const [saving,           setSaving]           = useState(false)
  const [msg,              setMsg]              = useState('')
  const [approvalHistory,  setApprovalHistory]  = useState([])
  const [loadingHistory,   setLoadingHistory]   = useState(false)
  const [workflowHistory,  setWorkflowHistory]  = useState([])
  const [loadingWorkflow,  setLoadingWorkflow]  = useState(false)

  const flash = m => { setMsg(m); setTimeout(()=>setMsg(''),3000) }
  const refreshHistory = () => {
    getApprovalHistory(booking.id).then(r=>setApprovalHistory(r.data||[])).catch(()=>{})
    getWorkflowHistory(booking.id).then(r=>setWorkflowHistory(r.data||[])).catch(()=>{})
  }

  useEffect(()=>{
    getProgress(booking.id).then(r=>setProgress(r.data)).finally(()=>setLoading(false))
    // load approval history
    setLoadingHistory(true)
    getApprovalHistory(booking.id).then(r=>setApprovalHistory(r.data || [])).catch(()=>setApprovalHistory([])).finally(()=>setLoadingHistory(false))
    // load workflow history
    setLoadingWorkflow(true)
    getWorkflowHistory(booking.id).then(r=>setWorkflowHistory(r.data || [])).catch(()=>setWorkflowHistory([])).finally(()=>setLoadingWorkflow(false))
  },[booking.id])

  const changeStatus = async () => {
    // waiting_approval must go through the dedicated modal
    if (newStatus === 'waiting_approval') {
      setShowRequireApprovalModal(true)
      return
    }
    // frontend guard for received: check mandatory car profile fields
    if (newStatus === 'received') {
      const imgs = booking.reception_images || []
      const missing = []
      if (!booking.car_brand) missing.push('Marca')
      if (!booking.car_model) missing.push('Modelo')
      if (!booking.car_year)  missing.push('Año')
      if (imgs.length < 3)    missing.push(`Fotos (mínimo 3, actualmente ${imgs.length})`)
      if (missing.length > 0) {
        flash(`❌ Perfil incompleto: ${missing.join(', ')}`)
        return
      }
    }
    setSaving(true)
    try {
      await updateBookingStatus(booking.id, newStatus, '', sendEmail, sendWA)
      flash(`✅ Estado → ${STATUS_MAP[newStatus]?.label}`)
      refreshHistory(); onRefresh()
    } catch(e) { flash('❌ '+extractError(e)) }
    finally { setSaving(false) }
  }

  const handleRequireSave = async (approvalNote, email, wa) => {
    setSaving(true)
    try {
      await updateBookingStatus(booking.id, 'waiting_approval', approvalNote, email, wa, null)
      flash('✅ Aprobación requerida registrada')
      setShowRequireApprovalModal(false)
      refreshHistory(); onRefresh()
    } catch(e) { flash('❌ '+extractError(e)) }
    finally { setSaving(false) }
  }

  const handleApprovalSave = async (comment, email, wa) => {
    await updateBookingStatus(booking.id, 'in_progress', '', email, wa, comment)
    flash('✅ Aprobación registrada')
    setShowApprovalModal(false)
    refreshHistory(); onRefresh()
  }

  const handleCarSave = async (form) => {
    await updateCarProfile(booking.id, form)
    flash('✅ Perfil guardado')
    setShowCarModal(false)
    onRefresh()
  }

  const openWA = async () => {
    try { const r = await getWaLink(booking.id); window.open(r.data.wa_link,'_blank') } catch{}
  }

  return (
    <>
      {showRequireApprovalModal && <RequireApprovalModal booking={booking} onSave={handleRequireSave} onClose={()=>setShowRequireApprovalModal(false)}/>} 
       {showCarModal      && <CarProfileModal booking={booking} onSave={handleCarSave} onClose={()=>setShowCarModal(false)}/>} 
       {showApprovalModal && <ApprovalModal   booking={booking} onSave={handleApprovalSave} onClose={()=>setShowApprovalModal(false)}/>} 
      <div className="drawer-overlay" onClick={onClose}/>
      <div className="drawer">
        <div className="drawer-header">
          <div>
            <StatusBadge status={booking.status}/>
            <h2 className="drawer-name">{booking.client_name}</h2>
            <div className="drawer-meta">
              <span><Calendar size={12}/> {booking.booking_date} · {booking.time_slot} hrs</span>
              <span>🔧 {booking.service}</span>
              {booking.client_phone && <span><Phone size={12}/> {booking.client_phone}</span>}
            </div>
          </div>
          <button className="drawer-close" onClick={onClose}><X size={20}/></button>
        </div>
        {msg && <div className="drawer-flash">{msg}</div>}
        <div className="drawer-body">

          {/* Car profile */}
          <div className="drawer-section">
            <div className="drawer-section__hdr">
              <h4>🚗 Vehículo</h4>
              <button className="detail-edit-btn" onClick={()=>setShowCarModal(true)}>
                <Edit3 size={12}/> {booking.car_brand?'Editar':'Agregar'}
              </button>
            </div>
            {booking.car_brand ? (
              <div className="drawer-grid-2">
                <div className="dg-item"><span>Vehículo</span><strong>{booking.car_brand} {booking.car_model} {booking.car_year&&`(${booking.car_year})`}</strong></div>
                {booking.car_plate && <div className="dg-item"><span>Placa</span><strong>{booking.car_plate}</strong></div>}
                {booking.car_color && <div className="dg-item"><span>Color</span><strong>{booking.car_color}</strong></div>}
                {booking.car_km    && <div className="dg-item"><span>Km</span><strong>{booking.car_km.toLocaleString()}</strong></div>}
                {booking.failure_desc && <div className="dg-item" style={{gridColumn:'1/-1'}}><span>Falla</span><strong>{booking.failure_desc}</strong></div>}
                {booking.reception_notes && <div className="dg-item" style={{gridColumn:'1/-1'}}><span>Recepción</span><strong>{booking.reception_notes}</strong></div>}
              </div>
            ) : <p className="drawer-empty-note">Sin perfil registrado</p>}
          </div>

          {/* Approval info — only for waiting_approval and in_progress */}
          {booking.approval_note && ['waiting_approval','in_progress'].includes(booking.status) && (
            <div className="drawer-section">
              <h4>⏳ Aprobación requerida</h4>
              <div className="approval-note"><AlertCircle size={13}/> {booking.approval_note}</div>
              {booking.approval_comment
                ? <div className="approval-comment"><CheckCircle size={13}/> {booking.approval_comment}</div>
                : booking.status==='waiting_approval' && (
                  <button className="approval-action-btn" onClick={()=>setShowApprovalModal(true)}>
                    <CheckCircle size={14}/> Registrar aprobación del cliente
                  </button>
                )
              }
            </div>
          )}

          {/* Workflow timeline */}
          <div className="drawer-section">
            <h4>🕐 Flujo de la reserva</h4>
            {loadingWorkflow ? <div className="drawer-empty-note">Cargando flujo…</div>
              : workflowHistory.length === 0 ? <div className="drawer-empty-note">Sin historial de cambios</div>
              : (
                <div className="workflow-timeline">
                  {workflowHistory.map((e, idx) => {
                    const s = STATUS_MAP[e.to_status] || { label: e.to_status, emoji: '•', color: '#888', bg: '#f5f5f5' }
                    const isLast = idx === workflowHistory.length - 1
                    // Dates come from backend already in Peru time — parse as local, no conversion needed
                    const dt = new Date(e.created_at + 'Z').toLocaleString('es-PE', {
                      timeZone: 'America/Lima',
                      day: 'numeric', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit', hour12: false
                    })
                    return (
                      <div key={e.id} className={`wf-step ${isLast ? 'wf-step--last' : ''}`}>
                        <div className="wf-step__line-col">
                          <div className="wf-step__dot" style={{background: s.color}}>{s.emoji}</div>
                          {!isLast && <div className="wf-step__line"/>}
                        </div>
                        <div className="wf-step__body">
                          <div className="wf-step__label" style={{color: s.color}}>{s.label}</div>
                          <div className="wf-step__meta">
                            {dt} hrs
                            {e.admin_name && <span> · {e.admin_name}</span>}
                          </div>
                          {e.approval_note && (
                            <div className="wf-step__note">📋 {e.approval_note}</div>
                          )}
                          {e.approval_comment && (
                            <div className="wf-step__approved">✅ {e.approval_comment}</div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
          </div>

          {/* Status change */}
          <div className="drawer-section">
            <h4>🔄 Cambiar estado</h4>
            <div className="drawer-status-row">
              <select value={newStatus} onChange={e=>setNewStatus(e.target.value)} className="drawer-status-select">
                {STATUSES.map(s=><option key={s.value} value={s.value}>{s.emoji} {s.label}</option>)}
              </select>
              <label className="notify-option" style={{fontSize:'0.78rem'}}>
                <input type="checkbox" checked={sendEmail} onChange={e=>setSendEmail(e.target.checked)} disabled={!booking.client_email}/>
                <Mail size={12}/> Email
              </label>
              <label className="notify-option" style={{fontSize:'0.78rem'}}>
                <input type="checkbox" checked={sendWA} onChange={e=>setSendWA(e.target.checked)}/>
                <MessageCircle size={12}/> WA
              </label>
              <button className="drawer-save-btn" onClick={changeStatus} disabled={saving||newStatus===booking.status}>
                {saving?'…':'Guardar'}
              </button>
            </div>
          </div>

          {/* Quick actions */}
          <div className="drawer-section">
            <h4>⚡ Acciones rápidas</h4>
            <div className="drawer-actions">
              <button className="action-btn action-btn--wa" onClick={openWA}><MessageCircle size={13}/> WhatsApp</button>
              {booking.client_email && (
                <button className="action-btn action-btn--email" onClick={()=>updateBookingStatus(booking.id,booking.status,'',true,false).then(()=>flash('✅ Email enviado'))}>
                  <Mail size={13}/> Email estado
                </button>
              )}
              {booking.status!=='cancelled'&&booking.status!=='delivered' && (
                <button className="action-btn action-btn--cancel" onClick={()=>{if(confirm('¿Cancelar?'))cancelBooking(booking.id).then(onRefresh)}}>
                  <Trash2 size={13}/> Cancelar
                </button>
              )}
            </div>
          </div>

          {/* Progress timeline */}
          <div className="drawer-section">
            <h4>📋 Progreso ({progress.length})</h4>
            {loading ? <p className="drawer-empty-note">Cargando…</p>
            : progress.length===0 ? <p className="drawer-empty-note">Sin entradas de progreso</p>
            : progress.slice(0,5).map(p=>(
              <div key={p.id} className="mini-progress">
                <span>{p.status==='delivered'?'🏁':p.status==='ready'?'✅':p.status==='waiting_parts'?'⏳':'🔧'}</span>
                <span className="mini-progress__title">{p.title}</span>
                <span className="mini-progress__date">{new Date(p.created_at).toLocaleDateString('es-PE',{day:'numeric',month:'short'})}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

/* ══════════════════════════════════════════════════════════
   TAB 2 — DASHBOARD
   ══════════════════════════════════════════════════════════ */
const TIME_RANGES = [{value:'today',label:'Hoy'},{value:'week',label:'Semana'},{value:'month',label:'Mes'},{value:'custom',label:'Personalizado'}]

function DashboardTab({ onApprovalNeeded }) {
  const [analytics,  setAnalytics]  = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [timeRange,  setTimeRange]  = useState('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [approvalHistories, setApprovalHistories] = useState({})

  const load = async (range=timeRange, from=customFrom, to=customTo) => {
    setLoading(true)
    try {
      let df=from, dt=to
      if (range!=='custom') {
        const today=new Date(), fmt2=d=>d.toISOString().split('T')[0]
        if (range==='today') {df=fmt2(today);dt=fmt2(today)}
        else if (range==='week') {const s=new Date(today);s.setDate(today.getDate()-7);df=fmt2(s);dt=fmt2(today)}
        else if (range==='month') {const s=new Date(today);s.setDate(today.getDate()-30);df=fmt2(s);dt=fmt2(today)}
        else {df='';dt=''}
      }
      const r = await getAnalytics(df||undefined, dt||undefined)
      setAnalytics(r.data)
    } finally { setLoading(false) }
  }

  useEffect(()=>{ load() },[])

  // Load approval histories for waiting_approval items when analytics updates
  useEffect(()=>{
    if (!analytics?.waiting_approval_list) return
    analytics.waiting_approval_list.forEach(item => {
      if (!item?.id) return
      if (approvalHistories[item.id]) return
      getApprovalHistory(item.id).then(r=>{
        setApprovalHistories(prev=>({ ...prev, [item.id]: r.data || [] }))
      }).catch(()=>{})
    })
  }, [analytics])

  const s = analytics?.summary
  const MAX = 15

  return (
    <div className="dash-tab">
      {/* Time range */}
      <div className="time-range-bar">
        {TIME_RANGES.map(tr=>(
          <button key={tr.value} className={`time-range-btn ${timeRange===tr.value?'time-range-btn--active':''}`}
            onClick={()=>{setTimeRange(tr.value);if(tr.value!=='custom')load(tr.value,'','')}}>
            {tr.label}
          </button>
        ))}
        {timeRange==='custom' && (
          <div className="custom-range">
            <input type="date" value={customFrom} onChange={e=>setCustomFrom(e.target.value)}/>
            <span>→</span>
            <input type="date" value={customTo} onChange={e=>setCustomTo(e.target.value)}/>
            <button className="time-range-btn time-range-btn--active" onClick={()=>load('custom',customFrom,customTo)}>Aplicar</button>
          </div>
        )}
        <button className="admin-refresh" onClick={()=>load()}><RefreshCw size={14}/></button>
      </div>

      {loading ? <div className="admin-loading">Cargando dashboard…</div> : s && (
        <>
          {/* Garage capacity bar */}
          <div className="garage-capacity-bar">
            <div className="gcb-label">
              <span>🏭 Capacidad del taller</span>
              <span className={s.garage_at_capacity?'gcb-full':'gcb-ok'}>
                {s.total_in_garage} / {MAX} autos {s.garage_at_capacity ? '— ⚠️ LLENO' : `— ${s.garage_slots_free} lugar${s.garage_slots_free!==1?'es':''} libre${s.garage_slots_free!==1?'s':''}`}
              </span>
            </div>
            <div className="gcb-track">
              <div className="gcb-fill" style={{width:`${Math.min(100,(s.total_in_garage/MAX)*100)}%`, background: s.garage_at_capacity?'#c0392b':s.total_in_garage>=MAX*0.8?'#F7C416':'#1a8a3a'}}/>
            </div>
          </div>

          {/* KPI grid */}
          <div className="kpi-grid">
            {[
              {emoji:'🏭',label:'Autos en taller',value:s.total_in_garage,color:'#073590'},
              {emoji:'🔧',label:'En reparación',value:s.in_progress,color:'#c87800'},
              {emoji:'⏳',label:'Esp. aprobación',value:s.waiting_approval,color:'#9b3e00',alert:s.waiting_approval>0},
              {emoji:'🎉',label:'Finalizados',value:s.finished_not_delivered,color:'#1a5e20'},
              {emoji:'🏁',label:'Entregados (semana)',value:s.delivered_this_week,color:'#444',sub:`${s.delivered_this_month} este mes`},
              {emoji:'📋',label:'Solicitudes pendientes',value:s.pending_requests,color:'#5a6a8a'},
            ].map(k=>(
              <div key={k.label} className={`kpi-card ${k.alert?'kpi-card--alert':''}`}>
                <div className="kpi-emoji">{k.emoji}</div>
                <div className="kpi-value" style={{color:k.color}}>{k.value}</div>
                <div className="kpi-label">{k.label}</div>
                {k.sub && <div className="kpi-sub">{k.sub}</div>}
              </div>
            ))}
          </div>

          {/* Waiting approval section */}
          {analytics.waiting_approval_list?.length > 0 && (
            <div className="dash-approval-section">
              <div className="dash-approval-hdr">
                <AlertTriangle size={16} color="#9b3e00"/>
                <h3>⏳ Esperando aprobación ({analytics.waiting_approval_list.length})</h3>
              </div>
              {analytics.waiting_approval_list.map(item=>(
                <div key={item.id} className="dash-approval-item">
                  <div>
                    <div className="dash-ap-name">{item.client_name}</div>
                    <div className="dash-ap-meta">{item.car && `🚗 ${item.car} · `}🔧 {item.service} · 📅 {item.booking_date}</div>
                    {item.approval_note && <div className="dash-ap-note">{item.approval_note}</div>}
                    {/* approval history summary */}
                    {approvalHistories[item.id] && approvalHistories[item.id].length>0 && (
                      <div style={{marginTop:'0.5rem',fontSize:'0.86rem',color:'var(--gray)'}}>Historial:
                        <ul style={{margin:'6px 0 0 12px',padding:0}}>
                          {approvalHistories[item.id].slice(0,3).map(h=> (
                            <li key={h.id} style={{marginBottom:'4px'}}>{(h.approval_note||'Aprobación requerida').slice(0,80)} — <span style={{color:'#666',fontSize:'0.82rem'}}>{new Date(h.created_at).toLocaleDateString('es-PE')}</span></li>
                          ))}
                          {approvalHistories[item.id].length>3 && <li style={{color:'var(--gray)',fontSize:'0.82rem'}}>y {approvalHistories[item.id].length-3} más…</li>}
                        </ul>
                      </div>
                    )}
                  </div>
                  <button className="approval-action-btn" style={{flexShrink:0}} onClick={()=>onApprovalNeeded(item)}>
                    <CheckCircle size={13}/> Registrar aprobación
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Service breakdown */}
          {Object.keys(analytics.service_counts||{}).length > 0 && (
            <div className="dash-section">
              <h3 className="dash-section-h3">🔧 Distribución por servicio</h3>
              {Object.entries(analytics.service_counts).sort((a,b)=>b[1]-a[1]).map(([svc,cnt])=>{
                const max = Math.max(...Object.values(analytics.service_counts))
                return (
                  <div key={svc} className="service-bar-row">
                    <div className="service-bar-label">{svc}</div>
                    <div className="service-bar-track"><div className="service-bar-fill" style={{width:`${(cnt/max)*100}%`}}/></div>
                    <div className="service-bar-count">{cnt}</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Active cars list */}
          {analytics.active_cars?.length > 0 && (
            <div className="dash-section">
              <h3 className="dash-section-h3">🏭 Autos en taller ({analytics.active_cars.length})</h3>
              {analytics.active_cars.map(car=>{
                const sc = STATUS_MAP[car.status]||{}
                return (
                  <div key={car.id} className={`active-car-row ${car.status==='waiting_approval'?'active-car-row--approval':''}`}>
                    <div style={{fontSize:'1.4rem',flexShrink:0}}>{sc.emoji||'🔧'}</div>
                    <div style={{flex:1}}>
                      <div className="active-car-row__name">{car.client_name}</div>
                      <div className="active-car-row__meta">
                        {car.car_brand&&<span><Car size={11}/> {car.car_brand} {car.car_model} {car.car_plate&&`· ${car.car_plate}`}</span>}
                        <span>🔧 {car.service}</span><span>📅 {car.booking_date}</span>
                        {car.last_title&&<span>📋 {car.last_title}</span>}
                      </div>
                      {car.approval_note && car.status==='waiting_approval' && (
                        <div className="active-car-row__approval-note"><AlertTriangle size={11}/> {car.approval_note}</div>
                      )}
                    </div>
                    <div style={{flexShrink:0}}><StatusBadge status={car.status} size="sm"/></div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   TAB 3 — MENSAJES
   ══════════════════════════════════════════════════════════ */
function MessagesTab() {
  const [usersList,    setUsersList]    = useState([])
  const [selUser,      setSelUser]      = useState(null)
  const [thread,       setThread]       = useState([])
  const [replyText,    setReplyText]    = useState('')
  const [sending,      setSending]      = useState(false)
  const [loadingThread,setLoadingThread]= useState(false)
  const msgEndRef = useRef()

  useEffect(()=>{
    getAdminUsers().then(r=>setUsersList(r.data)).catch(()=>{})
  },[])

  const loadThread = async (u) => {
    setSelUser(u); setLoadingThread(true)
    try { const r=await adminGetMessages(u.id); setThread(r.data); setTimeout(()=>msgEndRef.current?.scrollIntoView({behavior:'smooth'}),100) }
    finally { setLoadingThread(false) }
  }

  const handleReply = async (e) => {
    e.preventDefault()
    if (!replyText.trim()||!selUser) return
    setSending(true)
    try {
      await adminReplyMessage(selUser.id,{body:replyText})
      setReplyText('')
      const r=await adminGetMessages(selUser.id); setThread(r.data)
      setTimeout(()=>msgEndRef.current?.scrollIntoView({behavior:'smooth'}),100)
    } finally { setSending(false) }
  }

  return (
    <div className="admin-messages-panel">
      <div className="admin-msg-sidebar">
        <div className="admin-msg-sidebar__header">
          <MessageCircle size={14}/> Clientes ({usersList.length})
          <button className="admin-refresh" style={{marginLeft:'auto',width:'26px',height:'26px'}} onClick={()=>getAdminUsers().then(r=>setUsersList(r.data))}><RefreshCw size={12}/></button>
        </div>
        {usersList.length===0
          ? <div className="admin-msg-empty-sidebar"><MessageCircle size={28} color="#c8d5ee"/><p>Sin usuarios registrados</p></div>
          : usersList.map(u=>(
            <button key={u.id} className={`admin-msg-user ${selUser?.id===u.id?'admin-msg-user--active':''}`} onClick={()=>loadThread(u)}>
              <div className="admin-msg-user__avatar">{u.name[0].toUpperCase()}</div>
              <div className="admin-msg-user__info">
                <div className="admin-msg-user__name">{u.name}</div>
                <div className="admin-msg-user__email">{u.email}</div>
              </div>
            </button>
          ))}
      </div>
      <div className="admin-msg-chat">
        {!selUser ? (
          <div className="admin-msg-select-prompt"><MessageCircle size={44} color="#c8d5ee"/><p>Selecciona un cliente</p></div>
        ) : (
          <>
            <div className="admin-msg-chat__header">
              <div className="admin-msg-user__avatar">{selUser.name[0].toUpperCase()}</div>
              <div><div style={{fontFamily:'var(--font-condensed)',fontWeight:700,color:'var(--black)'}}>{selUser.name}</div>
              <div style={{fontSize:'0.73rem',color:'var(--gray)'}}>{selUser.email}</div></div>
              <button className="admin-refresh" style={{marginLeft:'auto'}} onClick={()=>loadThread(selUser)}><RefreshCw size={13}/></button>
            </div>
            <div className="admin-msg-thread">
              {loadingThread ? <div style={{textAlign:'center',padding:'2rem',color:'var(--gray)'}}>Cargando…</div>
              : thread.length===0 ? <div style={{textAlign:'center',padding:'2rem',color:'var(--gray)'}}>Sin mensajes aún</div>
              : thread.map(m=>(
                <div key={m.id} className={`admin-msg-bubble-wrap ${m.sender_role==='admin'?'admin-side':'user-side'}`}>
                  <div className={`admin-msg-bubble ${m.sender_role==='admin'?'admin-bubble':'user-bubble'}`}>
                    {m.booking_id&&<div className="msg-ref">📅 Reserva #{m.booking_id}</div>}
                    {m.body}
                  </div>
                  <div className="admin-msg-time">
                    {m.sender_role==='admin'?'🔧 Tú':`👤 ${selUser.name}`} · {new Date(m.created_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})} {new Date(m.created_at).toLocaleDateString('es-PE',{day:'numeric',month:'short'})}
                  </div>
                </div>
              ))}
              <div ref={msgEndRef}/>
            </div>
            <form className="admin-msg-reply" onSubmit={handleReply}>
              <textarea rows={2} placeholder={`Responder a ${selUser.name}…`} value={replyText}
                onChange={e=>setReplyText(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleReply(e)}}}/>
              <button type="submit" disabled={sending||!replyText.trim()}><Send size={17}/></button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   TAB 4 — LOGS
   ══════════════════════════════════════════════════════════ */
function LogsTab() {
  const [logs,    setLogs]    = useState([])
  const [loading, setLoading] = useState(true)
  const [msg,     setMsg]     = useState('')

  const flash = m => { setMsg(m); setTimeout(()=>setMsg(''),3000) }

  const load = async () => {
    setLoading(true)
    try { const r=await getAuditLogs(50); setLogs(r.data) } finally { setLoading(false) }
  }

  useEffect(()=>{ load() },[])

  const handleUndo = async (log) => {
    try { const r=await undoAction(log.id); flash(`↩️ ${r.data.message}`); load() }
    catch(e) { flash('❌ '+extractError(e)) }
  }

  const handleRedo = async (log) => {
    try { const r=await redoAction(log.id); flash(`↪️ ${r.data.message}`); load() }
    catch(e) { flash('❌ '+extractError(e)) }
  }

  const ACTION_ICONS = { status_change:'🔄', approve:'✅', undo:'↩️', redo:'↪️', car_profile:'🚗', message:'💬' }

  return (
    <div className="logs-tab">
      <div className="logs-header">
        <div>
          <h3>📋 Registro de acciones</h3>
          <p>Últimas 50 acciones del panel de administración. Puedes deshacer/rehacer cambios de estado.</p>
        </div>
        <button className="admin-refresh" onClick={load}><RefreshCw size={15}/></button>
      </div>
      {msg && <div className="logs-msg">{msg}</div>}
      {loading ? <div className="admin-loading">Cargando logs…</div>
      : logs.length===0 ? <div className="admin-empty">Sin acciones registradas aún</div>
      : (
        <div className="logs-list">
          {logs.map(log=>(
            <div key={log.id} className={`log-entry ${log.undone?'log-entry--undone':''}`}>
              <div className="log-entry__icon">{ACTION_ICONS[log.action]||'📝'}</div>
              <div className="log-entry__body">
                <div className="log-entry__desc">{log.description}</div>
                <div className="log-entry__meta">
                  <span>👤 {log.admin_name||'Sistema'}</span>
                  <span>📅 {new Date(log.created_at).toLocaleDateString('es-PE',{day:'numeric',month:'short',year:'numeric'})}</span>
                  <span>🕒 {new Date(log.created_at).toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'})}</span>
                  {log.entity_id && <span>Reserva #{log.entity_id}</span>}
                  {log.undone && <span className="log-undone-badge">DESHECHO</span>}
                </div>
              </div>
              {log.action==='status_change' && (
                <div className="log-entry__actions">
                  {!log.undone
                    ? <button className="log-btn log-btn--undo" onClick={()=>handleUndo(log)} title="Deshacer">
                        <RotateCcw size={13}/> Deshacer
                      </button>
                    : <button className="log-btn log-btn--redo" onClick={()=>handleRedo(log)} title="Rehacer">
                        <RotateCw size={13}/> Rehacer
                      </button>
                  }
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   VISITAS TAB
   ══════════════════════════════════════════════════════════ */
function VisitasTab() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [days,    setDays]    = useState(30)

  const load = async (d) => {
    setLoading(true)
    try { const r = await getPageAnalytics(d); setData(r.data) } catch {}
    finally { setLoading(false) }
  }

  useEffect(() => { load(days) }, [days])

  const conversion = data && data.totals.page_views > 0
    ? ((data.totals.click_reservar / data.totals.page_views) * 100).toFixed(1)
    : '0.0'

  const maxDay = data ? Math.max(...data.daily.map(d => d.page_view), 1) : 1

  return (
    <div className="visitas-tab">
      <div className="visitas-header">
        <div>
          <h3>📊 Visitas y clicks</h3>
          <p>Cuántas personas visitan la web, hacen click en Reservar o llaman.</p>
        </div>
        <div className="visitas-period">
          {[7,30,90].map(d => (
            <button key={d} className={`visitas-period-btn${days===d?' active':''}`} onClick={()=>setDays(d)}>
              {d}d
            </button>
          ))}
          <button className="admin-refresh" onClick={()=>load(days)}><RefreshCw size={15}/></button>
        </div>
      </div>

      {loading ? <div className="admin-loading">Cargando estadísticas…</div> : !data ? (
        <div className="admin-loading">Sin datos aún. Las visitas aparecerán aquí cuando alguien entre a la web.</div>
      ) : (
        <>
          {/* KPI cards */}
          <div className="visitas-kpis">
            <div className="visitas-kpi">
              <div className="visitas-kpi__icon">👁️</div>
              <div className="visitas-kpi__val">{data.totals.page_views.toLocaleString()}</div>
              <div className="visitas-kpi__label">Visitas totales</div>
            </div>
            <div className="visitas-kpi">
              <div className="visitas-kpi__icon">👤</div>
              <div className="visitas-kpi__val">{data.totals.unique_visitors.toLocaleString()}</div>
              <div className="visitas-kpi__label">Visitantes únicos</div>
            </div>
            <div className="visitas-kpi visitas-kpi--accent">
              <div className="visitas-kpi__icon">📅</div>
              <div className="visitas-kpi__val">{data.totals.click_reservar.toLocaleString()}</div>
              <div className="visitas-kpi__label">Clicks "Reservar"</div>
            </div>
            <div className="visitas-kpi visitas-kpi--green">
              <div className="visitas-kpi__icon">📞</div>
              <div className="visitas-kpi__val">{data.totals.click_llamar.toLocaleString()}</div>
              <div className="visitas-kpi__label">Clicks "Llamar"</div>
            </div>
            <div className="visitas-kpi visitas-kpi--blue">
              <div className="visitas-kpi__icon">🎯</div>
              <div className="visitas-kpi__val">{conversion}%</div>
              <div className="visitas-kpi__label">Conversión reservas</div>
            </div>
          </div>

          {/* Daily bar chart */}
          {data.daily.length > 0 && (
            <div className="visitas-chart-wrap">
              <h4>Visitas por día (últimos {Math.min(days, 14)} días)</h4>
              <div className="visitas-chart">
                {data.daily.map((d, i) => (
                  <div key={i} className="visitas-bar-group">
                    <div className="visitas-bars">
                      <div className="visitas-bar visitas-bar--view"   style={{height: `${(d.page_view/maxDay)*100}%`}} title={`${d.page_view} visitas`}/>
                      <div className="visitas-bar visitas-bar--reservar" style={{height: `${(d.click_reservar/maxDay)*100}%`}} title={`${d.click_reservar} reservar`}/>
                      <div className="visitas-bar visitas-bar--llamar"   style={{height: `${(d.click_llamar/maxDay)*100}%`}} title={`${d.click_llamar} llamar`}/>
                    </div>
                    <div className="visitas-bar-label">{d.date.slice(5)}</div>
                  </div>
                ))}
              </div>
              <div className="visitas-legend">
                <span><span className="visitas-dot visitas-dot--view"/>Visitas</span>
                <span><span className="visitas-dot visitas-dot--reservar"/>Reservar</span>
                <span><span className="visitas-dot visitas-dot--llamar"/>Llamar</span>
              </div>
            </div>
          )}

          {/* Locations */}
          {data.locations?.length > 0 && (
            <div className="visitas-chart-wrap" style={{marginTop:'1rem'}}>
              <h4>📍 Ubicación de visitantes</h4>
              <div className="visitas-locations">
                {data.locations.map((loc, i) => {
                  const maxLoc = data.locations[0].visitors
                  const pct    = Math.round((loc.visitors / maxLoc) * 100)
                  const flag   = loc.countryCode
                    ? `https://flagcdn.com/20x15/${loc.countryCode.toLowerCase()}.png`
                    : null
                  return (
                    <div key={i} className="visitas-loc-row">
                      <div className="visitas-loc-label">
                        {flag && <img src={flag} alt={loc.countryCode} className="visitas-loc-flag"/>}
                        <span>{loc.location}</span>
                      </div>
                      <div className="visitas-loc-bar-wrap">
                        <div className="visitas-loc-bar" style={{width:`${pct}%`}}/>
                      </div>
                      <div className="visitas-loc-count">{loc.visitors}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════════
   MAIN ADMIN PAGE
   ══════════════════════════════════════════════════════════ */
export default function Admin() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [activeTab,    setActiveTab]    = useState('kanban')
  const [bookings,     setBookings]     = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [dragOver,     setDragOver]     = useState(null)
  const [selectedBook, setSelectedBook] = useState(null)
  const [unreadCount,  setUnreadCount]  = useState(0)
  const [approvalItem, setApprovalItem] = useState(null) // for dashboard approval modal
  const [requireApprovalItem, setRequireApprovalItem] = useState(null) // for requiring approval note when moving to waiting_approval

  const load = async () => {
    setLoading(true)
    try { const r=await getAllBookings(); setBookings(r.data) }
    catch(e) { if(e.response?.status===401) navigate('/login') }
    finally { setLoading(false) }
  }

  useEffect(()=>{
    load()
    adminUnreadCount().then(r=>setUnreadCount(r.data.count)).catch(()=>{})
  },[])

  /* Kanban drag-drop */
  const handleDrop = async (e, toStatus) => {
    const bookingId = parseInt(e.dataTransfer.getData('bookingId'))
    const fromStatus = e.dataTransfer.getData('fromStatus')
    if (!bookingId || fromStatus===toStatus) return
    const booking = bookings.find(b=>b.id===bookingId)
    if (!booking) return

    // If dropping into waiting_approval → require admin to enter the approval text
    if (toStatus === 'waiting_approval') {
      setRequireApprovalItem({ ...booking, _targetStatus: toStatus })
      return
    }
    // If dropping into waiting_approval → just update (approval_note can be added later)
    // If dropping out of waiting_approval into in_progress → show approval modal
    if (fromStatus==='waiting_approval' && toStatus==='in_progress') {
      setApprovalItem({ ...booking, _targetStatus: toStatus })
      return
    }
    try {
      await updateBookingStatus(bookingId, toStatus, '', false, false)
      setBookings(prev=>prev.map(b=>b.id===bookingId?{...b,status:toStatus}:b))
      // Update drawer if open
      if (selectedBook?.id===bookingId) setSelectedBook(prev=>({...prev,status:toStatus}))
    } catch(e) { alert(extractError(e)) }
  }

  const handleApprovalFromDash = async (comment, email, wa) => {
    if (!approvalItem) return
    const targetStatus = approvalItem._targetStatus || 'in_progress'
    await updateBookingStatus(approvalItem.id, targetStatus, '', email, wa, comment)
    setApprovalItem(null)
    load()
  }

  const handleRequireFromDash = async (approvalNote, email, wa) => {
    if (!requireApprovalItem) return
    const targetStatus = requireApprovalItem._targetStatus || 'waiting_approval'
    await updateBookingStatus(requireApprovalItem.id, targetStatus, approvalNote, email, wa, null)
    setRequireApprovalItem(null)
    load()
  }

  const filtered = search
    ? bookings.filter(b=>b.client_name.toLowerCase().includes(search.toLowerCase())||b.client_phone?.includes(search)||(b.car_plate||'').toLowerCase().includes(search.toLowerCase())||b.service.toLowerCase().includes(search.toLowerCase()))
    : bookings

  const byStatus = Object.fromEntries(STATUSES.map(s=>[s.value, filtered.filter(b=>b.status===s.value)]))

  return (
    <div className="admin-page">
      {requireApprovalItem && <RequireApprovalModal booking={requireApprovalItem} onSave={handleRequireFromDash} onClose={()=>setRequireApprovalItem(null)}/>} 
      {/* Approval modal (from dashboard or kanban drag) */}
      {approvalItem && (
        <ApprovalModal booking={approvalItem} onSave={handleApprovalFromDash} onClose={()=>setApprovalItem(null)}/>
      )}

      {/* Booking drawer */}
      {selectedBook && (
        <BookingDrawer
          booking={selectedBook}
          onClose={()=>setSelectedBook(null)}
          onStatusChange={(id,status)=>setBookings(prev=>prev.map(b=>b.id===id?{...b,status}:b))}
          onRefresh={()=>{load();setSelectedBook(null)}}
        />
      )}

      {/* Hero */}
      <div className="admin-hero container">
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:'1rem'}}>
          <div>
            <div className="section-tag">Panel de administración</div>
            <h1 className="section-title">PANEL<br/><span style={{color:'var(--accent)'}}>ADMIN</span></h1>
            {user && <p style={{color:'rgba(255,255,255,0.55)',fontSize:'0.8rem',marginTop:'0.4rem'}}><Shield size={12} style={{display:'inline',marginRight:'4px'}}/>{user.name} · {user.role}</p>}
          </div>
          <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap',alignItems:'center'}}>
            {user?.role==='superadmin' && <button onClick={()=>navigate('/superadmin')} className="btn-primary" style={{background:'var(--accent)',color:'var(--black)',clipPath:'none',borderRadius:'4px',fontSize:'0.82rem',padding:'0.5rem 1rem'}}>SuperAdmin →</button>}
            <button onClick={()=>{logout();navigate('/')}} className="btn-outline" style={{color:'white',borderColor:'rgba(255,255,255,0.3)',fontSize:'0.82rem',padding:'0.5rem 1rem',display:'flex',alignItems:'center',gap:'0.35rem'}}><LogOut size={13}/>Salir</button>
          </div>
        </div>
        {/* Main tabs */}
        <div className="admin-main-tabs">
          <button className={`admin-main-tab ${activeTab==='kanban'?'admin-main-tab--active':''}`} onClick={()=>setActiveTab('kanban')}>
            <List size={14}/> Reservas
          </button>
          <button className={`admin-main-tab ${activeTab==='dashboard'?'admin-main-tab--active':''}`} onClick={()=>setActiveTab('dashboard')}>
            <BarChart2 size={14}/> Dashboard
          </button>
          <button className={`admin-main-tab ${activeTab==='messages'?'admin-main-tab--active':''}`} onClick={()=>setActiveTab('messages')}>
            <MessageCircle size={14}/> Mensajes
            {unreadCount>0 && <span className="admin-unread-badge">{unreadCount}</span>}
          </button>
          <button className={`admin-main-tab ${activeTab==='logs'?'admin-main-tab--active':''}`} onClick={()=>setActiveTab('logs')}>
            <RotateCcw size={14}/> Logs
          </button>
          <button className={`admin-main-tab ${activeTab==='visitas'?'admin-main-tab--active':''}`} onClick={()=>setActiveTab('visitas')}>
            <BarChart2 size={14}/> Visitas
          </button>
        </div>
      </div>

      <div className="admin-layout container">

        {/* ── KANBAN TAB ── */}
        {activeTab==='kanban' && (
          <>
            <div className="kanban-toolbar">
              <div className="admin-search">
                <input placeholder="🔍 Buscar cliente, placa, servicio…" value={search} onChange={e=>setSearch(e.target.value)}/>
                {search && <button onClick={()=>setSearch('')} style={{background:'none',border:'none',color:'var(--gray)',cursor:'pointer'}}><X size={14}/></button>}
              </div>
              <button className="admin-refresh" onClick={load}><RefreshCw size={15}/></button>
              <span className="kanban-hint">💡 Arrastra las tarjetas para cambiar el estado</span>
            </div>
            {loading ? <div className="admin-loading">Cargando reservas…</div> : (
              <div className="kanban-board">
                {STATUSES.map(s=>(
                  <KanbanColumn key={s.value} status={s.value} bookings={byStatus[s.value]||[]}
                    onDrop={handleDrop} onDragOver={()=>setDragOver(s.value)}
                    onCardClick={b=>setSelectedBook(b)}/>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── DASHBOARD TAB ── */}
        {activeTab==='dashboard' && (
          <DashboardTab onApprovalNeeded={item=>setApprovalItem({...item, client_name:item.client_name, client_email:null, client_phone:null})}/>
        )}

        {/* ── MESSAGES TAB ── */}
        {activeTab==='messages' && <MessagesTab/>}

        {/* ── LOGS TAB ── */}
        {activeTab==='logs' && <LogsTab/>}

        {/* ── VISITAS TAB ── */}
        {activeTab==='visitas' && <VisitasTab/>}

      </div>
    </div>
  )
}

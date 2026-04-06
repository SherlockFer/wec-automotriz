import React, { useState, useEffect, useRef } from 'react'
import {
  CheckCircle, AlertCircle, ChevronLeft, ChevronRight,
  Clock, Calendar, User, Phone, Mail, FileText, ShieldCheck
} from 'lucide-react'
import { getAvailability, createBooking, sendVerifyCode, confirmVerifyCode } from '../api/index.js'
import { extractError } from '../api/errors.js'
import './Booking.css'

/* ─── Constants ─────────────────────────────────────── */
const SERVICES = [
  'Mantenimiento Preventivo','Reparación de Frenos','Alineación y Balanceo',
  'Cambio de Aceite y Filtros','Reparación de Suspensión','Cremallera Mecánica',
  'Cremallera Hidráulica','Amortiguadores','Diagnóstico General','Otro',
]
const DAY_NAMES   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                     'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const HCAPTCHA_SITE_KEY = '11e40a7a-9998-4c9e-bea0-1a089e9e38d8'

/* ─── Pure helpers ───────────────────────────────────── */
function pad(n) { return String(n).padStart(2, '0') }
function toDateStr(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }
function isSun(d) { return d.getDay() === 0 }
function isSat(d) { return d.getDay() === 6 }
function allowedSlots(d) {
  if (isSun(d)) return []
  if (isSat(d)) return ['09:00']
  return ['09:00','14:00','15:00']
}
function isToday(d) {
  const t = new Date(); t.setHours(0,0,0,0)
  return d < t
}

/* ─── hCaptcha – only rendered on prod, bypassed on localhost ── */
const IS_LOCAL = window.location.hostname === 'localhost' ||
                 window.location.hostname === '127.0.0.1'

function Captcha({ onToken }) {
  const divRef = useRef(null)
  const mounted = useRef(false)

  useEffect(() => {
    // Localhost: skip captcha entirely
    if (IS_LOCAL) { onToken('dev-bypass-local'); return }
    if (mounted.current) return
    mounted.current = true

    function render() {
      if (divRef.current && window.hcaptcha) {
        window.hcaptcha.render(divRef.current, {
          sitekey: HCAPTCHA_SITE_KEY,
          callback: onToken,
        })
      }
    }

    if (window.hcaptcha) { render(); return }
    const s = document.createElement('script')
    s.src = 'https://js.hcaptcha.com/1/api.js?render=explicit'
    s.async = true; s.defer = true
    s.onload = render
    document.head.appendChild(s)
  }, [])

  if (IS_LOCAL) return (
    <div className="captcha-dev">🔧 Captcha omitido en localhost</div>
  )
  return <div ref={divRef} className="hcaptcha-widget" />
}

/* ─── Main component ─────────────────────────────────── */
export default function Booking() {
  const TODAY = new Date(); TODAY.setHours(0,0,0,0)

  // Calendar state
  const [month,    setMonth]    = useState(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))
  const [selDate,  setSelDate]  = useState(null)
  const [avail,    setAvail]    = useState(null)   // {time_slots, available_slots, is_full}
  const [loadAvail,setLoadAvail]= useState(false)
  const [selSlot,  setSelSlot]  = useState(null)

  // Mini-dots per day (just colours — no crash-prone cache)
  const [dotCache, setDotCache] = useState({})
  const fetchedRef = useRef(new Set())

  // Form / flow
  const [step,      setStep]      = useState(1)   // 1=calendar, 2=form, 3=done
  const [form,      setForm]      = useState({ name:'', phone:'', email:'', service:'', notes:'' })
  const [token,     setToken]     = useState('')
  const [submitting,setSubmitting]= useState(false)
  const [error,     setError]     = useState('')

  // Contact verification
  const [prefContact,    setPrefContact]    = useState('phone') // 'phone'|'email'|'both'
  const [phoneCodeSent,  setPhoneCodeSent]  = useState(false)
  const [emailCodeSent,  setEmailCodeSent]  = useState(false)
  const [phoneCode,      setPhoneCode]      = useState('')
  const [emailCode,      setEmailCode]      = useState('')
  const [phoneVerified,  setPhoneVerified]  = useState(false)
  const [emailVerified,  setEmailVerified]  = useState(false)
  const [sendingPhone,   setSendingPhone]   = useState(false)
  const [sendingEmail,   setSendingEmail]   = useState(false)
  const [verifyError,    setVerifyError]    = useState('')

  /* Load availability dots for visible month */
  useEffect(() => {
    const yr = month.getFullYear()
    const mo = month.getMonth()
    const key = `${yr}-${mo}`
    if (fetchedRef.current.has(key)) return
    fetchedRef.current.add(key)

    const days = new Date(yr, mo+1, 0).getDate()
    const reqs = []
    for (let d=1; d<=days; d++) {
      const date = new Date(yr, mo, d)
      if (date < TODAY || isSun(date)) continue
      const ds = toDateStr(date)
      reqs.push(
        getAvailability(ds)
          .then(r => ({ ds, avail: r.data.available_slots, full: r.data.is_full, error: false }))
          .catch(() => ({ ds, avail: null, full: false, error: true }))
      )
    }
    if (!reqs.length) return
    Promise.all(reqs).then(results => {
      setDotCache(prev => {
        const next = { ...prev }
        results.forEach(({ ds, avail, full, error }) => { next[ds] = { avail, full, error: error || false } })
        return next
      })
    })
  }, [month])

  /* Click a calendar day */
  function pickDay(date) {
    if (!date || date < TODAY || isSun(date)) return
    setSelDate(date)
    setSelSlot(null)
    setAvail(null)
    setStep(1)
    setLoadAvail(true)
    getAvailability(toDateStr(date))
      .then(r => {
        const slots = allowedSlots(date)
        setAvail({
          ...r.data,
          time_slots:      r.data.time_slots.filter(s => slots.includes(s.time)),
          available_slots: r.data.time_slots.filter(s => slots.includes(s.time) && !s.booked).length,
          is_full:         r.data.time_slots.filter(s => slots.includes(s.time) && !s.booked).length === 0,
        })
      })
      .catch(() => setAvail(null))
      .finally(() => setLoadAvail(false))
  }

  /* Verification helpers */
  function needsPhoneVerify() { return prefContact === 'phone' || prefContact === 'both' }
  function needsEmailVerify() { return prefContact === 'email' || prefContact === 'both' }
  function isVerified() {
    if (needsPhoneVerify() && !phoneVerified) return false
    if (needsEmailVerify() && !emailVerified) return false
    return true
  }

  async function handleSendCode(type) {
    const value = type === 'phone' ? form.phone : form.email
    if (!value) { setVerifyError(`Ingresa tu ${type === 'phone' ? 'teléfono' : 'correo'} primero`); return }
    if (type === 'phone') {
      const clean = value.replace(/[\s\-\(\)\+]/g, '')
      if (!/^\d{7,15}$/.test(clean)) { setVerifyError('Número de teléfono inválido'); return }
    }
    setVerifyError('')
    type === 'phone' ? setSendingPhone(true) : setSendingEmail(true)
    try {
      await sendVerifyCode(type, value)
      type === 'phone' ? setPhoneCodeSent(true) : setEmailCodeSent(true)
    } catch(e) {
      setVerifyError(e?.response?.data?.detail || `No se pudo enviar el código`)
    } finally {
      type === 'phone' ? setSendingPhone(false) : setSendingEmail(false)
    }
  }

  async function handleConfirmCode(type) {
    const value = type === 'phone' ? form.phone : form.email
    const code  = type === 'phone' ? phoneCode : emailCode
    if (!code) { setVerifyError('Ingresa el código'); return }
    setVerifyError('')
    try {
      await confirmVerifyCode(type, value, code)
      type === 'phone' ? setPhoneVerified(true) : setEmailVerified(true)
    } catch(e) {
      setVerifyError(e?.response?.data?.detail || 'Código incorrecto')
    }
  }

  /* Submit booking */
  async function submit(e) {
    e.preventDefault()
    if (!form.name || !form.phone || !form.service) {
      setError('Por favor completa los campos obligatorios.')
      return
    }
    const cleanPhone = form.phone.replace(/[\s\-\(\)\+]/g, '')
    if (!/^\d{7,15}$/.test(cleanPhone)) {
      setError('Número de teléfono inválido. Ingresa entre 7 y 15 dígitos (ej: 987654321).')
      return
    }
    if (needsEmailVerify() && !form.email) {
      setError('Ingresa tu correo para verificarlo.')
      return
    }
    if (!isVerified()) {
      setError('Por favor verifica tu medio de contacto antes de continuar.')
      return
    }
    if (!token) {
      setError('Por favor completa el captcha.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await createBooking({
        client_name:   form.name,
        client_phone:  form.phone,
        client_email:  form.email || null,
        service:       form.service,
        notes:         form.notes || null,
        booking_date:  toDateStr(selDate),
        time_slot:     selSlot,
        captcha_token: token,
      })
      setStep(3)
    } catch(err) {
      setError(extractError(err, 'Error al crear la reserva. Inténtalo de nuevo.'))
      if (window.hcaptcha) window.hcaptcha.reset()
      setToken('')
    } finally {
      setSubmitting(false)
    }
  }

  /* Build calendar grid */
  const yr = month.getFullYear()
  const mo = month.getMonth()
  const firstPad = new Date(yr, mo, 1).getDay()
  const daysInMo = new Date(yr, mo+1, 0).getDate()
  const cells = []
  for (let i=0; i<firstPad; i++) cells.push(null)
  for (let d=1; d<=daysInMo; d++) cells.push(new Date(yr, mo, d))

  function dayClass(d) {
    if (!d) return 'cal-day cal-day--empty'
    const ds = toDateStr(d)
    const isSelected = selDate && toDateStr(selDate) === ds
    let cls = 'cal-day'
    if (isSelected) return cls + ' cal-day--selected'
    if (isSun(d))   return cls + ' cal-day--sunday'
    if (isToday(d)) return cls + ' cal-day--past'
    const dot = dotCache[ds]
    if (!dot || dot.error) return cls + ' cal-day--loading'
    if (dot.full)   return cls + ' cal-day--full'
    return cls + ' cal-day--available'
  }

  function dayDot(d) {
    if (!d) return null
    if (isSun(d)) return <span className="cal-day__closed">cerrado</span>
    if (isToday(d)) return null
    const dot = dotCache[toDateStr(d)]
    if (!dot || dot.error) return <span className="cal-day__dot dot-loading" />
    if (dot.full) return <span className="cal-day__avail" style={{color:'#c0392b'}}>lleno</span>
    if (dot.avail !== null) return <span className="cal-day__avail">{dot.avail} libre{dot.avail !== 1 ? 's' : ''}</span>
    return null
  }

  /* ── STEP 3: Success ── */
  if (step === 3) return (
    <div className="booking-page">
      <div className="booking-hero container">
        <div className="section-tag">WEC Taller Automotriz · Arequipa</div>
        <h1 className="section-title">AGENDA TU<br /><span style={{color:'var(--accent)'}}>CITA</span></h1>
      </div>
      <div className="container">
        <div className="booking-success">
          <CheckCircle size={64} color="#1a8a3a" />
          <h2>¡Reserva Confirmada!</h2>
          <p>Tu cita ha sido registrada exitosamente.</p>
          <div className="booking-success__details">
            <div><Calendar size={15}/> {selDate?.toLocaleDateString('es-PE',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</div>
            <div><Clock size={15}/>    {selSlot} hrs</div>
            <div><User size={15}/>     {form.name}</div>
            <div><Phone size={15}/>    {form.phone}</div>
          </div>
          <p className="booking-success__note">
            Te contactaremos al <strong>{form.phone}</strong> para confirmar.
            Cualquier duda: <a href="tel:959868604">959 868 604</a>.
          </p>
          {form.email && <p className="booking-success__note" style={{marginTop:'0.5rem'}}>
            📧 También te enviamos confirmación a <strong>{form.email}</strong>
          </p>}
          <button
            className="btn-primary"
            style={{clipPath:'none',borderRadius:'4px',background:'var(--black)',color:'white',marginTop:'1rem',display:'inline-flex',alignItems:'center',gap:'0.5rem'}}
            onClick={() => { setStep(1); setSelDate(null); setSelSlot(null); setToken(''); setForm({name:'',phone:'',email:'',service:'',notes:''}) }}>
            Hacer otra reserva
          </button>
        </div>
      </div>
    </div>
  )

  /* ── STEP 1+2: Calendar + Form ── */
  return (
    <div className="booking-page">
      <div className="booking-hero container">
        <div className="section-tag">Reservas en línea · Sin registro · Menos de 5 min</div>
        <h1 className="section-title">AGENDA TU<br /><span style={{color:'var(--accent)'}}>CITA</span></h1>
        <p>Domingos cerrado · Sábados solo mañana (9am)</p>
      </div>

      <div className="booking-layout container">

        {/* Step indicators */}
        <div className="booking-steps">
          <div className={`booking-step ${step >= 1 ? 'active' : ''}`}><span>1</span> Fecha y hora</div>
          <div className="booking-step__line"/>
          <div className={`booking-step ${step >= 2 ? 'active' : ''}`}><span>2</span> Tus datos</div>
        </div>

        <div className="booking-main">

          {/* ── Calendar ── */}
          <div className="booking-calendar">
            <div className="cal-nav">
              <button onClick={() => setMonth(new Date(yr, mo-1, 1))}><ChevronLeft size={18}/></button>
              <span>{MONTH_NAMES[mo]} {yr}</span>
              <button onClick={() => setMonth(new Date(yr, mo+1, 1))}><ChevronRight size={18}/></button>
            </div>

            <div className="cal-legend">
              <span><span className="legend-dot" style={{background:'#1a8a3a'}}/>Disponible</span>
              <span><span className="legend-dot" style={{background:'#c0392b'}}/>Completo</span>
              <span><span className="legend-dot" style={{background:'#aab8d4'}}/>Cerrado</span>
            </div>

            <div className="cal-grid">
              {DAY_NAMES.map(n => <div key={n} className="cal-dayname">{n}</div>)}
              {cells.map((d, i) => (
                <button
                  key={i}
                  className={dayClass(d)}
                  onClick={() => d && pickDay(d)}
                  disabled={!d || isSun(d) || isToday(d) || (dotCache[d && toDateStr(d)]?.full === true)}
                >
                  {d && <>
                    <span className="cal-day__num">{d.getDate()}</span>
                    {dayDot(d)}
                  </>}
                </button>
              ))}
            </div>

            {/* Time slots */}
            {selDate && (
              <div className="booking-slots">
                <h4>
                  <Clock size={15}/>
                  {selDate.toLocaleDateString('es-PE',{weekday:'long',day:'numeric',month:'long'})}
                </h4>
                {loadAvail && <div className="booking-slots__loading">Cargando horarios…</div>}
                {!loadAvail && avail && (
                  <>
                    <div className="booking-slots__info">
                      {avail.is_full
                        ? <span className="full">🔴 Sin cupos disponibles</span>
                        : <span className="available">🟢 {avail.available_slots} cupo{avail.available_slots!==1?'s':''} libre{avail.available_slots!==1?'s':''}</span>
                      }
                      {isSat(selDate) && <span className="saturday-note"> · Solo turno mañana</span>}
                    </div>
                    <div className="booking-slots__grid">
                      {avail.time_slots.map(slot => (
                        <button
                          key={slot.time}
                          className={`slot-btn ${slot.booked?'slot-btn--taken':''} ${selSlot===slot.time?'slot-btn--selected':''}`}
                          onClick={() => { if(!slot.booked){ setSelSlot(slot.time); setStep(2) } }}
                          disabled={slot.booked}
                        >
                          <Clock size={14}/> {slot.time} hrs
                          <span className={`slot-btn__badge ${slot.booked?'':'slot-btn__badge--free'}`}>
                            {slot.booked ? 'Ocupado' : 'Libre'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
                {!loadAvail && !avail && <div className="booking-slots__loading">Error cargando horarios.</div>}
              </div>
            )}
          </div>

          {/* ── Form (step 2) ── */}
          {step === 2 && selDate && selSlot && (
            <div className="booking-form">
              <div className="booking-form__header">
                <button className="booking-form__back" onClick={() => setStep(1)}>
                  <ChevronLeft size={15}/> Cambiar fecha
                </button>
                <div className="booking-form__summary">
                  <Calendar size={13}/> {selDate.toLocaleDateString('es-PE',{day:'numeric',month:'long'})}
                  &nbsp;·&nbsp;<Clock size={13}/> {selSlot} hrs
                </div>
              </div>

              <h3>Tus datos de contacto</h3>

              {error && (
                <div className="booking-error">
                  <AlertCircle size={15}/> {error}
                </div>
              )}

              <form onSubmit={submit}>
                <div className="form-group">
                  <label><User size={13}/> Nombre completo *</label>
                  <input type="text" placeholder="Juan Pérez"
                    value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/>
                </div>

                {/* Preferred contact */}
                <div className="form-group">
                  <label>¿Cómo prefieres que te contactemos? *</label>
                  <div className="verify-contact-options">
                    {[['phone','📱 WhatsApp / Teléfono'],['email','📧 Correo electrónico'],['both','Ambos']].map(([v,l])=>(
                      <label key={v} className={`verify-contact-option ${prefContact===v?'active':''}`}>
                        <input type="radio" name="prefContact" value={v} checked={prefContact===v}
                          onChange={()=>{ setPrefContact(v); setPhoneVerified(false); setEmailVerified(false); setPhoneCodeSent(false); setEmailCodeSent(false); setPhoneCode(''); setEmailCode(''); setVerifyError('') }}/>
                        {l}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Phone field + verification */}
                {(prefContact === 'phone' || prefContact === 'both') && (
                  <div className="form-group">
                    <label><Phone size={13}/> Teléfono / WhatsApp *</label>
                    <div className="verify-input-row">
                      <input type="tel" placeholder="987 654 321"
                        value={form.phone} onChange={e=>{ setForm({...form,phone:e.target.value}); setPhoneVerified(false); setPhoneCodeSent(false); setPhoneCode('') }}
                        disabled={phoneVerified}/>
                      {phoneVerified
                        ? <span className="verify-badge verify-badge--ok"><CheckCircle size={13}/> Verificado</span>
                        : <button type="button" className="verify-send-btn" disabled={sendingPhone} onClick={()=>handleSendCode('phone')}>
                            {sendingPhone ? 'Enviando…' : phoneCodeSent ? 'Reenviar' : 'Enviar código'}
                          </button>
                      }
                    </div>
                    <span className="form-hint">📱 Recibirás un mensaje de WhatsApp con un código</span>
                    {phoneCodeSent && !phoneVerified && (
                      <div className="verify-code-row">
                        <input type="text" inputMode="numeric" maxLength={6} placeholder="Código de 6 dígitos"
                          value={phoneCode} onChange={e=>setPhoneCode(e.target.value.replace(/\D/,''))}/>
                        <button type="button" className="verify-confirm-btn" onClick={()=>handleConfirmCode('phone')}>
                          Confirmar
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Email field + verification */}
                {(prefContact === 'email' || prefContact === 'both') && (
                  <div className="form-group">
                    <label><Mail size={13}/> Correo electrónico *</label>
                    <div className="verify-input-row">
                      <input type="email" placeholder="correo@ejemplo.com"
                        value={form.email} onChange={e=>{ setForm({...form,email:e.target.value}); setEmailVerified(false); setEmailCodeSent(false); setEmailCode('') }}
                        disabled={emailVerified}/>
                      {emailVerified
                        ? <span className="verify-badge verify-badge--ok"><CheckCircle size={13}/> Verificado</span>
                        : <button type="button" className="verify-send-btn" disabled={sendingEmail} onClick={()=>handleSendCode('email')}>
                            {sendingEmail ? 'Enviando…' : emailCodeSent ? 'Reenviar' : 'Enviar código'}
                          </button>
                      }
                    </div>
                    <span className="form-hint">📧 Te enviaremos un código al correo para verificarlo</span>
                    {emailCodeSent && !emailVerified && (
                      <div className="verify-code-row">
                        <input type="text" inputMode="numeric" maxLength={6} placeholder="Código de 6 dígitos"
                          value={emailCode} onChange={e=>setEmailCode(e.target.value.replace(/\D/,''))}/>
                        <button type="button" className="verify-confirm-btn" onClick={()=>handleConfirmCode('email')}>
                          Confirmar
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Phone optional when email-only */}
                {prefContact === 'email' && (
                  <div className="form-group">
                    <label><Phone size={13}/> Teléfono (opcional)</label>
                    <input type="tel" placeholder="987 654 321"
                      value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/>
                  </div>
                )}

                {verifyError && (
                  <div className="booking-error"><AlertCircle size={13}/> {verifyError}</div>
                )}

                <div className="form-group">
                  <label>Servicio *</label>
                  <select value={form.service} onChange={e=>setForm({...form,service:e.target.value})} required>
                    <option value="">— Selecciona un servicio —</option>
                    {SERVICES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label><FileText size={13}/> Notas (opcional)</label>
                  <textarea rows={3} placeholder="Modelo del auto, descripción del problema…"
                    value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/>
                </div>

                <div className="form-group">
                  <label>Verificación de seguridad *</label>
                  <Captcha onToken={setToken}/>
                </div>

                <button
                  type="submit"
                  className="booking-submit"
                  disabled={submitting || !token || !isVerified()}
                >
                  {submitting ? 'Enviando…' : '✅ Confirmar Reserva'}
                </button>
                {!isVerified() && (
                  <p className="form-hint" style={{textAlign:'center',marginTop:'0.5rem'}}>
                    ⚠️ Verifica tu {prefContact==='both'?'teléfono y correo':prefContact==='phone'?'teléfono':'correo'} para continuar
                  </p>
                )}
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

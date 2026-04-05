import React from 'react'
import { Link } from 'react-router-dom'
import { Wrench, Shield, Clock, Star, ChevronRight, Phone, MessageCircle, Mail, Camera, CheckCircle, Calendar, FileText } from 'lucide-react'
import './Home.css'

const IMAGES = {
  suspension: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600&q=80',
  brakes:     'https://images.unsplash.com/photo-1580274455191-1c62238fa333?w=600&q=80',
  alignment:  'https://images.unsplash.com/photo-1558980664-1db506751c6c?w=600&q=80',
  oil:        'https://images.unsplash.com/photo-1635784063388-1ff0f8b23a0c?w=600&q=80',
  hero:       'https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=1400&q=80',
  parts:      'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=700&q=80',
}

const SERVICES_PREVIEW = [
  { icon:'🔩', title:'Suspensión & Dirección', desc:'Amortiguadores, resortes, cremallera mecánica e hidráulica.', link:'/suspension', img:IMAGES.suspension },
  { icon:'🛑', title:'Frenos',                 desc:'Pastillas, discos y líquido de frenos. Seguridad garantizada.', link:'/servicios', img:IMAGES.brakes },
  { icon:'🎯', title:'Alineación y Balanceo',  desc:'Ajuste preciso para manejo óptimo y neumáticos duraderos.', link:'/servicios', img:IMAGES.alignment },
  { icon:'🔋', title:'Aceite y Filtros',       desc:'Cambio con aceites de alta calidad para proteger tu motor.', link:'/servicios', img:IMAGES.oil },
]

const REASONS = [
  { icon:<Shield size={20}/>, label:'Calidad garantizada' },
  { icon:<Clock size={20}/>,  label:'Atención rápida' },
  { icon:<Star size={20}/>,   label:'Técnicos certificados' },
  { icon:<Wrench size={20}/>, label:'Equipos modernos' },
]

const HOW_IT_WORKS = [
  { step:'01', icon:<Calendar size={28}/>, title:'Reserva en línea', desc:'Elige tu fecha y horario disponible. Solo toma 2 minutos.' },
  { step:'02', icon:<Phone size={28}/>,    title:'Te contactamos', desc:'Nuestro equipo te llama o escribe para confirmar y coordinar detalles.' },
  { step:'03', icon:<Wrench size={28}/>,   title:'Reparamos tu auto', desc:'Nuestros técnicos trabajan con cuidado y repuestos de calidad.' },
  { step:'04', icon:<MessageCircle size={28}/>, title:'Te enviamos updates', desc:'Recibes fotos y actualizaciones por email o teléfono durante todo el proceso.' },
]

export default function Home() {
  return (
    <div className="home">

      {/* ── HERO ── */}
      <section className="hero">
        <div className="hero__bg">
          <img src={IMAGES.hero} alt="Taller mecánico WEC Taller Automotriz Arequipa" className="hero__img-bg" />
          <div className="hero__grid" />
          <div className="hero__glow" />
        </div>
        <div className="hero__content container">
          <div className="hero__left">
            <div className="section-tag animate-in" style={{animationDelay:'0.1s'}}>Arequipa, Perú · Mecánica Automotriz</div>
            <h1 className="hero__title animate-in" style={{animationDelay:'0.2s'}}>
              EXPERTOS EN<br />
              <span className="hero__title-accent">SUSPENSIÓN</span><br />
              Y DIRECCIÓN
            </h1>
            <p className="hero__desc animate-in" style={{animationDelay:'0.3s'}}>
              Reparación profesional de amortiguadores, cremallera mecánica e hidráulica y todos los sistemas de suspensión. Tu seguridad es nuestra prioridad.
            </p>

            {/* Booking steps teaser */}
            <div className="hero__booking-steps animate-in" style={{animationDelay:'0.35s'}}>
              <div className="hero__booking-step"><span>1</span> Completa el formulario</div>
              <div className="hero__booking-arrow">→</div>
              <div className="hero__booking-step"><span>2</span> Te contactamos</div>
              <div className="hero__booking-badge">¡Menos de 5 min!</div>
            </div>

            <div className="hero__actions animate-in" style={{animationDelay:'0.4s'}}>
              <Link to="/reservar" className="btn-primary" style={{background:'var(--accent)',color:'var(--black)',clipPath:'none',borderRadius:'4px'}}>
                Reservar Cita <ChevronRight size={16}/>
              </Link>
              <a href="tel:959868604" className="btn-outline" style={{color:'white',borderColor:'rgba(255,255,255,0.5)'}}>
                <Phone size={16}/> 959 868 604
              </a>
            </div>
            <div className="hero__reasons">
              {REASONS.map(r=>(
                <div key={r.label} className="hero__reason">{r.icon}<span>{r.label}</span></div>
              ))}
            </div>
          </div>
          <div className="hero__right">
            <div className="hero__badge">
              <div className="hero__badge-number">25+</div>
              <div className="hero__badge-text">Años de<br/>experiencia</div>
            </div>
            <div className="hero__visual">
              <div className="hero__visual-gear">⚙️</div>
            </div>
          </div>
        </div>
      </section>

      <div className="stripe-divider"/>

      {/* ── HOW IT WORKS ── */}
      <section className="how-it-works">
        <div className="container">
          <div className="how-it-works__header">
            <div className="section-tag" style={{color:'var(--accent)'}}>Simple y rápido</div>
            <h2 className="section-title" style={{color:'white'}}>RESERVA EN<br />MENOS DE 5 MIN</h2>
            <p style={{color:'rgba(255,255,255,0.6)',marginTop:'0.75rem',fontSize:'0.95rem'}}>
              Sin complicaciones. Sin registro. Te contactamos nosotros.
            </p>
          </div>
          <div className="how-it-works__grid">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={i} className="how-step">
                <div className="how-step__num">{step.step}</div>
                <div className="how-step__icon">{step.icon}</div>
                <h3 className="how-step__title">{step.title}</h3>
                <p className="how-step__desc">{step.desc}</p>
                {i < HOW_IT_WORKS.length - 1 && <div className="how-step__arrow">→</div>}
              </div>
            ))}
          </div>
          <div className="how-it-works__cta">
            <Link to="/reservar" className="btn-primary" style={{background:'var(--accent)',color:'var(--black)',clipPath:'none',borderRadius:'4px',padding:'1rem 2.5rem',fontSize:'1.05rem'}}>
              Hacer mi reserva ahora <ChevronRight size={18}/>
            </Link>
          </div>
        </div>
      </section>

      {/* ── UPDATES NOTIFICATION BANNER ── */}
      <section className="updates-banner">
        <div className="container">
          <div className="updates-banner__inner">
            <div className="updates-banner__text">
              <h3>📲 Te mantenemos informado en todo momento</h3>
              <p>Durante la reparación de tu vehículo recibirás actualizaciones por <strong>teléfono y email</strong> con fotos del progreso, repuestos necesarios y estado de tu auto.</p>
            </div>
            <div className="updates-banner__channels">
              <div className="updates-channel"><Phone size={20}/><span>Llamada o WhatsApp</span></div>
              <div className="updates-channel"><Mail size={20}/><span>Email con fotos</span></div>
              <div className="updates-channel"><Camera size={20}/><span>Fotos del progreso</span></div>
            </div>
          </div>
        </div>
      </section>

      <div className="stripe-divider"/>

      {/* ── SERVICES ── */}
      <section className="home-services container">
        <div className="home-services__header">
          <div className="section-tag">Lo que hacemos</div>
          <h2 className="section-title" style={{color:'var(--black)'}}>NUESTROS<br />SERVICIOS</h2>
          <p className="home-services__sub">Soluciones completas para tu vehículo en Arequipa</p>
        </div>
        <div className="home-services__grid">
          {SERVICES_PREVIEW.map((s,i)=>(
            <Link to={s.link} key={i} className="service-card" style={{animationDelay:`${i*0.1}s`}}>
              <div className="service-card__img-wrap">
                <img src={s.img} alt={s.title} className="service-card__img" loading="lazy" onError={e=>{e.target.onerror=null;e.target.style.cssText="background:linear-gradient(135deg,#073590,#1a4fa0);width:100%;height:200px;display:block";e.target.src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}}/>
                <div className="service-card__img-overlay"/>
                <span className="service-card__emoji">{s.icon}</span>
              </div>
              <div className="service-card__body">
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                <div className="service-card__arrow"><ChevronRight size={16}/></div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── PARTS / 25 YEARS ── */}
      <section className="home-parts">
        <div className="home-parts__inner container">
          <div className="home-parts__text">
            <div className="section-tag">Repuestos & calidad</div>
            <h2 className="section-title">MÁS DE 25 AÑOS<br /><span style={{color:'var(--accent)'}}>DE CONFIANZA</span></h2>
            <p>Trabajamos con repuestos originales y de primera calidad. Nuestro equipo tiene más de 25 años de experiencia reparando vehículos en Arequipa.</p>
            <div className="home-parts__features">
              {['Repuestos originales','Garantía en trabajos','Diagnóstico computarizado','Presupuesto sin costo'].map(f=>(
                <div key={f} className="home-parts__feature"><CheckCircle size={16}/><span>{f}</span></div>
              ))}
            </div>
            <Link to="/servicios" className="btn-primary" style={{marginTop:'1.5rem',background:'var(--accent)',color:'var(--black)',clipPath:'none',borderRadius:'4px',display:'inline-flex'}}>
              Ver todos los servicios <ChevronRight size={16}/>
            </Link>
          </div>
          <div className="home-parts__img-wrap">
            <img src={IMAGES.parts} alt="Repuestos de autos Arequipa" className="home-parts__img" loading="lazy" onError={e=>{e.target.onerror=null;e.target.style.background="linear-gradient(135deg,#073590,#1a4fa0)";e.target.src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"}}/>
            <div className="home-parts__img-badge">
              <div style={{fontSize:'1.5rem'}}>⚙️</div>
              <div style={{fontFamily:'var(--font-display)',fontSize:'1.2rem',color:'var(--accent)'}}>AREQUIPA</div>
              <div style={{fontSize:'0.65rem',letterSpacing:'0.2em',opacity:0.7}}>PERÚ</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA BOOKING ── */}
      <section className="home-cta">
        <div className="home-cta__inner container">
          <div>
            <div className="section-tag">Reservas en línea</div>
            <h2 className="section-title">AGENDA TU<br />CITA HOY</h2>
            <p>Sin esperas · Sin registro · En menos de 5 minutos</p>
            <div className="home-cta__steps">
              <div className="home-cta__step"><FileText size={16}/> Llena el formulario</div>
              <span>→</span>
              <div className="home-cta__step"><Phone size={16}/> Te llamamos</div>
            </div>
          </div>
          <div className="home-cta__actions">
            <Link to="/reservar" className="btn-primary" style={{background:'var(--accent)',color:'var(--black)',clipPath:'none',borderRadius:'4px'}}>
              Reservar en menos de 5 min <ChevronRight size={16}/>
            </Link>
            <div className="home-cta__info"><Clock size={16}/><span>Horarios: 9am, 2pm y 3pm</span></div>
          </div>
        </div>
      </section>
    </div>
  )
}

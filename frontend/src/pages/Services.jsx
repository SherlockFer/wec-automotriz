import React from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, CheckCircle } from 'lucide-react'
import './Services.css'

const UNSPLASH = {
  preventive: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600&q=80',
  brakes:     'https://images.unsplash.com/photo-1580274455191-1c62238fa333?w=600&q=80',
  alignment:  'https://images.unsplash.com/photo-1558980664-1db506751c6c?w=600&q=80',
  oil:        'https://images.unsplash.com/photo-1635784063388-1ff0f8b23a0c?w=600&q=80',
  suspension: 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600&q=80',
}

const SERVICES = [
  {
    id:1, emoji:'🛡️', title:'Mantenimiento Preventivo', subtitle:'Cuida tu motor antes de que falle',
    img: UNSPLASH.preventive,
    desc:'Revisiones periódicas para asegurar el correcto funcionamiento de todos los sistemas de tu vehículo. Esto evita futuras averías costosas y prolonga la vida útil de tu motor.',
    items:['Revisión de niveles de fluidos','Inspección de correas y mangueras','Revisión del sistema eléctrico','Chequeo de filtros','Diagnóstico computarizado']
  },
  {
    id:2, emoji:'🛑', title:'Reparación de Frenos en Arequipa', subtitle:'Control total y seguro al conducir',
    img: UNSPLASH.brakes,
    desc:'Servicio especializado en la revisión, reparación y reemplazo de pastillas, discos, y líquidos de frenos. Para que siempre tengas un control total y seguro al conducir.',
    items:['Revisión y cambio de pastillas de freno','Rectificación y cambio de discos','Cambio de líquido de frenos','Revisión del sistema ABS','Ajuste del freno de mano']
  },
  {
    id:3, emoji:'🎯', title:'Alineación y Balanceo', subtitle:'Manejo óptimo y neumáticos durables',
    img: UNSPLASH.alignment,
    desc:'Ajuste preciso de la dirección y ruedas para un manejo óptimo y evitar el desgaste irregular de los neumáticos. Esto mejora la estabilidad del vehículo y reduce el consumo de combustible.',
    items:['Alineación computarizada de 4 ruedas','Balanceo estático y dinámico','Revisión de ángulos de caída y caster','Inspección de neumáticos','Ajuste de convergencia y divergencia']
  },
  {
    id:4, emoji:'🔋', title:'Cambio de Aceite y Filtros', subtitle:'Lubricación óptima para tu motor',
    img: UNSPLASH.oil,
    desc:'Utilización de aceites y filtros de alta calidad para mantener el motor limpio y protegido. Para asegurar una lubricación óptima y prevenir el desgaste prematuro.',
    items:['Aceites sintéticos y semisintéticos','Cambio de filtro de aceite','Cambio de filtro de aire','Cambio de filtro de combustible','Revisión del nivel de todos los fluidos']
  },
  {
    id:5, emoji:'🔩', title:'Reparación de Suspensión', subtitle:'Comodidad y estabilidad de conducción',
    img: UNSPLASH.suspension,
    desc:'Revisión y reparación de amortiguadores, resortes y otros componentes de la suspensión. Esto mejora la comodidad de conducción y la estabilidad del vehículo.',
    items:['Revisión de amortiguadores','Cambio de resortes y espirales','Reparación de cremallera de dirección','Revisión de bujes y rótulas','Diagnóstico completo de suspensión'],
    link:'/suspension', linkText:'Ver detalles de Suspensión'
  },
]

export default function Services() {
  return (
    <div className="services-page">
      <section className="services-hero">
        <div className="services-hero__bg" />
        <div className="container" style={{position:'relative',zIndex:1,padding:'4rem 2rem 3rem'}}>
          <div className="section-tag">WEC Taller Automotriz · Arequipa</div>
          <h1 className="section-title" style={{color:'white'}}>NUESTROS<br /><span style={{color:'var(--accent)'}}>SERVICIOS</span></h1>
          <p className="services-hero__desc">Contamos con técnicos especializados y equipos de última tecnología para brindar el mejor servicio mecánico en Arequipa.</p>
        </div>
      </section>

      <div className="stripe-divider" />

      <section className="services-list container">
        {SERVICES.map((s, i) => (
          <div key={s.id} className={`service-detail ${i%2===1?'service-detail--alt':''}`}>
            <div className="service-detail__text">
              <div className="service-detail__emoji">{s.emoji}</div>
              <div className="section-tag">{s.subtitle}</div>
              <h2 className="service-detail__title">{s.title}</h2>
              <p className="service-detail__desc">{s.desc}</p>
              {s.link
                ? <Link to={s.link} className="btn-primary" style={{marginTop:'1.5rem',display:'inline-flex',background:'var(--black)',color:'white',clipPath:'none',borderRadius:'4px'}}>{s.linkText} <ChevronRight size={16}/></Link>
                : <Link to="/reservar" className="btn-primary" style={{marginTop:'1.5rem',display:'inline-flex',background:'var(--black)',color:'white',clipPath:'none',borderRadius:'4px'}}>Reservar este servicio <ChevronRight size={16}/></Link>
              }
            </div>
            <div className="service-detail__features">
              <div className="service-detail__img-wrap">
                <img src={s.img} alt={s.title} className="service-detail__img" loading="lazy" />
              </div>
              <h4>¿Qué incluye?</h4>
              <ul>
                {s.items.map((item,j)=>(
                  <li key={j}><CheckCircle size={16} color="var(--black)"/><span>{item}</span></li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </section>

      <div className="services-cta container">
        <p>¿Necesitas un diagnóstico? Llámanos o reserva en línea</p>
        <div style={{display:'flex',gap:'1rem',flexWrap:'wrap'}}>
          <a href="tel:959868604" className="btn-primary" style={{background:'var(--accent)',color:'var(--black)',clipPath:'none',borderRadius:'4px'}}><span>📞</span> 959 868 604</a>
          <Link to="/reservar" className="btn-outline" style={{color:'white',borderColor:'rgba(255,255,255,0.4)'}}>Reservar Cita</Link>
        </div>
      </div>
    </div>
  )
}

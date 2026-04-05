import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ChevronDown } from 'lucide-react'
import './Suspension.css'

const IMGS = {
  hero:      'https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=1400&q=80',
  shock:     'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600&q=80',
  steering:  'https://images.unsplash.com/photo-1558980664-1db506751c6c?w=600&q=80',
  mechanic:  'https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?w=1400&q=80',
}

const SUSPENSION_PARTS = [
  { id:'amortiguadores', name:'Amortiguadores', emoji:'🔩', img: IMGS.shock,
    desc:'Los amortiguadores controlan el movimiento de los resortes y absorben los impactos del terreno. Un amortiguador en mal estado afecta directamente el manejo, la estabilidad y el frenado del vehículo.',
    symptoms:['El vehículo rebota excesivamente al pasar baches','Dificultad para mantener el control en curvas','Desgaste irregular de los neumáticos','Ruidos al pasar por baches o irregularidades','El vehículo se inclina demasiado al frenar'],
    solution:'Recomendamos revisar los amortiguadores cada 50,000 km o antes si presenta síntomas.' },
  { id:'resortes', name:'Resortes y Espirales', emoji:'🌀', img: null,
    desc:'Los resortes soportan el peso del vehículo y absorben los impactos junto con los amortiguadores. Cuando se desgastan, la altura del vehículo baja y la comodidad se reduce.',
    symptoms:['El vehículo está más bajo de un lado','Ruidos metálicos al pasar baches','Manejo impreciso y poco estable','Mayor balanceo en curvas','Sensación de dureza excesiva en el manejo'],
    solution:'Los resortes deben revisarse junto con los amortiguadores para garantizar un funcionamiento óptimo del conjunto.' },
  { id:'cremallera-mecanica', name:'Cremallera Mecánica', emoji:'⚙️', img: IMGS.steering,
    desc:'La cremallera de dirección mecánica transmite el movimiento del volante a las ruedas. Es el componente principal que permite girar el vehículo. Con el tiempo puede desgastarse produciendo juego en el volante.',
    symptoms:['Juego o holgura excesiva en el volante','Dirección imprecisa o que "vaga"','Ruidos al girar el volante','El vehículo jala hacia un lado','Dificultad para mantener la dirección recta'],
    solution:'La cremallera mecánica requiere revisión especializada. En muchos casos se puede reparar sin necesidad de cambio completo.' },
  { id:'cremallera-hidraulica', name:'Cremallera Hidráulica', emoji:'💧', img: null,
    desc:'La dirección hidráulica asistida usa presión de fluido para facilitar el giro del volante. La cremallera hidráulica incluye componentes adicionales como la bomba de dirección y las mangueras hidráulicas.',
    symptoms:['Esfuerzo excesivo para girar el volante','Ruido de zumbido al girar (bomba de dirección)','Fugas de fluido de dirección hidráulica','Volante duro especialmente a baja velocidad','Pérdida de nivel de fluido de dirección'],
    solution:'La reparación de cremallera hidráulica incluye revisión de bomba, mangueras y cilindros. Mantenemos stock de repuestos para las marcas más comunes.' },
  { id:'rotulas', name:'Rótulas y Bujes', emoji:'🔗', img: null,
    desc:'Las rótulas permiten que la suspensión se mueva en múltiples direcciones. Los bujes absorben vibraciones entre los componentes metálicos. Su desgaste afecta directamente la alineación y el manejo.',
    symptoms:['Ruidos al pasar baches (tipo "clonc")','Vibración en el volante a ciertas velocidades','Desgaste irregular de neumáticos','El vehículo tiende a jalarse al acelerar','Ruido al girar en espacios reducidos'],
    solution:'Las rótulas deben revisarse en cada servicio de alineación. Su desgaste avanzado puede ser peligroso.' },
  { id:'brazos-suspension', name:'Brazos de Suspensión', emoji:'🦾', img: null,
    desc:'Los brazos de suspensión (horquillas, tirantes) conectan la carrocería con las ruedas y permiten el movimiento vertical de la suspensión manteniendo la geometría del vehículo.',
    symptoms:['Ruidos al frenar o acelerar','Movimiento anormal de las ruedas','Vibración al conducir en autopista','Desviación de la dirección al frenar','Imposibilidad de mantener la alineación'],
    solution:'Los brazos de suspensión deben inspeccionarse si el vehículo ha tenido impactos fuertes o golpes en las ruedas.' },
]

const FAQ = [
  { q:'¿Cada cuánto debo revisar la suspensión?', a:'Recomendamos una revisión completa cada 30,000 km o una vez al año. En Arequipa, con sus carreteras características, puede ser necesario revisarla con más frecuencia.' },
  { q:'¿Puedo seguir manejando con la suspensión dañada?', a:'No es recomendable. Una suspensión en mal estado afecta directamente el frenado, la estabilidad y puede ser peligroso. Agenda una revisión lo antes posible.' },
  { q:'¿Cuánto tiempo tarda una reparación de suspensión?', a:'Depende del componente. Un cambio de amortiguadores puede tomar 2-3 horas. Una reparación de cremallera puede tomar un día completo. Te informaremos el tiempo exacto en el diagnóstico.' },
  { q:'¿Usan repuestos originales o genéricos?', a:'Trabajamos con repuestos originales y alternativos de primera calidad. Siempre te consultamos antes para que tú decidas según tu presupuesto.' },
]

export default function Suspension() {
  const [openFaq, setOpenFaq]     = useState(null)
  const [activePart, setActivePart] = useState(null)

  return (
    <div className="susp-page">
      {/* Hero with background image */}
      <section className="susp-hero">
        <div className="susp-hero__bg" />
        <img src={IMGS.hero} alt="Suspensión automotriz" className="susp-hero__img" />
        <div className="susp-hero__content container">
          <div className="section-tag">Especialistas en suspensión · Arequipa</div>
          <h1 className="section-title">
            SUSPENSIÓN<br /><span style={{color:'var(--accent)'}}>& DIRECCIÓN</span>
          </h1>
          <p className="susp-hero__desc">
            Diagnóstico y reparación completa de todos los sistemas de suspensión y dirección. Cremallera mecánica, hidráulica, amortiguadores, resortes, rótulas y más.
          </p>
          <div style={{display:'flex',gap:'1rem',flexWrap:'wrap',marginTop:'2rem'}}>
            <Link to="/reservar" className="btn-primary" style={{background:'var(--accent)',color:'var(--black)',clipPath:'none',borderRadius:'4px'}}>
              Diagnóstico gratuito <ChevronRight size={16}/>
            </Link>
            <a href="tel:959868604" className="btn-outline" style={{color:'white',borderColor:'rgba(255,255,255,0.45)'}}>📞 959 868 604</a>
          </div>
        </div>
      </section>

      <div className="stripe-divider" />

      {/* Parts grid */}
      <section className="susp-parts container">
        <div className="section-tag" style={{color:'var(--black)'}}>Componentes que reparamos</div>
        <h2 className="section-title" style={{color:'var(--black)'}}>TODOS LOS<br />COMPONENTES</h2>
        <p className="susp-parts__intro">Haz clic en cada componente para ver síntomas y solución.</p>

        <div className="susp-grid">
          {SUSPENSION_PARTS.map(part => (
            <div key={part.id} className="susp-card">
              <button className={`susp-card__header ${activePart===part.id?'susp-card__header--open':''}`}
                onClick={()=>setActivePart(activePart===part.id?null:part.id)}>
                <span className="susp-card__emoji">{part.emoji}</span>
                <span className="susp-card__name">{part.name}</span>
                <ChevronDown size={18} className={`susp-card__chevron ${activePart===part.id?'susp-card__chevron--open':''}`}/>
              </button>
              {activePart===part.id && (
                <div className="susp-card__body">
                  {part.img && <div className="susp-card__img-wrap"><img src={part.img} alt={part.name} className="susp-card__img" loading="lazy"/></div>}
                  <p className="susp-card__desc">{part.desc}</p>
                  <div className="susp-card__symptoms">
                    <h5>⚠️ Síntomas de falla</h5>
                    <ul>{part.symptoms.map((s,i)=><li key={i}>{s}</li>)}</ul>
                  </div>
                  <div className="susp-card__solution"><span>✅ </span>{part.solution}</div>
                  <Link to="/reservar" className="btn-primary" style={{marginTop:'1rem',display:'inline-flex',fontSize:'0.85rem',padding:'0.6rem 1.25rem',background:'var(--black)',color:'white',clipPath:'none',borderRadius:'4px'}}>
                    Revisar este componente <ChevronRight size={14}/>
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Cremallera highlight */}
      <section className="cremallera-section">
        <div className="cremallera-section__inner container">
          <div className="cremallera-section__text">
            <div className="section-tag">Especialidad principal</div>
            <h2 className="section-title">CREMALLERA<br />MECÁNICA E<br /><span style={{color:'var(--accent)'}}>HIDRÁULICA</span></h2>
            <p>Somos expertos en la reparación y reconstrucción de cremalleras de dirección tanto mecánicas como hidráulicas. Más de 25 años de experiencia nos respaldan.</p>
            <div style={{marginTop:'2rem',display:'flex',gap:'2rem',flexWrap:'wrap'}}>
              <div className="cremallera-stat"><div className="cremallera-stat__num">25+</div><div className="cremallera-stat__label">Años de experiencia</div></div>
              <div className="cremallera-stat"><div className="cremallera-stat__num">500+</div><div className="cremallera-stat__label">Cremalleras reparadas</div></div>
            </div>
          </div>
          <div className="cremallera-section__types">
            <div className="cremallera-section__mechanic-img">
              <img src={IMGS.mechanic} alt="Mecánico trabajando" loading="lazy"/>
            </div>
            {[['⚙️','Cremallera Mecánica','Dirección directa sin asistencia. Reparamos el piñón, la cremallera, los topes y las juntas.'],
              ['💧','Cremallera Hidráulica','Con asistencia de bomba hidráulica. Incluye revisión de bomba, mangueras y fluido.'],
              ['⚡','Dirección Eléctrica (EPS)','Diagnóstico y reparación de sistemas de dirección asistida eléctrica modernos.']
            ].map(([icon,title,desc])=>(
              <div key={title} className="cremallera-type">
                <div className="cremallera-type__icon">{icon}</div>
                <div><h4>{title}</h4><p>{desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="susp-faq container">
        <div className="section-tag" style={{color:'var(--black)'}}>Preguntas frecuentes</div>
        <h2 className="section-title" style={{color:'var(--black)'}}>FAQ</h2>
        <div className="susp-faq__list">
          {FAQ.map((f,i)=>(
            <div key={i} className="faq-item">
              <button className="faq-item__q" onClick={()=>setOpenFaq(openFaq===i?null:i)}>
                <span>{f.q}</span>
                <ChevronDown size={18} className={openFaq===i?'open':''}/>
              </button>
              {openFaq===i && <div className="faq-item__a">{f.a}</div>}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

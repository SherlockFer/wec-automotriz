import React from 'react'
import { Link } from 'react-router-dom'
import { Phone, MapPin, Clock } from 'lucide-react'
import './Footer.css'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="stripe-divider" />
      <div className="footer__inner container">
        <div className="footer__brand">
          <div className="footer__logo">
            <img src="/logo.png" alt="WEC Taller Automotriz" style={{height:'52px',width:'auto',objectFit:'contain'}}
              onError={e=>{e.target.style.display='none'}}/>
            <div>
              <span className="footer__name">WEC TALLER AUTOMOTRIZ</span>
              <span className="footer__tagline">Mecánica de Confianza en Arequipa</span>
            </div>
          </div>
          <p className="footer__desc">
            Especialistas en suspensión, dirección, frenos y mantenimiento general. Más de años de experiencia en Arequipa.
          </p>
        </div>

        <div className="footer__col">
          <h4>Servicios</h4>
          <ul>
            <li><Link to="/suspension">Suspensión & Dirección</Link></li>
            <li><Link to="/servicios">Frenos</Link></li>
            <li><Link to="/servicios">Mantenimiento Preventivo</Link></li>
            <li><Link to="/servicios">Alineación y Balanceo</Link></li>
            <li><Link to="/servicios">Cambio de Aceite</Link></li>
          </ul>
        </div>

        <div className="footer__col">
          <h4>Contacto</h4>
          <ul>
            <li><Phone size={14} /> <a href="tel:959868604">959 868 604</a></li>
            <li><MapPin size={14} /> Av. Alcides Carreón NRO 200, La Pampilla — frente a la iglesia</li>
            <li><Clock size={14} /> Lun–Sáb: 8am – 6pm</li>
          </ul>
        </div>
      </div>
      <div className="footer__bottom container">
        <p>© {new Date().getFullYear()} WEC Taller Automotriz. Todos los derechos reservados.</p>
      </div>
    </footer>
  )
}

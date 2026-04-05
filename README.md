# 🔧 Talleres Bobby — Sistema de Reservas Web

Sitio web completo para **Talleres Bobby**, taller mecánico especializado en Arequipa, Perú.

## Stack

- **Frontend**: React 18 + Vite + React Router
- **Backend**: FastAPI (Python)
- **Base de datos**: PostgreSQL 15
- **Orquestación**: Docker Compose

---

## 🚀 Inicio rápido con Docker

### Prerrequisitos
- Docker Desktop instalado
- Docker Compose

### 1. Clonar / descomprimir el proyecto
```bash
cd talleres-bobby
```

### 2. Levantar todos los servicios
```bash
docker compose up --build
```

### 3. Acceder
| Servicio | URL |
|---|---|
| Frontend (web) | http://localhost:3000 |
| API Backend | http://localhost:8000 |
| Docs API | http://localhost:8000/docs |

---

## 🖥️ Desarrollo local (sin Docker)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configura tu PostgreSQL local
export DATABASE_URL="postgresql://usuario:password@localhost/talleresboby"

uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install

# Asegúrate de que el backend esté corriendo en puerto 8000
npm run dev
```

---

## 📋 Funcionalidades

### Página Principal
- Hero animado con engranaje giratorio
- Preview de servicios
- CTA de reserva

### /servicios
- Todos los servicios con detalles completos:
  - Mantenimiento Preventivo
  - Reparación de Frenos
  - Alineación y Balanceo
  - Cambio de Aceite y Filtros
  - Reparación de Suspensión

### /suspension
- Detalle completo de suspensión y dirección
- Componentes expandibles: amortiguadores, resortes, cremallera mecánica, cremallera hidráulica, rótulas, brazos
- Síntomas de falla por componente
- FAQ

### /reservar
- Calendario interactivo
- 3 slots por defecto: 9:00, 14:00, 15:00
- Muestra disponibilidad en tiempo real
- Formulario sin autenticación
- Confirmación visual al completar

### /admin
- Panel de administración
- Ver todas las reservas agrupadas por día
- Cancelar reservas
- **Configurar capacidad por día** (por defecto 3 cupos)
- Filtrar por estado

---

## 🔌 API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/availability/{date}` | Disponibilidad de un día (YYYY-MM-DD) |
| POST | `/bookings` | Crear reserva |
| GET | `/bookings` | Listar reservas (filtro por fecha opcional) |
| PATCH | `/bookings/{id}/cancel` | Cancelar reserva |
| POST | `/admin/capacity` | Configurar cupos de un día |
| GET | `/admin/bookings/all` | Todas las reservas (admin) |

---

## 📞 Datos del negocio

- **Teléfono**: +51 959 868 604
- **Horarios de atención**: Lunes a Sábado, 8am – 6pm
- **Horarios de reserva**: 9:00am, 2:00pm, 3:00pm
- **Cupos por defecto**: 3 autos por día
- **Ubicación**: Arequipa, Perú

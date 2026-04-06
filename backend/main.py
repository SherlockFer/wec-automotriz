from fastapi import FastAPI, HTTPException, Depends, status, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import date, datetime, timedelta, timezone
import databases, sqlalchemy, os, threading, httpx, smtplib, re, bcrypt, json, random
from sqlalchemy import create_engine, MetaData, Table, Column, Integer, String, Date, DateTime, Boolean, Text
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import jwt

# ── Config ────────────────────────────────────────────────────────────────────
DATABASE_URL     = os.getenv("DATABASE_URL", "postgresql://bobby:bobby123@localhost/talleresboby")
SMTP_HOST        = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT        = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER        = os.getenv("SMTP_USER", "")
SMTP_PASS        = os.getenv("SMTP_PASS", "")
NOTIFY_EMAIL     = os.getenv("NOTIFY_EMAIL", "")
HCAPTCHA_SECRET  = os.getenv("HCAPTCHA_SECRET",  "")
HCAPTCHA_SITEKEY = os.getenv("HCAPTCHA_SITEKEY", "")
JWT_SECRET       = os.getenv("JWT_SECRET", "change-me-in-production")
ADMIN_SECRET     = os.getenv("ADMIN_SECRET", "change-me-in-production")
SITE_URL         = os.getenv("SITE_URL", "http://localhost:3000")
# WhatsApp — uses wa.me links (free, no API key needed) or Twilio (optional)
TWILIO_SID       = os.getenv("TWILIO_SID", "")
TWILIO_TOKEN     = os.getenv("TWILIO_TOKEN", "")
TWILIO_WA_FROM   = os.getenv("TWILIO_WA_FROM", "")   # whatsapp:+14155238886

# ── Peru timezone (UTC-5, no DST) ────────────────────────────────────────────
PERU_TZ = timezone(timedelta(hours=-5))
def now_peru() -> datetime:
    """Current datetime in Peru time (UTC-5), stored as naive datetime matching DB convention."""
    return datetime.now(PERU_TZ).replace(tzinfo=None)

# ── Booking statuses ─────────────────────────────────────────────────────────
# requested → confirmed → received → in_progress → waiting_approval → finished → delivered | cancelled
BOOKING_STATUSES = [
    "requested",         # Cliente creó reserva
    "confirmed",         # Admin confirmó con el cliente
    "received",          # Auto recibido en taller con perfil/fotos
    "in_progress",       # En reparación
    "waiting_approval",  # Esperando aprobación (repuestos extra / trabajos adicionales)
    "finished",          # Trabajo terminado
    "delivered",         # Auto entregado al cliente
    "cancelled",         # Cancelado
]

STATUS_LABELS_ES = {
    "requested":         "Solicitada",
    "confirmed":         "Confirmada",
    "received":          "Recepcionada",
    "in_progress":       "En Progreso",
    "waiting_approval":  "Esperando Aprobación",
    "finished":          "Finalizada",
    "delivered":         "Entregada",
    "cancelled":         "Cancelada",
}

STATUS_EMOJIS = {
    "requested":        "📋",
    "confirmed":        "✅",
    "received":         "🏭",
    "in_progress":      "🔧",
    "waiting_approval": "⏳",
    "finished":         "🎉",
    "delivered":        "🏁",
    "cancelled":        "❌",
}

# ── DB ────────────────────────────────────────────────────────────────────────
database = databases.Database(DATABASE_URL)
metadata = MetaData()

users_table = Table("users", metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String(100), nullable=False),
    Column("email", String(100), nullable=False, unique=True),
    Column("password_hash", String(200), nullable=False),
    Column("role", String(20), nullable=False, default="user"),
    Column("is_active", Boolean, default=True),
    Column("created_at", DateTime, default=now_peru),
)

bookings = Table("bookings", metadata,
    Column("id", Integer, primary_key=True),
    Column("client_name", String(100), nullable=False),
    Column("client_phone", String(20), nullable=False),
    Column("client_email", String(100), nullable=True),
    Column("service", String(100), nullable=False),
    Column("booking_date", Date, nullable=False),
    Column("time_slot", String(10), nullable=False),
    Column("notes", Text, nullable=True),
    Column("created_at", DateTime, default=now_peru),
    Column("status", String(30), default="requested"),
    Column("owner_user_id", Integer, nullable=True),   # linked registered user
    Column("car_id", Integer, nullable=True),           # linked user car
    # Car profile fields
    Column("car_brand",     String(60),  nullable=True),
    Column("car_model",     String(60),  nullable=True),
    Column("car_year",      Integer,     nullable=True),
    Column("car_plate",     String(20),  nullable=True),
    Column("car_color",     String(40),  nullable=True),
    Column("car_km",        Integer,     nullable=True),
    Column("failure_desc",  Text,        nullable=True),
    Column("reception_notes", Text,      nullable=True),
    Column("reception_images", Text,     nullable=True),
    Column("approval_note", Text,        nullable=True),
    Column("approval_comment", Text,     nullable=True),  # how/when client approved
    Column("approved_by_user", Boolean,  default=False),  # True if user approved via portal
)

day_capacity = Table("day_capacity", metadata,
    Column("id", Integer, primary_key=True),
    Column("booking_date", Date, nullable=False, unique=True),
    Column("max_slots", Integer, default=3),
)

car_progress = Table("car_progress", metadata,
    Column("id", Integer, primary_key=True),
    Column("booking_id", Integer, nullable=False),
    Column("title", String(200), nullable=False),
    Column("description", Text, nullable=True),
    Column("status", String(30), default="in_progress"),
    Column("parts_needed", Text, nullable=True),
    Column("image_urls", Text, nullable=True),
    Column("notify_customer", Boolean, default=False),
    Column("created_by", Integer, nullable=True),
    Column("created_at", DateTime, default=now_peru),
    Column("updated_at", DateTime, default=now_peru),
)

# Audit log — tracks all admin actions for the Logs tab
audit_log = Table("audit_log", metadata,
    Column("id", Integer, primary_key=True),
    Column("admin_id",    Integer,     nullable=True),
    Column("admin_name",  String(100), nullable=True),
    Column("action",      String(100), nullable=False),  # e.g. "status_change", "car_profile", "approve"
    Column("entity_type", String(50),  nullable=True),   # "booking", "progress", "user"
    Column("entity_id",   Integer,     nullable=True),
    Column("description", Text,        nullable=False),
    Column("old_value",   Text,        nullable=True),   # JSON snapshot before
    Column("new_value",   Text,        nullable=True),   # JSON snapshot after
    Column("undone",      Boolean,     default=False),
    Column("created_at",  DateTime,    default=now_peru),
)

MAX_GARAGE_CAPACITY = 15  # Maximum cars in garage at any time

# User-owned cars (linked to a registered user account)
user_cars = Table("user_cars", metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id", Integer, nullable=False),
    Column("brand",  String(60),  nullable=False),
    Column("model",  String(60),  nullable=False),
    Column("year",   Integer,     nullable=True),
    Column("plate",  String(20),  nullable=True),
    Column("color",  String(40),  nullable=True),
    Column("km",     Integer,     nullable=True),
    Column("notes",  Text,        nullable=True),
    Column("created_at", DateTime, default=now_peru),
)

# Page analytics events (page views and CTA clicks)
page_events = Table("page_events", metadata,
    Column("id",         Integer, primary_key=True),
    Column("event_type", String(50),  nullable=False),  # "page_view" | "click_reservar" | "click_llamar"
    Column("page",       String(100), nullable=True),   # e.g. "home", "servicios"
    Column("ip",         String(60),  nullable=True),
    Column("user_agent", Text,        nullable=True),
    Column("created_at", DateTime,    default=now_peru),
)

# Messages between users and admin
messages_table = Table("messages", metadata,
    Column("id", Integer, primary_key=True),
    Column("user_id",    Integer, nullable=False),           # sender (user) or target (admin)
    Column("booking_id", Integer, nullable=True),            # optional: related booking
    Column("sender_role",String(20), nullable=False),        # "user" | "admin"
    Column("body",       Text,    nullable=False),
    Column("is_read",    Boolean, default=False),
    Column("created_at", DateTime, default=now_peru),
)

engine = create_engine(DATABASE_URL)
metadata.create_all(engine)

app = FastAPI(title="WEC Taller Automotriz API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
security = HTTPBearer(auto_error=False)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Convert Pydantic v2 validation errors to a simple readable string."""
    errors = exc.errors()
    # Extract the first meaningful error message
    if errors:
        first = errors[0]
        field = first.get("loc", [])[-1] if first.get("loc") else "campo"
        msg   = first.get("msg", "Datos inválidos")
        # Strip "Value error, " prefix that Pydantic v2 adds
        msg = msg.replace("Value error, ", "")
        detail = f"{msg}"
    else:
        detail = "Datos inválidos en la solicitud"
    return JSONResponse(status_code=422, content={"detail": detail})

WEEKDAY_SLOTS   = ["09:00", "14:00", "15:00"]
SATURDAY_SLOTS  = ["09:00"]
DEFAULT_CAPACITY = 3
DAYS_ES   = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"]
MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]

# ── Pydantic Models ───────────────────────────────────────────────────────────
class BookingCreate(BaseModel):
    client_name: str
    client_phone: str
    client_email: Optional[str] = None
    service: str
    booking_date: date
    time_slot: str
    notes: Optional[str] = None
    captcha_token: str

    @field_validator("client_phone")
    @classmethod
    def validate_phone(cls, v):
        cleaned = re.sub(r"[\s\-\(\)\+]", "", v)
        if not re.match(r"^\d{7,15}$", cleaned):
            raise ValueError("Número de teléfono inválido. Debe tener entre 7 y 15 dígitos.")
        return cleaned

class BookingOut(BaseModel):
    id: int
    client_name: str
    client_phone: str
    client_email: Optional[str]
    service: str
    booking_date: date
    time_slot: str
    notes: Optional[str]
    status: str
    created_at: datetime
    car_brand: Optional[str] = None
    car_model: Optional[str] = None
    car_year:  Optional[int] = None
    car_plate: Optional[str] = None
    car_color: Optional[str] = None
    car_km:    Optional[int] = None
    failure_desc:    Optional[str] = None
    reception_notes: Optional[str] = None
    reception_images: Optional[List[str]] = None
    approval_note:   Optional[str] = None
    approval_comment: Optional[str] = None
    approved_by_user: Optional[bool] = False

class BookingStatusUpdate(BaseModel):
    status: str
    approval_note: Optional[str] = None
    approval_comment: Optional[str] = None  # how/when client approved (phone, in person, etc.)

class CarProfileUpdate(BaseModel):
    car_brand: Optional[str] = None
    car_model: Optional[str] = None
    car_year:  Optional[int] = None
    car_plate: Optional[str] = None
    car_color: Optional[str] = None
    car_km:    Optional[int] = None
    failure_desc:    Optional[str] = None
    reception_notes: Optional[str] = None

class DayAvailability(BaseModel):
    booking_date: date
    max_slots: int
    booked_slots: int
    available_slots: int
    time_slots: List[dict]
    is_full: bool

class AdminCapacity(BaseModel):
    booking_date: date
    max_slots: int

class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    role: str = "user"
    admin_secret: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

class TokenOut(BaseModel):
    access_token: str
    token_type: str
    user: UserOut

class ProgressCreate(BaseModel):
    booking_id: int
    title: str
    description: Optional[str] = None
    status: str = "in_progress"
    parts_needed: Optional[List[str]] = None
    notify_customer: bool = False

class ProgressOut(BaseModel):
    id: int
    booking_id: int
    title: str
    description: Optional[str]
    status: str
    parts_needed: Optional[List[str]]
    image_urls: Optional[List[str]]
    notify_customer: bool
    created_at: datetime
    updated_at: datetime

class WhatsAppMsg(BaseModel):
    booking_id: int
    message: str
    phone: Optional[str] = None  # override phone if needed

class AuditLogOut(BaseModel):
    id: int
    admin_id: Optional[int] = None
    admin_name: Optional[str] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    description: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    undone: bool = False
    created_at: datetime

# ── Auth helpers ──────────────────────────────────────────────────────────────
def hash_password(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
def check_password(p, h): return bcrypt.checkpw(p.encode(), h.encode())
def create_token(uid, role):
    return jwt.encode({"sub": str(uid), "role": role, "exp": datetime.utcnow() + timedelta(hours=24)}, JWT_SECRET, algorithm="HS256")
def decode_token(token):
    try: return jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError: raise HTTPException(401, "Token expirado")
    except: raise HTTPException(401, "Token inválido")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials: raise HTTPException(401, "No autenticado")
    payload = decode_token(credentials.credentials)
    user = await database.fetch_one(users_table.select().where(users_table.c.id == int(payload["sub"])))
    if not user or not user["is_active"]: raise HTTPException(401, "Usuario no encontrado")
    return dict(user)

async def require_admin(user=Depends(get_current_user)):
    if user["role"] not in ("admin","superadmin"): raise HTTPException(403, "Se requiere administrador")
    return user

async def require_superadmin(user=Depends(get_current_user)):
    if user["role"] != "superadmin": raise HTTPException(403, "Se requiere superadministrador")
    return user

# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    await database.connect()
    await seed_default_users()

@app.on_event("shutdown")
async def shutdown():
    await database.disconnect()

async def seed_default_users():
    defaults = [
        {"name":"Super Admin","email":"superadmin@wecautomotriz.pe","password":"SuperWec2024!","role":"superadmin"},
        {"name":"Wilmer","email":"wilmer@wecautomotriz.pe","password":"AdminWec2026!","role":"admin"},
        {"name":"Angelica","email":"angelica@wecautomotriz.pe","password":"AdminWec2026!","role":"admin"},
        {"name":"Usuario Demo","email":"user@wecautomotriz.pe","password":"UserWec2024!","role":"user"},
    ]
    for u in defaults:
        ex = await database.fetch_one(users_table.select().where(users_table.c.email == u["email"]))
        if not ex:
            await database.execute(users_table.insert().values(
                name=u["name"], email=u["email"], password_hash=hash_password(u["password"]),
                role=u["role"], is_active=True, created_at=now_peru()
            ))

def get_slots_for_date(d: date):
    w = d.weekday()
    if w == 6: return []
    if w == 5: return SATURDAY_SLOTS
    return WEEKDAY_SLOTS

async def get_day_max(d: date):
    row = await database.fetch_one(day_capacity.select().where(day_capacity.c.booking_date == d))
    return row["max_slots"] if row else DEFAULT_CAPACITY

async def verify_hcaptcha(token: str):
    if token == "dev-bypass-local": return True
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post("https://api.hcaptcha.com/siteverify",
                data={"secret": HCAPTCHA_SECRET, "response": token, "sitekey": HCAPTCHA_SITEKEY}, timeout=10)
        result = r.json()
        if not result.get("success") and os.getenv("DEV_MODE","false").lower() == "true": return True
        return result.get("success", False)
    except: return False

# ── Email & WhatsApp helpers ──────────────────────────────────────────────────
def fmt_date(d):
    try:
        dt = datetime.strptime(str(d), "%Y-%m-%d")
        return f"{DAYS_ES[dt.weekday()]} {dt.day} de {MONTHS_ES[dt.month-1]} de {dt.year}"
    except: return str(d)

def fmt_datetime(dt):
    try: return f"{DAYS_ES[dt.weekday()]} {dt.day} de {MONTHS_ES[dt.month-1]} de {dt.year} a las {dt.strftime('%H:%M')} hrs"
    except: return str(dt)

def email_header():
    return f"""<div style="background:#073590;padding:24px 32px;color:white">
      <h1 style="margin:0;font-size:26px;letter-spacing:2px">🔧 WEC Taller Automotriz</h1>
      <p style="margin:4px 0 0;opacity:0.7;font-size:12px">MECÁNICA ESPECIALIZADA · AREQUIPA, PERÚ</p>
    </div><div style="height:4px;background:#F7C416"></div>"""

def email_footer():
    return f"""<div style="background:#073590;padding:14px 32px;text-align:center">
      <p style="margin:0;color:#F7C416;font-size:13px;font-weight:bold">📞 959 868 604 &nbsp;|&nbsp; 💬 WhatsApp disponible</p>
      <p style="margin:4px 0 0;color:rgba(255,255,255,0.5);font-size:11px">
        Av. Alcides Carreón NRO 200, La Pampilla, Arequipa · <a href="{SITE_URL}" style="color:#F7C416">{SITE_URL}</a></p>
    </div>"""

def send_email(to, subject, html_body):
    if not SMTP_USER or not SMTP_PASS: return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject; msg["From"] = SMTP_USER; msg["To"] = to
        msg.attach(MIMEText(html_body, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as s:
            s.starttls(); s.login(SMTP_USER, SMTP_PASS); s.sendmail(SMTP_USER, to, msg.as_string())
        print(f"✅ Email → {to}")
    except Exception as e: print(f"❌ Email error: {e}")

def wa_link(phone: str, message: str) -> str:
    """Generate a WhatsApp wa.me link (works without API key)."""
    cleaned = re.sub(r"[^\d]", "", phone)
    if len(cleaned) == 9: cleaned = "51" + cleaned  # Peru prefix
    encoded = httpx.URL(params={"text": message}).query.decode()
    return f"https://wa.me/{cleaned}?{encoded}"

def send_whatsapp_twilio(phone: str, message: str):
    """Send WhatsApp via Twilio (optional — only if configured)."""
    if not TWILIO_SID or not TWILIO_TOKEN or not TWILIO_WA_FROM:
        print("⚠️  Twilio not configured — WhatsApp via wa.me link only")
        return False
    try:
        from twilio.rest import Client
        cleaned = re.sub(r"[^\d]", "", phone)
        if len(cleaned) == 9: cleaned = "51" + cleaned
        client = Client(TWILIO_SID, TWILIO_TOKEN)
        client.messages.create(
            body=message,
            from_=TWILIO_WA_FROM,
            to=f"whatsapp:+{cleaned}"
        )
        print(f"✅ WhatsApp sent to {phone}")
        return True
    except Exception as e:
        print(f"❌ WhatsApp error: {e}")
        return False

def build_status_email(booking: dict, new_status: str, extra_note: str = "") -> str:
    emoji = STATUS_EMOJIS.get(new_status, "🔧")
    label = STATUS_LABELS_ES.get(new_status, new_status)
    car_info = ""
    if booking.get("car_brand"):
        car_info = f"{booking['car_brand']} {booking.get('car_model','')} {booking.get('car_year','')}"
    note_html = f'<p style="background:#fff3cd;border-left:4px solid #F7C416;padding:12px 16px;margin:16px 0;color:#073590">{extra_note}</p>' if extra_note else ""

    return f"""<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f5f7ff">
      {email_header()}
      <div style="padding:24px 32px">
        <h2 style="color:#073590;margin:0 0 6px">Actualización de tu reserva</h2>
        <p style="color:#5a6a8a;margin:0 0 20px">Hola <strong>{booking['client_name']}</strong>, tu vehículo tiene una actualización.</p>
        <div style="background:#073590;padding:20px 24px;color:white;margin-bottom:20px;text-align:center">
          <div style="font-size:2.5rem">{emoji}</div>
          <div style="font-size:20px;font-weight:bold;color:#F7C416;margin-top:8px">{label}</div>
        </div>
        <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #dde5f5;margin-bottom:16px">
          <tr><td style="padding:10px 14px;border-bottom:1px solid #eef2fb;color:#073590;font-weight:bold;width:38%">Servicio</td>
              <td style="padding:10px 14px;border-bottom:1px solid #eef2fb">{booking['service']}</td></tr>
          <tr><td style="padding:10px 14px;border-bottom:1px solid #eef2fb;color:#073590;font-weight:bold">Fecha</td>
              <td style="padding:10px 14px;border-bottom:1px solid #eef2fb">{fmt_date(str(booking['booking_date']))} · {booking['time_slot']} hrs</td></tr>
          {'<tr><td style="padding:10px 14px;color:#073590;font-weight:bold">Vehículo</td><td style="padding:10px 14px">' + car_info + '</td></tr>' if car_info else ''}
        </table>
        {note_html}
        <div style="background:#e8f4fd;border-left:4px solid #073590;padding:14px 16px;margin-top:16px">
          <p style="margin:0;color:#073590;font-size:13px">Contacto: <strong>959 868 604</strong> · También disponible por WhatsApp</p>
        </div>
        <div style="text-align:center;margin-top:20px">
          <a href="{SITE_URL}" style="display:inline-block;background:#F7C416;color:#073590;padding:12px 28px;text-decoration:none;font-weight:bold">Visitar WEC Taller Automotriz →</a>
        </div>
      </div>
      {email_footer()}
    </body></html>"""

def notify_booking_status(booking: dict, new_status: str, extra_note: str = "", send_wa: bool = False):
    """Send email + optionally WhatsApp when booking status changes."""
    emoji = STATUS_EMOJIS.get(new_status, "🔧")
    label = STATUS_LABELS_ES.get(new_status, new_status)
    # Email
    if booking.get("client_email"):
        html = build_status_email(booking, new_status, extra_note)
        send_email(booking["client_email"], f"{emoji} Reserva {label} — WEC Taller Automotriz", html)
    # WhatsApp
    if send_wa and booking.get("client_phone"):
        car = f"{booking.get('car_brand','')} {booking.get('car_model','')}".strip()
        msg = f"🔧 *WEC Taller Automotriz*\nHola {booking['client_name']}, tu reserva ha sido actualizada.\n\n*Estado:* {emoji} {label}\n*Servicio:* {booking['service']}"
        if car: msg += f"\n*Vehículo:* {car}"
        if extra_note: msg += f"\n\n📝 {extra_note}"
        msg += f"\n\nConsultas: 959 868 604"
        send_whatsapp_twilio(booking["client_phone"], msg)

def send_admin_notification(b):
    created = b.get("created_at", now_peru())
    if isinstance(created, str): created = datetime.fromisoformat(created)
    html = f"""<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f5f7ff">
      {email_header()}
      <div style="padding:24px 32px">
        <h2 style="color:#073590;margin:0 0 16px">Nueva reserva — {STATUS_EMOJIS.get('requested','📋')} Solicitada</h2>
        <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #dde5f5">
          <tr><td style="padding:10px 14px;border-bottom:1px solid #eef2fb;color:#073590;font-weight:bold;width:38%">Cliente</td><td style="padding:10px 14px;border-bottom:1px solid #eef2fb">{b['client_name']}</td></tr>
          <tr><td style="padding:10px 14px;border-bottom:1px solid #eef2fb;color:#073590;font-weight:bold">Teléfono</td><td style="padding:10px 14px;border-bottom:1px solid #eef2fb">{b['client_phone']}</td></tr>
          <tr><td style="padding:10px 14px;border-bottom:1px solid #eef2fb;color:#073590;font-weight:bold">Email</td><td style="padding:10px 14px;border-bottom:1px solid #eef2fb">{b.get('client_email') or '—'}</td></tr>
          <tr><td style="padding:10px 14px;border-bottom:1px solid #eef2fb;color:#073590;font-weight:bold">Fecha</td><td style="padding:10px 14px;border-bottom:1px solid #eef2fb">{fmt_date(str(b['booking_date']))} · {b['time_slot']} hrs</td></tr>
          <tr><td style="padding:10px 14px;border-bottom:1px solid #eef2fb;color:#073590;font-weight:bold">Servicio</td><td style="padding:10px 14px;border-bottom:1px solid #eef2fb">{b['service']}</td></tr>
          <tr><td style="padding:10px 14px;color:#5a6a8a;font-size:12px">Creado</td><td style="padding:10px 14px;color:#5a6a8a;font-size:12px">{fmt_datetime(created)}</td></tr>
        </table>
        <div style="margin-top:16px;text-align:center">
          <a href="{SITE_URL}/admin" style="display:inline-block;background:#073590;color:white;padding:10px 24px;text-decoration:none;font-weight:bold">Ver en Admin →</a>
        </div>
      </div>
      {email_footer()}
    </body></html>"""
    send_email(NOTIFY_EMAIL, f"📋 Nueva Reserva Solicitada — {b['client_name']} · {b['booking_date']}", html)

def send_customer_confirmation(b):
    if not b.get("client_email"): return
    created = b.get("created_at", now_peru())
    if isinstance(created, str): created = datetime.fromisoformat(created)
    html = f"""<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f5f7ff">
      {email_header()}
      <div style="padding:24px 32px">
        <h2 style="color:#073590;margin:0 0 6px">¡Hola, {b['client_name']}!</h2>
        <p style="color:#5a6a8a;margin:0 0 20px">Tu solicitud de reserva en <strong>WEC Taller Automotriz</strong> fue recibida. Te contactaremos pronto para confirmarla.</p>
        <div style="background:#073590;padding:20px 24px;color:white;margin-bottom:20px">
          <p style="margin:0 0 4px;font-size:11px;opacity:0.7;letter-spacing:1px">TU CITA SOLICITADA</p>
          <p style="margin:0;font-size:24px;font-weight:bold;color:#F7C416">{b['time_slot']} hrs</p>
          <p style="margin:6px 0 0;font-size:15px">{fmt_date(str(b['booking_date']))}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #dde5f5;margin-bottom:20px">
          <tr><td style="padding:10px 14px;border-bottom:1px solid #eef2fb;color:#073590;font-weight:bold;width:38%">Servicio</td><td style="padding:10px 14px;border-bottom:1px solid #eef2fb">{b['service']}</td></tr>
          <tr><td style="padding:10px 14px;border-bottom:1px solid #eef2fb;color:#073590;font-weight:bold">Teléfono</td><td style="padding:10px 14px;border-bottom:1px solid #eef2fb">{b['client_phone']}</td></tr>
          <tr><td style="padding:10px 14px;color:#5a6a8a;font-size:12px">Solicitado</td><td style="padding:10px 14px;color:#5a6a8a;font-size:12px">{fmt_datetime(created)}</td></tr>
        </table>
        <div style="background:#e8f4fd;border-left:4px solid #073590;padding:14px;margin-bottom:16px">
          <p style="margin:0;color:#073590;font-size:13px">⚡ Te llamaremos al <strong>{b['client_phone']}</strong> para confirmar tu cita. También por WhatsApp.</p>
        </div>
        <div style="text-align:center">
          <a href="{SITE_URL}/reservar" style="display:inline-block;background:#F7C416;color:#073590;padding:12px 28px;text-decoration:none;font-weight:bold">Ver mi reserva →</a>
        </div>
      </div>
      {email_footer()}
    </body></html>"""
    send_email(b["client_email"], f"📋 Reserva Recibida — WEC Taller Automotriz · {b['booking_date']} {b['time_slot']} hrs", html)

def _parse_booking(row: dict) -> dict:
    imgs = row.get("reception_images")
    return {**row, "reception_images": json.loads(imgs) if imgs else []}

def _parse_progress(row: dict) -> dict:
    return {**row, "parts_needed": json.loads(row.get("parts_needed") or "[]"), "image_urls": json.loads(row.get("image_urls") or "[]")}

async def log_action(user, action: str, description: str, entity_type: Optional[str] = None, entity_id: Optional[int] = None, old_value: Optional[str] = None, new_value: Optional[str] = None):
    """Insert a row into the audit_log table. Safe to call from request handlers.
    """
    try:
        admin_id = None
        admin_name = None
        if isinstance(user, dict):
            admin_id = user.get("id")
            admin_name = user.get("name")
        await database.execute(audit_log.insert().values(
            admin_id=admin_id,
            admin_name=admin_name,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            description=description,
            old_value=old_value,
            new_value=new_value,
            undone=False,
            created_at=now_peru(),
        ))
    except Exception as e:
        # Don't raise from logger; just print for debugging
        print(f"log_action error: {e}")

# ── Auth routes ───────────────────────────────────────────────────────────────
@app.get("/")
async def root(): return {"message": "WEC Taller Automotriz API", "statuses": BOOKING_STATUSES}

@app.get("/booking-statuses")
async def get_statuses():
    return [{"value": s, "label": STATUS_LABELS_ES[s], "emoji": STATUS_EMOJIS[s]} for s in BOOKING_STATUSES]

@app.post("/auth/register", response_model=TokenOut)
async def register(data: UserRegister):
    if data.role in ("admin","superadmin"):
        if data.admin_secret != ADMIN_SECRET: raise HTTPException(403, "Código incorrecto")
    ex = await database.fetch_one(users_table.select().where(users_table.c.email == data.email))
    if ex: raise HTTPException(400, "Email ya registrado")
    uid = await database.execute(users_table.insert().values(
        name=data.name, email=data.email, password_hash=hash_password(data.password),
        role=data.role, is_active=True, created_at=now_peru()
    ))
    user = dict(await database.fetch_one(users_table.select().where(users_table.c.id == uid)))
    return TokenOut(access_token=create_token(user["id"], user["role"]), token_type="bearer", user=UserOut(**user))

@app.post("/auth/login", response_model=TokenOut)
async def login(data: UserLogin):
    user = await database.fetch_one(users_table.select().where(users_table.c.email == data.email))
    if not user or not check_password(data.password, user["password_hash"]): raise HTTPException(401, "Credenciales incorrectas")
    if not user["is_active"]: raise HTTPException(403, "Cuenta desactivada")
    u = dict(user)
    return TokenOut(access_token=create_token(u["id"], u["role"]), token_type="bearer", user=UserOut(**u))

@app.get("/auth/me", response_model=UserOut)
async def me(user=Depends(get_current_user)): return UserOut(**user)

@app.get("/users", response_model=List[UserOut])
async def list_users(user=Depends(require_superadmin)):
    return [UserOut(**dict(r)) for r in await database.fetch_all(users_table.select().order_by(users_table.c.created_at.desc()))]

@app.get("/admin/users", response_model=List[UserOut])
async def list_users_for_admin(user=Depends(require_admin)):
    """List only 'user' role accounts — accessible by both admin and superadmin for messaging."""
    rows = await database.fetch_all(
        users_table.select().where(users_table.c.role == "user", users_table.c.is_active == True)
        .order_by(users_table.c.name)
    )
    return [UserOut(**dict(r)) for r in rows]

@app.patch("/users/{uid}/toggle")
async def toggle_user(uid: int, user=Depends(require_superadmin)):
    row = await database.fetch_one(users_table.select().where(users_table.c.id == uid))
    if not row: raise HTTPException(404, "No encontrado")
    await database.execute(users_table.update().where(users_table.c.id == uid).values(is_active=not row["is_active"]))
    return {"is_active": not row["is_active"]}

@app.patch("/users/{uid}/role")
async def change_role(uid: int, role: str, user=Depends(require_superadmin)):
    if role not in ("user","admin","superadmin"): raise HTTPException(400, "Rol inválido")
    await database.execute(users_table.update().where(users_table.c.id == uid).values(role=role))
    return {"message": "Rol actualizado"}

@app.delete("/users/{uid}")
async def delete_user(uid: int, user=Depends(require_superadmin)):
    await database.execute(users_table.delete().where(users_table.c.id == uid))
    return {"message": "Eliminado"}

# ── Availability ──────────────────────────────────────────────────────────────
@app.get("/availability/{booking_date}", response_model=DayAvailability)
async def get_availability(booking_date: date):
    allowed = get_slots_for_date(booking_date)
    max_s   = await get_day_max(booking_date)
    blist   = await database.fetch_all(bookings.select().where(bookings.c.booking_date == booking_date, bookings.c.status.notin_(["cancelled"])))
    bvalid  = [b for b in blist if b["time_slot"] in allowed]
    btimes  = [b["time_slot"] for b in bvalid]
    slots   = [{"time": s, "available": s not in btimes, "booked": s in btimes} for s in allowed]
    unbooked = len([s for s in slots if not s["booked"]])
    remaining_capacity = max(0, max_s - len(bvalid))
    avail   = min(unbooked, remaining_capacity)
    is_full = avail == 0
    return DayAvailability(booking_date=booking_date, max_slots=max_s, booked_slots=len(bvalid), available_slots=avail, time_slots=slots, is_full=is_full)

# ── Bookings ─────────────────────────────────────────────────────────────────
@app.post("/bookings", response_model=BookingOut)
async def create_booking(booking: BookingCreate):
    if not await verify_hcaptcha(booking.captcha_token): raise HTTPException(400, "Captcha inválido.")
    allowed = get_slots_for_date(booking.booking_date)
    if not allowed: raise HTTPException(400, "No atendemos los domingos.")
    if booking.time_slot not in allowed: raise HTTPException(400, f"Horario no disponible. Opciones: {allowed}")
    max_s = await get_day_max(booking.booking_date)
    blist = [b for b in await database.fetch_all(bookings.select().where(bookings.c.booking_date==booking.booking_date, bookings.c.status.notin_(["cancelled"]))) if b["time_slot"] in allowed]
    if len(blist) >= max_s: raise HTTPException(400, "Sin disponibilidad ese día.")
    if any(b["time_slot"] == booking.time_slot for b in blist): raise HTTPException(400, "Horario ya reservado.")
    now = now_peru()
    bid = await database.execute(bookings.insert().values(
        client_name=booking.client_name, client_phone=booking.client_phone,
        client_email=booking.client_email, service=booking.service,
        booking_date=booking.booking_date, time_slot=booking.time_slot,
        notes=booking.notes, created_at=now, status="requested"
    ))
    row  = dict(await database.fetch_one(bookings.select().where(bookings.c.id == bid)))
    bdat = {**row, "booking_date": str(row["booking_date"]), "created_at": now}
    threading.Thread(target=send_admin_notification, args=(bdat,), daemon=True).start()
    threading.Thread(target=send_customer_confirmation, args=(bdat,), daemon=True).start()
    return BookingOut(**_parse_booking(row))

@app.get("/admin/bookings/all", response_model=List[BookingOut])
async def admin_all(status_filter: Optional[str] = None, user=Depends(require_admin)):
    q = bookings.select().order_by(bookings.c.booking_date.desc(), bookings.c.time_slot)
    rows = await database.fetch_all(q)
    result = [_parse_booking(dict(r)) for r in rows]
    if status_filter and status_filter != "all":
        result = [b for b in result if b["status"] == status_filter]
    return [BookingOut(**b) for b in result]

@app.get("/admin/bookings/stats")
async def booking_stats(user=Depends(require_admin)):
    rows = await database.fetch_all(bookings.select())
    counts = {s: 0 for s in BOOKING_STATUSES}
    for r in rows:
        s = r["status"]
        if s in counts: counts[s] += 1
    return {"total": len(rows), "by_status": counts, "statuses": BOOKING_STATUSES}

@app.patch("/bookings/{bid}/status")
async def update_booking_status(bid: int, data: BookingStatusUpdate, notify_email: bool = False, notify_wa: bool = False, user=Depends(require_admin)):
    if data.status not in BOOKING_STATUSES:
        raise HTTPException(400, f"Estado inválido. Opciones: {BOOKING_STATUSES}")
    # Require a textual approval note when moving to 'waiting_approval'
    if data.status == "waiting_approval":
        if not data.approval_note or not str(data.approval_note).strip():
            raise HTTPException(400, "Aprobación requerida: debe indicar la aprobación necesaria")

    row = await database.fetch_one(bookings.select().where(bookings.c.id == bid))
    if not row: raise HTTPException(404, "Reserva no encontrada")

    # Mandatory car profile check before allowing "received" status
    if data.status == "received":
        missing = []
        if not row["car_brand"]: missing.append("Marca")
        if not row["car_model"]: missing.append("Modelo")
        if not row["car_year"]:  missing.append("Año")
        imgs = json.loads(row["reception_images"] or "[]") if row["reception_images"] else []
        if len(imgs) < 3: missing.append(f"Fotos de recepción (mínimo 3, actualmente {len(imgs)})")
        if missing:
            raise HTTPException(400, f"Perfil del vehículo incompleto. Campos requeridos: {', '.join(missing)}")

    update_vals = {"status": data.status}
    if data.approval_note:    update_vals["approval_note"]    = data.approval_note
    if data.approval_comment: update_vals["approval_comment"] = data.approval_comment
    # If moving to waiting_approval, clear any previous approval_comment so admin can register a NEW approval
    if data.status == "waiting_approval":
        update_vals["approval_comment"] = None

    await database.execute(bookings.update().where(bookings.c.id == bid).values(**update_vals))
    updated = dict(await database.fetch_one(bookings.select().where(bookings.c.id == bid)))

    # Audit log
    old_status = row["status"]
    await log_action(user, "status_change",
        f"{row['client_name']} — {old_status} → {data.status}" + (f" | {data.approval_comment}" if data.approval_comment else ""),
        entity_type="booking", entity_id=bid,
        old_value=json.dumps({"status": old_status, "approval_note": dict(row).get("approval_note")}),
        new_value=json.dumps({"status": data.status, "approval_note": data.approval_note, "approval_comment": data.approval_comment})
    )

    if notify_email or notify_wa:
        b = _parse_booking(updated)
        threading.Thread(target=notify_booking_status, args=(b, data.status, data.approval_note or "", notify_wa), daemon=True).start()

    return {"message": "Estado actualizado", "status": data.status, "wa_link": wa_link(row["client_phone"], f"Hola {row['client_name']}, tu reserva en WEC Taller Automotriz fue actualizada a: {STATUS_LABELS_ES.get(data.status,'')}")}

@app.patch("/bookings/{bid}/car-profile")
async def update_car_profile(bid: int, data: CarProfileUpdate, user=Depends(require_admin)):
    row = await database.fetch_one(bookings.select().where(bookings.c.id == bid))
    if not row: raise HTTPException(404, "No encontrada")
    vals = {k: v for k, v in data.dict().items() if v is not None}
    await database.execute(bookings.update().where(bookings.c.id == bid).values(**vals))
    updated = dict(await database.fetch_one(bookings.select().where(bookings.c.id == bid)))
    return BookingOut(**_parse_booking(updated))

@app.patch("/bookings/{bid}/cancel")
async def cancel_booking(bid: int, user=Depends(require_admin)):
    if not await database.fetch_one(bookings.select().where(bookings.c.id == bid)): raise HTTPException(404, "No encontrado")
    await database.execute(bookings.update().where(bookings.c.id == bid).values(status="cancelled"))
    return {"message": "Cancelado"}

@app.post("/admin/capacity")
async def set_capacity(data: AdminCapacity, user=Depends(require_admin)):
    ex = await database.fetch_one(day_capacity.select().where(day_capacity.c.booking_date==data.booking_date))
    if ex: await database.execute(day_capacity.update().where(day_capacity.c.booking_date==data.booking_date).values(max_slots=data.max_slots))
    else:  await database.execute(day_capacity.insert().values(booking_date=data.booking_date, max_slots=data.max_slots))
    return {"message": "Actualizado"}

# ── WhatsApp routes ───────────────────────────────────────────────────────────
def build_wa_message(row: dict) -> str:
    """Build a context-aware WhatsApp message based on current booking status."""
    name    = row['client_name']
    fecha   = row['booking_date']
    hora    = row['time_slot']
    service = row['service']
    status  = row['status']
    car_str = ""
    if row.get('car_brand'): car_str = f"{row['car_brand']} {row.get('car_model','')} {row.get('car_plate','')}"
    approval_note = row.get('approval_note','') or ''

    if status == 'requested':
        return (f"Hola {name} 👋\n\n"
                f"Te contactamos de *WEC Taller Automotriz* para confirmar tu reserva del "
                f"{fecha} a las {hora} hrs para *{service}*.\n\n"
                f"¿Podemos confirmar tu cita? Por favor responde SÍ o llámanos al 959 868 604 📅")

    elif status == 'confirmed':
        return (f"Hola {name} ✅\n\n"
                f"Tu reserva en *WEC Taller Automotriz* ha sido *confirmada*.\n"
                f"📅 {fecha} a las {hora} hrs\n"
                f"🔧 Servicio: {service}\n\n"
                f"Te esperamos. Si necesitas cambiar algo, llámanos al 959 868 604.")

    elif status == 'received':
        car_part = f"\n🚗 Vehículo: *{car_str}*" if car_str else ""
        return (f"Hola {name} 🏭\n\n"
                f"Tu vehículo ha ingresado al taller *WEC Taller Automotriz*.{car_part}\n"
                f"🔧 Servicio: {service}\n\n"
                f"Déjanos saber si tienes cualquier consulta. Estaremos en contacto con las novedades.")

    elif status == 'in_progress':
        car_part = f"\n🚗 *{car_str}*" if car_str else ""
        return (f"Hola {name} 🔧\n\n"
                f"Tu vehículo está *en reparación* en WEC Taller Automotriz.{car_part}\n"
                f"🔧 Servicio: {service}\n\n"
                f"Nuestro equipo está trabajando en él. Te avisamos cuando esté listo.")

    elif status == 'waiting_approval':
        car_part = f" *{car_str}*" if car_str else ""
        note_part = f"\n\n📋 Detalle: _{approval_note}_" if approval_note else ""
        return (f"Hola {name} ⏳\n\n"
                f"Te contactamos de *WEC Taller Automotriz* sobre tu vehículo{car_part} — {service}.{note_part}\n\n"
                f"Necesitamos tu aprobación para continuar con la reparación.\n\n"
                f"¿Puedes confirmar la aprobación?\n"
                f"• Responde *SÍ* para aprobar\n"
                f"• Responde *NO* para cancelar\n"
                f"• O dinos si prefieres que te demos una llamada 📞")

    elif status == 'finished':
        car_part = f"\n🚗 *{car_str}*" if car_str else ""
        return (f"Hola {name} 🎉\n\n"
                f"¡Buenas noticias! Tu vehículo ha sido *terminado* en WEC Taller Automotriz.{car_part}\n"
                f"🔧 Servicio: {service}\n\n"
                f"Puedes pasar a recogerlo cuando gustes. Horario: Lun-Sáb 8am-6pm.\n"
                f"Cualquier consulta: 959 868 604 📞")

    elif status == 'delivered':
        return (f"Hola {name} 🏁\n\n"
                f"Gracias por confiar en *WEC Taller Automotriz*. Tu vehículo ha sido entregado.\n\n"
                f"Esperamos que todo esté perfecto. Si tienes alguna observación no dudes en contactarnos al 959 868 604.\n\n"
                f"¡Hasta la próxima! 🙌")

    else:
        return (f"Hola {name} 👋\n\n"
                f"Te contactamos de *WEC Taller Automotriz* sobre tu reserva del {fecha} a las {hora} hrs ({service}).\n\n"
                f"Déjanos saber si tienes cualquier consulta al 959 868 604.")

@app.get("/bookings/{bid}/wa-link")
async def get_wa_link(bid: int, user=Depends(require_admin)):
    row = await database.fetch_one(bookings.select().where(bookings.c.id == bid))
    if not row: raise HTTPException(404, "No encontrada")
    row = dict(row)
    msg = build_wa_message(row)
    return {"wa_link": wa_link(row["client_phone"], msg), "phone": row["client_phone"], "message": msg}

@app.post("/bookings/{bid}/send-whatsapp")
async def send_whatsapp(bid: int, data: WhatsAppMsg, user=Depends(require_admin)):
    row = await database.fetch_one(bookings.select().where(bookings.c.id == bid))
    if not row: raise HTTPException(404, "No encontrada")
    phone = data.phone or row["client_phone"]
    link  = wa_link(phone, data.message)
    sent  = send_whatsapp_twilio(phone, data.message)
    return {"sent_via_twilio": sent, "wa_link": link, "phone": phone}

# ── Garage analytics ──────────────────────────────────────────────────────────
@app.get("/admin/analytics")
async def garage_analytics(
    date_from: Optional[str] = None,
    date_to:   Optional[str] = None,
    user=Depends(require_admin)
):
    """Full garage status analytics for the progress dashboard."""
    from sqlalchemy import and_, func as sqlfunc

    # Base query filters
    q = bookings.select()
    conditions = []
    if date_from:
        try: conditions.append(bookings.c.booking_date >= datetime.strptime(date_from, "%Y-%m-%d").date())
        except: pass
    if date_to:
        try: conditions.append(bookings.c.booking_date <= datetime.strptime(date_to, "%Y-%m-%d").date())
        except: pass
    if conditions:
        from sqlalchemy import and_
        q = q.where(and_(*conditions))

    all_bookings = [dict(r) for r in await database.fetch_all(q)]

    today    = date.today()
    week_ago = today - timedelta(days=7)
    mon_ago  = today - timedelta(days=30)

    # Active (in-taller) statuses
    active_statuses = ["received","in_progress","waiting_approval","finished"]
    active = [b for b in all_bookings if b["status"] in active_statuses]
    waiting_approval = [b for b in all_bookings if b["status"] == "waiting_approval"]
    in_progress_list = [b for b in all_bookings if b["status"] == "in_progress"]
    waiting_parts    = [b for b in all_bookings if b["status"] == "waiting_approval"]

    # Progress entries for active bookings
    active_ids = [b["id"] for b in active]
    all_progress = []
    if active_ids:
        prog_rows = await database.fetch_all(car_progress.select().where(car_progress.c.booking_id.in_(active_ids)))
        all_progress = [_parse_progress(dict(r)) for r in prog_rows]

    # Map progress to bookings
    prog_by_booking = {}
    for p in all_progress:
        bid = p["booking_id"]
        if bid not in prog_by_booking: prog_by_booking[bid] = []
        prog_by_booking[bid].append(p)

    # Build active cars list with mechanic info
    active_cars = []
    for b in active:
        last_prog = sorted(prog_by_booking.get(b["id"], []), key=lambda x: x["created_at"], reverse=True)
        active_cars.append({
            "id":            b["id"],
            "client_name":   b["client_name"],
            "client_phone":  b["client_phone"],
            "service":       b["service"],
            "status":        b["status"],
            "booking_date":  str(b["booking_date"]),
            "car_brand":     b.get("car_brand"),
            "car_model":     b.get("car_model"),
            "car_plate":     b.get("car_plate"),
            "failure_desc":  b.get("failure_desc"),
            "approval_note": b.get("approval_note"),
            "last_update":   str(last_prog[0]["created_at"])[:16] if last_prog else None,
            "last_title":    last_prog[0]["title"] if last_prog else None,
            "parts_needed":  last_prog[0]["parts_needed"] if last_prog else [],
            "progress_count":len(prog_by_booking.get(b["id"],[])),
        })

    # Status counts
    counts = {s: len([b for b in all_bookings if b["status"]==s]) for s in BOOKING_STATUSES}

    # Throughput
    delivered_month = len([b for b in all_bookings if b["status"]=="delivered" and b["booking_date"] >= mon_ago])
    delivered_week  = len([b for b in all_bookings if b["status"]=="delivered" and b["booking_date"] >= week_ago])

    # Service breakdown for active
    service_counts = {}
    for b in active:
        svc = b["service"]
        service_counts[svc] = service_counts.get(svc, 0) + 1

    return {
        "summary": {
            "total_in_garage":       len(active),
            "max_garage_capacity":   MAX_GARAGE_CAPACITY,
            "garage_slots_free":     max(0, MAX_GARAGE_CAPACITY - len(active)),
            "garage_at_capacity":    len(active) >= MAX_GARAGE_CAPACITY,
            "in_progress":           len(in_progress_list),
            "waiting_approval":      len(waiting_approval),
            "waiting_parts":         len([p for p in all_progress if any(x for x in p.get("parts_needed",[]))]),
            "finished_not_delivered":len([b for b in all_bookings if b["status"]=="finished"]),
            "delivered_this_week":   delivered_week,
            "delivered_this_month":  delivered_month,
            "pending_requests":      counts.get("requested",0),
        },
        "active_cars":    active_cars,
        "status_counts":  counts,
        "service_counts": service_counts,
        "waiting_approval_list": [
            {"id": b["id"], "client_name": b["client_name"], "client_phone": b["client_phone"],
             "service": b["service"], "car": f"{b.get('car_brand','')} {b.get('car_model','')} {b.get('car_plate','')}".strip(),
             "approval_note": b.get("approval_note"), "booking_date": str(b["booking_date"])}
            for b in waiting_approval
        ],
    }

# ── Page analytics ───────────────────────────────────────────────────────────
@app.post("/track")
async def track_event(data: dict, request: Request):
    """Public endpoint — records page views and CTA clicks from visitors."""
    event_type = data.get("event_type", "")
    if event_type not in ("page_view", "click_reservar", "click_llamar"):
        return {"ok": False}
    ip = request.headers.get("x-forwarded-for", request.client.host if request.client else None)
    ua = request.headers.get("user-agent", "")
    await database.execute(page_events.insert().values(
        event_type=event_type,
        page=data.get("page", ""),
        ip=str(ip)[:60] if ip else None,
        user_agent=ua[:500] if ua else None,
        created_at=now_peru(),
    ))
    return {"ok": True}

_geo_cache: dict = {}  # ip -> {"city": ..., "country": ..., "countryCode": ...}

async def _resolve_locations(ips: list[str]) -> dict[str, dict]:
    """Resolve a list of IPs to city/country using ip-api.com batch endpoint."""
    unknown = [ip for ip in ips if ip not in _geo_cache]
    if unknown:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                # ip-api.com batch: max 100 per request
                for i in range(0, len(unknown), 100):
                    batch = unknown[i:i+100]
                    resp = await client.post(
                        "http://ip-api.com/batch",
                        json=[{"query": ip, "fields": "query,city,country,countryCode,status"} for ip in batch],
                    )
                    if resp.status_code == 200:
                        for item in resp.json():
                            ip = item.get("query", "")
                            if item.get("status") == "success":
                                _geo_cache[ip] = {
                                    "city": item.get("city", ""),
                                    "country": item.get("country", ""),
                                    "countryCode": item.get("countryCode", ""),
                                }
                            else:
                                _geo_cache[ip] = {"city": "Desconocido", "country": "", "countryCode": ""}
        except Exception:
            pass
    return _geo_cache

@app.get("/admin/page-analytics")
async def page_analytics(days: int = 30, user=Depends(require_admin)):
    """Returns visit and CTA click counts for the admin panel."""
    since = now_peru() - timedelta(days=days)
    rows = await database.fetch_all(
        page_events.select().where(page_events.c.created_at >= since).order_by(page_events.c.created_at.desc())
    )
    events = [dict(r) for r in rows]

    # Totals
    total_views    = sum(1 for e in events if e["event_type"] == "page_view")
    total_reservar = sum(1 for e in events if e["event_type"] == "click_reservar")
    total_llamar   = sum(1 for e in events if e["event_type"] == "click_llamar")

    # Per-day breakdown (last 14 days for chart)
    from collections import defaultdict
    daily: dict = defaultdict(lambda: {"page_view": 0, "click_reservar": 0, "click_llamar": 0})
    for e in events:
        day = str(e["created_at"])[:10]
        daily[day][e["event_type"]] += 1

    # Sort days ascending
    daily_list = [{"date": d, **v} for d, v in sorted(daily.items())][-14:]

    # Unique IPs (rough unique visitors)
    visitor_ips = list(set(e["ip"] for e in events if e["event_type"] == "page_view" and e["ip"]))
    unique_ips  = len(visitor_ips)

    # Geo-resolve unique visitor IPs
    geo = await _resolve_locations(visitor_ips)
    loc_counts: dict = defaultdict(int)
    for ip in visitor_ips:
        info = geo.get(ip, {})
        city    = info.get("city", "") or ""
        country = info.get("country", "") or ""
        code    = info.get("countryCode", "") or ""
        label   = f"{city}, {country}".strip(", ") or "Desconocido"
        loc_counts[(label, code)] += 1

    locations = [
        {"location": label, "countryCode": code, "visitors": cnt}
        for (label, code), cnt in sorted(loc_counts.items(), key=lambda x: -x[1])
    ]

    return {
        "period_days": days,
        "totals": {
            "page_views":     total_views,
            "click_reservar": total_reservar,
            "click_llamar":   total_llamar,
            "unique_visitors": unique_ips,
        },
        "daily":     daily_list,
        "locations": locations,
    }

# ── Progress ─────────────────────────────────────────────────────────────────
@app.post("/progress", response_model=ProgressOut)
async def create_progress(data: ProgressCreate, user=Depends(require_admin)):
    now = now_peru()
    pid = await database.execute(car_progress.insert().values(
        booking_id=data.booking_id, title=data.title, description=data.description,
        status=data.status, parts_needed=json.dumps(data.parts_needed or []),
        image_urls=json.dumps([]), notify_customer=data.notify_customer,
        created_by=user["id"], created_at=now, updated_at=now,
    ))
    row = dict(await database.fetch_one(car_progress.select().where(car_progress.c.id == pid)))
    out = _parse_progress(row)
    if data.notify_customer:
        booking = dict(await database.fetch_one(bookings.select().where(bookings.c.id == data.booking_id)))
        threading.Thread(target=_send_progress_email, args=(booking, out), daemon=True).start()
    return ProgressOut(**out)

@app.get("/progress/{booking_id}", response_model=List[ProgressOut])
async def get_progress(booking_id: int, user=Depends(require_admin)):
    rows = await database.fetch_all(car_progress.select().where(car_progress.c.booking_id == booking_id).order_by(car_progress.c.created_at.desc()))
    return [ProgressOut(**_parse_progress(dict(r))) for r in rows]

@app.patch("/progress/{pid}/status")
async def update_progress_status(pid: int, status: str, notify: bool = False, user=Depends(require_admin)):
    await database.execute(car_progress.update().where(car_progress.c.id == pid).values(status=status, updated_at=now_peru()))
    if notify:
        row = _parse_progress(dict(await database.fetch_one(car_progress.select().where(car_progress.c.id == pid))))
        booking = dict(await database.fetch_one(bookings.select().where(bookings.c.id == row["booking_id"])))
        threading.Thread(target=_send_progress_email, args=(booking, row), daemon=True).start()
    return {"message": "Actualizado"}

@app.delete("/progress/{pid}")
async def delete_progress(pid: int, user=Depends(require_admin)):
    await database.execute(car_progress.delete().where(car_progress.c.id == pid))
    return {"message": "Eliminado"}

def _send_progress_email(booking, progress):
    if not booking.get("client_email"): return
    STATUS_LABELS_PROG = {"in_progress":"🔧 En reparación","waiting_parts":"⏳ Esperando repuestos","ready":"✅ Listo","delivered":"🏁 Entregado"}
    label  = STATUS_LABELS_PROG.get(progress.get("status",""), "🔧 En proceso")
    parts  = progress.get("parts_needed") or []
    parts_html = ""
    if parts:
        items = "".join(f"<li style='padding:3px 0'>• {p}</li>" for p in parts)
        parts_html = f'<div style="background:#fff3cd;border-left:4px solid #F7C416;padding:14px;margin:16px 0"><p style="margin:0 0 6px;font-weight:bold;color:#073590">🔩 Repuestos</p><ul style="margin:0;padding-left:0;list-style:none">{items}</ul></div>'
    html = f"""<html><body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f5f7ff">
      {email_header()}
      <div style="padding:24px 32px">
        <h2 style="color:#073590">Actualización: {progress['title']}</h2>
        <div style="background:#073590;padding:16px 24px;color:white;margin-bottom:16px">
          <div style="font-size:18px;font-weight:bold;color:#F7C416">{label}</div>
        </div>
        <p style="color:#5a6a8a">{progress.get('description') or ''}</p>
        {parts_html}
      </div>
      {email_footer()}
    </body></html>"""
    send_email(booking["client_email"], f"🔧 Actualización de tu vehículo — {progress['title']}", html)

# ── Image upload ──────────────────────────────────────────────────────────────
import base64, uuid
from fastapi.staticfiles import StaticFiles

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/tmp/talleres_uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

class ImageUpload(BaseModel):
    progress_id: int
    filename: str
    data: str

class ReceptionImageUpload(BaseModel):
    booking_id: int
    filename: str
    data: str

@app.post("/progress/upload-image")
async def upload_progress_image(payload: ImageUpload, user=Depends(require_admin)):
    return await _save_image(payload.filename, payload.data, progress_id=payload.progress_id)

@app.post("/bookings/upload-reception-image")
async def upload_reception_image(payload: ReceptionImageUpload, user=Depends(require_admin)):
    return await _save_image(payload.filename, payload.data, booking_id=payload.booking_id)

async def _save_image(filename, data, progress_id=None, booking_id=None):
    try:
        img_data = base64.b64decode(data.split(",")[-1])
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
        fname = f"{uuid.uuid4().hex}.{ext}"
        fpath = os.path.join(UPLOAD_DIR, fname)
        with open(fpath, "wb") as f: f.write(img_data)
        url = f"/uploads/{fname}"
        if progress_id:
            row = dict(await database.fetch_one(car_progress.select().where(car_progress.c.id == progress_id)))
            existing = json.loads(row.get("image_urls") or "[]")
            existing.append(url)
            await database.execute(car_progress.update().where(car_progress.c.id == progress_id).values(image_urls=json.dumps(existing), updated_at=now_peru()))
        if booking_id:
            row = dict(await database.fetch_one(bookings.select().where(bookings.c.id == booking_id)))
            existing = json.loads(row.get("reception_images") or "[]")
            existing.append(url)
            await database.execute(bookings.update().where(bookings.c.id == booking_id).values(reception_images=json.dumps(existing)))
        return {"url": url}
    except Exception as e: raise HTTPException(400, f"Error subiendo imagen: {e}")

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ── Audit Log ─────────────────────────────────────────────────────────────────
@app.get("/admin/logs", response_model=List[AuditLogOut])
async def get_audit_logs(limit: int = 50, user=Depends(require_admin)):
    """Get the last N admin actions for the Logs tab."""
    rows = await database.fetch_all(
        audit_log.select()
        .order_by(audit_log.c.created_at.desc())
        .limit(limit)
    )
    return [AuditLogOut(**dict(r)) for r in rows]

@app.post("/admin/logs/{log_id}/undo")
async def undo_action(log_id: int, user=Depends(require_admin)):
    """Undo a booking status change by reverting to old_value."""
    row = await database.fetch_one(audit_log.select().where(audit_log.c.id == log_id))
    if not row: raise HTTPException(404, "Log no encontrado")
    if row["undone"]: raise HTTPException(400, "Esta acción ya fue deshecha")
    if row["action"] != "status_change": raise HTTPException(400, "Solo se pueden deshacer cambios de estado")
    if not row["old_value"]: raise HTTPException(400, "Sin valor anterior para revertir")

    old = json.loads(row["old_value"])
    new = json.loads(row["new_value"]) if row["new_value"] else {}
    booking_id = row["entity_id"]

    # Revert the booking status
    await database.execute(
        bookings.update().where(bookings.c.id == booking_id)
        .values(status=old["status"])
    )
    # Mark log entry as undone
    await database.execute(
        audit_log.update().where(audit_log.c.id == log_id).values(undone=True)
    )
    # Log the undo itself
    await log_action(user, "undo",
        f"Deshacer: {row['description']} → revertido a '{old['status']}'",
        entity_type="booking", entity_id=booking_id,
        old_value=row["new_value"], new_value=row["old_value"]
    )
    return {"message": f"Revertido a '{old['status']}'", "booking_id": booking_id}

@app.post("/admin/logs/{log_id}/redo")
async def redo_action(log_id: int, user=Depends(require_admin)):
    """Re-apply a previously undone action."""
    row = await database.fetch_one(audit_log.select().where(audit_log.c.id == log_id))
    if not row: raise HTTPException(404, "Log no encontrado")
    if not row["undone"]: raise HTTPException(400, "Esta acción no ha sido deshecha")
    if row["action"] != "status_change": raise HTTPException(400, "Solo se pueden rehacer cambios de estado")
    if not row["new_value"]: raise HTTPException(400, "Sin valor para rehacer")

    new = json.loads(row["new_value"])
    booking_id = row["entity_id"]

    await database.execute(
        bookings.update().where(bookings.c.id == booking_id)
        .values(status=new["status"])
    )
    await database.execute(
        audit_log.update().where(audit_log.c.id == log_id).values(undone=False)
    )
    await log_action(user, "redo",
        f"Rehacer: {row['description']}",
        entity_type="booking", entity_id=booking_id,
        old_value=row["old_value"], new_value=row["new_value"]
    )
    return {"message": f"Rehecho a '{new['status']}'", "booking_id": booking_id}

# ── User Portal — Cars ────────────────────────────────────────────────────────
class UserCarCreate(BaseModel):
    brand: str
    model: str
    year:  Optional[int] = None
    plate: Optional[str] = None
    color: Optional[str] = None
    km:    Optional[int] = None
    notes: Optional[str] = None

class UserCarOut(BaseModel):
    id: int
    user_id: int
    brand: str
    model: str
    year:  Optional[int] = None
    plate: Optional[str] = None
    color: Optional[str] = None
    km:    Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime

@app.get("/my/cars", response_model=List[UserCarOut])
async def my_cars(user=Depends(get_current_user)):
    rows = await database.fetch_all(user_cars.select().where(user_cars.c.user_id == user["id"]).order_by(user_cars.c.created_at))
    return [UserCarOut(**dict(r)) for r in rows]

@app.post("/my/cars", response_model=UserCarOut)
async def add_my_car(data: UserCarCreate, user=Depends(get_current_user)):
    cid = await database.execute(user_cars.insert().values(
        user_id=user["id"], brand=data.brand, model=data.model, year=data.year,
        plate=data.plate, color=data.color, km=data.km, notes=data.notes, created_at=now_peru()
    ))
    row = await database.fetch_one(user_cars.select().where(user_cars.c.id == cid))
    return UserCarOut(**dict(row))

@app.patch("/my/cars/{cid}", response_model=UserCarOut)
async def update_my_car(cid: int, data: UserCarCreate, user=Depends(get_current_user)):
    row = await database.fetch_one(user_cars.select().where(user_cars.c.id == cid, user_cars.c.user_id == user["id"]))
    if not row: raise HTTPException(404, "Vehículo no encontrado")
    await database.execute(user_cars.update().where(user_cars.c.id == cid).values(
        brand=data.brand, model=data.model, year=data.year,
        plate=data.plate, color=data.color, km=data.km, notes=data.notes
    ))
    updated = await database.fetch_one(user_cars.select().where(user_cars.c.id == cid))
    return UserCarOut(**dict(updated))

@app.delete("/my/cars/{cid}")
async def delete_my_car(cid: int, user=Depends(get_current_user)):
    row = await database.fetch_one(user_cars.select().where(user_cars.c.id == cid, user_cars.c.user_id == user["id"]))
    if not row: raise HTTPException(404, "Vehículo no encontrado")
    await database.execute(user_cars.delete().where(user_cars.c.id == cid))
    return {"message": "Eliminado"}

# ── User Portal — Bookings ─────────────────────────────────────────────────────
class MyBookingCreate(BaseModel):
    service: str
    booking_date: date
    time_slot: str
    notes: Optional[str] = None
    car_id: Optional[int] = None
    captcha_token: str = "dev-bypass-local"

@app.get("/my/bookings", response_model=List[BookingOut])
async def my_bookings(user=Depends(get_current_user)):
    rows = await database.fetch_all(
        bookings.select()
        .where(bookings.c.owner_user_id == user["id"])
        .order_by(bookings.c.booking_date.desc(), bookings.c.time_slot)
    )
    return [BookingOut(**_parse_booking(dict(r))) for r in rows]

@app.post("/my/bookings", response_model=BookingOut)
async def create_my_booking(data: MyBookingCreate, user=Depends(get_current_user)):
    if not await verify_hcaptcha(data.captcha_token): raise HTTPException(400, "Captcha inválido.")
    allowed = get_slots_for_date(data.booking_date)
    if not allowed: raise HTTPException(400, "No atendemos los domingos.")
    if data.time_slot not in allowed: raise HTTPException(400, f"Horario no disponible. Opciones: {allowed}")
    max_s = await get_day_max(data.booking_date)
    blist = [b for b in await database.fetch_all(bookings.select().where(bookings.c.booking_date == data.booking_date, bookings.c.status.notin_(["cancelled"]))) if b["time_slot"] in allowed]
    if len(blist) >= max_s: raise HTTPException(400, "Sin disponibilidad ese día.")
    if any(b["time_slot"] == data.time_slot for b in blist): raise HTTPException(400, "Horario ya reservado.")
    # fetch user car for client info pre-fill
    car = None
    if data.car_id:
        car = await database.fetch_one(user_cars.select().where(user_cars.c.id == data.car_id, user_cars.c.user_id == user["id"]))
    bid = await database.execute(bookings.insert().values(
        client_name=user["name"], client_phone="", client_email=user["email"],
        service=data.service, booking_date=data.booking_date, time_slot=data.time_slot,
        notes=data.notes, created_at=now_peru(), status="requested",
        owner_user_id=user["id"], car_id=data.car_id,
        car_brand=car["brand"] if car else None, car_model=car["model"] if car else None,
        car_year=car["year"] if car else None, car_plate=car["plate"] if car else None,
        car_color=car["color"] if car else None, car_km=car["km"] if car else None,
    ))
    row = dict(await database.fetch_one(bookings.select().where(bookings.c.id == bid)))
    return BookingOut(**_parse_booking(row))

@app.get("/my/bookings/{bid}/progress", response_model=List[ProgressOut])
async def my_booking_progress(bid: int, user=Depends(get_current_user)):
    b = await database.fetch_one(bookings.select().where(bookings.c.id == bid, bookings.c.owner_user_id == user["id"]))
    if not b: raise HTTPException(404, "Reserva no encontrada")
    rows = await database.fetch_all(car_progress.select().where(car_progress.c.booking_id == bid).order_by(car_progress.c.created_at))
    return [ProgressOut(**_parse_progress(dict(r))) for r in rows]

@app.post("/my/bookings/{bid}/approve")
async def approve_my_booking(bid: int, user=Depends(get_current_user)):
    b = await database.fetch_one(bookings.select().where(bookings.c.id == bid, bookings.c.owner_user_id == user["id"]))
    if not b: raise HTTPException(404, "Reserva no encontrada")
    if b["status"] != "waiting_approval": raise HTTPException(400, "Esta reserva no está esperando aprobación")
    comment = f"✅ Aprobado por el cliente ({user['name']}) vía portal web el {now_peru().strftime('%d/%m/%Y a las %H:%M')} hrs"
    await database.execute(bookings.update().where(bookings.c.id == bid).values(
        status="in_progress", approval_comment=comment, approved_by_user=True
    ))
    return {"message": "Aprobación registrada", "status": "in_progress"}

# ── User Portal — Messages ─────────────────────────────────────────────────────
class MyMessageCreate(BaseModel):
    body: str
    booking_id: Optional[int] = None

class MessageOut(BaseModel):
    id: int
    user_id: int
    booking_id: Optional[int] = None
    sender_role: str
    body: str
    is_read: bool
    created_at: datetime

@app.get("/my/messages", response_model=List[MessageOut])
async def my_messages(user=Depends(get_current_user)):
    rows = await database.fetch_all(
        messages_table.select()
        .where(messages_table.c.user_id == user["id"])
        .order_by(messages_table.c.created_at)
    )
    # Mark admin messages as read
    await database.execute(
        messages_table.update()
        .where(messages_table.c.user_id == user["id"], messages_table.c.sender_role == "admin", messages_table.c.is_read == False)
        .values(is_read=True)
    )
    return [MessageOut(**dict(r)) for r in rows]

@app.post("/my/messages", response_model=MessageOut)
async def send_my_message(data: MyMessageCreate, user=Depends(get_current_user)):
    mid = await database.execute(messages_table.insert().values(
        user_id=user["id"], booking_id=data.booking_id, sender_role="user",
        body=data.body, is_read=False, created_at=now_peru()
    ))
    row = await database.fetch_one(messages_table.select().where(messages_table.c.id == mid))
    return MessageOut(**dict(row))

@app.get("/my/messages/unread-count")
async def my_unread_count(user=Depends(get_current_user)):
    rows = await database.fetch_all(
        messages_table.select().where(
            messages_table.c.user_id == user["id"],
            messages_table.c.sender_role == "admin",
            messages_table.c.is_read == False
        )
    )
    return {"count": len(rows)}

# ── Admin — Messages ───────────────────────────────────────────────────────────
@app.get("/admin/messages/unread-count")
async def admin_unread_count(user=Depends(require_admin)):
    rows = await database.fetch_all(
        messages_table.select().where(messages_table.c.sender_role == "user", messages_table.c.is_read == False)
    )
    return {"count": len(rows)}

@app.get("/admin/messages/{uid}", response_model=List[MessageOut])
async def admin_get_messages(uid: int, user=Depends(require_admin)):
    rows = await database.fetch_all(
        messages_table.select().where(messages_table.c.user_id == uid).order_by(messages_table.c.created_at)
    )
    await database.execute(
        messages_table.update()
        .where(messages_table.c.user_id == uid, messages_table.c.sender_role == "user", messages_table.c.is_read == False)
        .values(is_read=True)
    )
    return [MessageOut(**dict(r)) for r in rows]

@app.post("/admin/messages/{uid}", response_model=MessageOut)
async def admin_reply_message(uid: int, data: MyMessageCreate, user=Depends(require_admin)):
    mid = await database.execute(messages_table.insert().values(
        user_id=uid, booking_id=data.booking_id, sender_role="admin",
        body=data.body, is_read=False, created_at=now_peru()
    ))
    row = await database.fetch_one(messages_table.select().where(messages_table.c.id == mid))
    return MessageOut(**dict(row))

# ── SEED ──────────────────────────────────────────────────────────────────────
@app.post("/admin/seed")
async def seed_data(user=Depends(require_superadmin)):
    """
    Seed:
    - Solicitada: 20 spread over next 2 months
    - Confirmada: 10 spread over next 1 month
    - Recepcionada: 5 (subtypes: 3 in_progress, 2 waiting_approval, 1 finished, 2 received)
    - Entregada: 30 spread over last 3 months
    - 2 admin accounts
    """
    import random as rnd
    rnd.seed(42)
    today = date.today()
    now   = now_peru()
    results = {"admins":0,"bookings":0,"progress":0}

    # 2 extra admins
    for a in [{"name":"Roberto Huanca","email":"roberto@wecautomotriz.pe","password":"Admin2024!","role":"admin"},
              {"name":"Claudia Paredes","email":"claudia@wecautomotriz.pe","password":"Admin2024!","role":"admin"}]:
        if not await database.fetch_one(users_table.select().where(users_table.c.email == a["email"])):
            await database.execute(users_table.insert().values(
                name=a["name"],email=a["email"],password_hash=hash_password(a["password"]),
                role=a["role"],is_active=True,created_at=now))
            results["admins"]+=1

    CLIENTS=[
        ("Carlos Mamani","987001001","carlos.mamani@gmail.com"),
        ("María Quispe","987002002","mquispe@hotmail.com"),
        ("Luis Torres","987003003",None),
        ("Ana Flores","987004004","ana.flores@gmail.com"),
        ("Pedro Condori","987005005",None),
        ("Rosa Chávez","987006006","rosa.chavez@gmail.com"),
        ("Jorge Apaza","987007007","jorge.apaza@yahoo.com"),
        ("Lucía Vargas","987008008","lucia.v@gmail.com"),
        ("Miguel Cano","987009009",None),
        ("Patricia Huanca","987010010","phuanca@gmail.com"),
        ("Raúl Medina","987011011","raul.medina@gmail.com"),
        ("Carmen Pinto","987012012",None),
        ("Fernando Salas","987013013","fsalas@outlook.com"),
        ("Silvia Ramos","987014014","silvia.r@gmail.com"),
        ("Ernesto Llerena","987015015",None),
        ("Gloria Ccoa","987016016","gccoa@gmail.com"),
        ("Álvaro Benavides","987017017","alvarobena@gmail.com"),
        ("Teresa Lazo","987018018","teresa.lazo@hotmail.com"),
        ("Domingo Catacora","987019019",None),
        ("Margarita Zeballos","987020020","mzeba@gmail.com"),
    ]
    CARS=[
        ("Toyota","Corolla",2018,"ABC-123","Blanco",45000),
        ("Hyundai","Tucson",2020,"DEF-456","Plata",32000),
        ("Kia","Sportage",2019,"GHI-789","Negro",55000),
        ("Chevrolet","Spark",2017,"JKL-012","Rojo",78000),
        ("Nissan","Sentra",2016,"MNO-345","Azul",92000),
        ("Toyota","Hilux",2021,"PQR-678","Blanco",28000),
        ("Volkswagen","Jetta",2018,"STU-901","Gris",61000),
        ("Honda","Civic",2019,"VWX-234","Negro",43000),
        ("Mazda","CX-5",2020,"YZA-567","Rojo",38000),
        ("Ford","Escape",2017,"BCD-890","Plata",87000),
    ]
    SERVICES=["Reparación de Suspensión","Cremallera Hidráulica","Cremallera Mecánica","Amortiguadores",
              "Reparación de Frenos","Alineación y Balanceo","Cambio de Aceite y Filtros","Mantenimiento Preventivo","Diagnóstico General"]
    NOTES=["Ruido al pasar baches","Volante vibra","Dirección dura","Pastillas desgastadas",
           "Aceite bajo","Frenos chirrían","Golpe en suspensión","Revisión general",None]
    APPROVAL_NOTES=["Necesitamos reemplazar el guardapolvo del palier — S/. 180 adicionales",
                    "Se encontró desgaste en bomba hidráulica — S/. 320 adicionales",
                    "Los discos también necesitan cambio — S/. 250 adicionales"]
    FAILURE=["Ruido metálico al girar","Vibración a alta velocidad","Fuga de aceite","Pedal esponjoso",None]
    TIME_SLOTS=["09:00","14:00","15:00"]

    ci = 0

    def next_work_day(base, offset):
        d = base + timedelta(days=offset)
        while d.weekday() == 6: d += timedelta(days=1)
        return d

    async def make_booking(client_idx, status, booking_date, time_slot, extra={}):
        c = CLIENTS[client_idx % len(CLIENTS)]
        svc = SERVICES[client_idx % len(SERVICES)]
        car = CARS[client_idx % len(CARS)]
        created = datetime.combine(booking_date, datetime.min.time()) - timedelta(days=rnd.randint(1,4))
        return await database.execute(bookings.insert().values(
            client_name=c[0], client_phone=c[1], client_email=c[2],
            service=svc, booking_date=booking_date, time_slot=time_slot,
            notes=rnd.choice(NOTES), created_at=created, status=status,
            **extra
        ))

    async def make_progress(bid, steps):
        base = now_peru() - timedelta(days=rnd.randint(1,5))
        for i,(t,ps,desc) in enumerate(steps):
            edt = base + timedelta(hours=i*6+2)
            await database.execute(car_progress.insert().values(
                booking_id=bid,title=t,description=desc,status=ps,
                parts_needed=json.dumps([]),image_urls=json.dumps([]),
                notify_customer=(i==len(steps)-1),created_by=None,created_at=edt,updated_at=edt))
            results["progress"]+=1

    # ── 20 SOLICITADA — next 2 months ──────────────────────────────────────
    for i in range(20):
        day_off = rnd.randint(2, 60)
        bd = next_work_day(today, day_off)
        slot = TIME_SLOTS[i % 3]
        await make_booking(ci, "requested", bd, slot)
        ci+=1; results["bookings"]+=1

    # ── 10 CONFIRMADA — next 1 month ────────────────────────────────────────
    for i in range(10):
        day_off = rnd.randint(1, 30)
        bd = next_work_day(today, day_off)
        slot = TIME_SLOTS[i % 3]
        await make_booking(ci, "confirmed", bd, slot)
        ci+=1; results["bookings"]+=1

    # ── 8 RECEPCIONADA (in taller with sub-statuses) ─────────────────────────
    # 3 in_progress, 2 waiting_approval, 1 finished, 2 received
    recep_cases = [
        ("in_progress",      [("Diagnóstico inicial","in_progress","Vehículo revisado. Falla identificada."),
                               ("Trabajo iniciado","in_progress","Reparación en proceso.")]),
        ("in_progress",      [("Inspección completada","in_progress","Se detectó desgaste avanzado en cremallera."),
                               ("Desmontaje realizado","in_progress","Piezas desmontadas para inspección profunda.")]),
        ("in_progress",      [("Revisión de suspensión","in_progress","Amortiguadores con fuga detectados."),
                               ("Cambio iniciado","in_progress","Se instalaron los nuevos amortiguadores delanteros.")]),
        ("waiting_approval", [("Diagnóstico completo","in_progress","Se requiere autorización para compra de repuestos."),
                               ("Esperando aprobación","waiting_parts","Guardapolvo del palier izquierdo necesita reemplazo.")]),
        ("waiting_approval", [("Revisión avanzada","in_progress","Se detectó daño adicional en caja de dirección."),
                               ("Pendiente aprobación cliente","waiting_parts","Requiere sellado completo de caja de dirección.")]),
        ("finished",         [("Diagnóstico","in_progress","Falla identificada y reparada."),
                               ("Reparación completada","in_progress","Trabajo terminado exitosamente."),
                               ("Listo para entrega","ready","Vehículo reparado y probado. Listo para recogida.")]),
        ("received",         [("Vehículo recibido","in_progress","Auto ingresado al taller. Iniciando diagnóstico.")]),
        ("received",         [("Recepción completada","in_progress","Vehículo recibido. Diagnóstico programado.")]),
    ]
    for i,(final_status, prog_steps) in enumerate(recep_cases):
        day_off = -rnd.randint(0, 5)  # recent days
        bd = next_work_day(today, day_off) if day_off > 0 else today - timedelta(days=abs(day_off))
        slot = TIME_SLOTS[i % 3]
        car = CARS[ci % len(CARS)]
        ap_note = APPROVAL_NOTES[i % len(APPROVAL_NOTES)] if final_status=="waiting_approval" else None
        extra={
            "car_brand":car[0],"car_model":car[1],"car_year":car[2],
            "car_plate":car[3],"car_color":car[4],"car_km":car[5],
            "failure_desc":rnd.choice(FAILURE),
            "reception_notes":"Vehículo recibido en buen estado general.",
            **({"approval_note":ap_note} if ap_note else {})
        }
        # Use "received" as the booking status (sub-status shown via progress)
        booking_status = "received" if final_status in ("in_progress","waiting_approval","finished","received") else final_status
        # Actually set the real meaningful status
        booking_status = final_status if final_status in ("waiting_approval","finished","received") else "in_progress"
        bid = await make_booking(ci, booking_status, bd, slot, extra)
        await make_progress(bid, prog_steps)
        ci+=1; results["bookings"]+=1

    # ── 30 ENTREGADA — last 3 months ────────────────────────────────────────
    for i in range(30):
        day_off = -rnd.randint(1, 90)
        bd = today + timedelta(days=day_off)
        if bd.weekday()==6: bd+=timedelta(days=-1)
        slot = TIME_SLOTS[i % 3]
        car = CARS[ci % len(CARS)]
        extra={
            "car_brand":car[0],"car_model":car[1],"car_year":car[2],
            "car_plate":car[3],"car_color":car[4],"car_km":car[5],
            "failure_desc":rnd.choice(FAILURE),
            "reception_notes":"Vehículo recibido y reparado.",
        }
        bid = await make_booking(ci, "delivered", bd, slot, extra)
        await make_progress(bid, [
            ("Diagnóstico inicial","in_progress",f"Revisión completa realizada."),
            ("Reparación completada","ready","Trabajo terminado exitosamente."),
            ("Entregado al cliente","delivered","Vehículo entregado con conformidad del cliente."),
        ])
        ci+=1; results["bookings"]+=1

    return {
        "message":"✅ Seed completo",
        "details":{
            "admins_created":results["admins"],
            "solicitadas":20,"confirmadas":10,"recepcionadas":8,
            "entregadas":30,"total_bookings":results["bookings"],
            "progress_entries":results["progress"],
        },
        "admin_credentials":[
            {"email":"roberto@wecautomotriz.pe","password":"Admin2024!"},
            {"email":"claudia@wecautomotriz.pe","password":"Admin2024!"},
        ]
    }

@app.post("/admin/seed-users")
async def seed_user_portal(user=Depends(require_superadmin)):
    import random as rnd
    rnd.seed(99)
    today = date.today()
    now   = now_peru()

    DEMO_USERS = [
        {"name":"Juan Pérez",    "email":"juan@demo.com",    "password":"Demo2024!"},
        {"name":"María García",  "email":"maria@demo.com",   "password":"Demo2024!"},
        {"name":"Carlos López",  "email":"carlos@demo.com",  "password":"Demo2024!"},
    ]
    # (brand, model, year, plate, color, km, notes)
    DEMO_CARS = [
        [("Toyota","Corolla",2019,"JUP-001","Blanco",48000,"Solo aceite sintético 5W-30. Revisión cada 5,000 km."),
         ("Honda","Civic",2021,"JUP-002","Negro",22000,"Repuestos originales únicamente. Cliente exige calidad Honda.")],
        [("Hyundai","Tucson",2020,"MAG-003","Plata",35000,"Alérgica a marcas genéricas. Usa Mobil 1 Full Synthetic."),
         ("Mazda","CX-5",2018,"MAG-004","Rojo",61000,"Tiene garantía vigente. Documentar toda intervención.")],
        [("Kia","Sportage",2017,"CAR-005","Azul",78000,"Segunda mano. Revisar historial de mantenimiento previo."),
         ("Nissan","Sentra",2022,"CAR-006","Gris",15000,"Auto nuevo — cliente muy detallista con acabados.")],
    ]
    SERVICES  = ["Reparación de Suspensión","Cremallera Hidráulica","Amortiguadores","Reparación de Frenos","Alineación y Balanceo","Cambio de Aceite y Filtros","Diagnóstico General"]
    STATUSES  = ["requested","confirmed","received","in_progress","waiting_approval","finished","delivered","cancelled"]
    NOTES     = ["Ruido al pasar baches","Dirección dura","Vibración en volante","Pastillas desgastadas","Aceite bajo","Revisión general","Golpe leve en suspensión delantera"]
    APPROVAL_NOTES = ["Se requiere cambio de guardapolvo del palier — S/. 180 adicionales","Se detectó desgaste en bomba hidráulica — S/. 320 adicionales"]
    APPROVAL_COMMENTS = ["✅ Aprobado (Llamada) el lunes — cliente autorizó continuar","✅ Aprobado (WhatsApp) — cliente envió confirmación escrita"]
    FAILURE   = ["Ruido metálico al girar en curvas","Vibración a alta velocidad en autopista","Fuga de aceite por junta de culata","Golpe seco al pasar baches"]
    RECEPTION_NOTES = [
        "Vehículo recibido en buen estado general. Se verificaron luces y carrocería.",
        "Auto ingresado con llave de repuesto. Cliente dejó número alterno.",
        "Recepcionado con leve golpe en parachoques trasero — documentado y fotografiado.",
        "Vehículo en buen estado. Cliente autorizó revisión completa del sistema.",
    ]
    TIME_SLOTS = ["09:00","14:00","15:00"]
    created_users = []

    for i, ud in enumerate(DEMO_USERS):
        ex = await database.fetch_one(users_table.select().where(users_table.c.email == ud["email"]))
        if ex:
            uid = ex["id"]
        else:
            uid = await database.execute(users_table.insert().values(
                name=ud["name"], email=ud["email"], password_hash=hash_password(ud["password"]),
                role="user", is_active=True, created_at=now
            ))

        # Create 2 cars per user — all fields including notes
        car_ids = []
        for brand,model,year,plate,color,km,car_notes in DEMO_CARS[i]:
            ex_car = await database.fetch_one(user_cars.select().where(user_cars.c.user_id == uid, user_cars.c.plate == plate))
            if ex_car:
                car_ids.append(ex_car["id"])
            else:
                cid = await database.execute(user_cars.insert().values(
                    user_id=uid, brand=brand, model=model, year=year,
                    plate=plate, color=color, km=km, notes=car_notes, created_at=now
                ))
                car_ids.append(cid)

        # Create bookings for each car with varied statuses
        cars_data = DEMO_CARS[i]
        for ci, (car_id, car_tuple) in enumerate(zip(car_ids, cars_data)):
            brand,model,year,plate,color,km,_ = car_tuple
            for bi in range(4):  # 4 bookings per car = 8 per user
                status = STATUSES[(i*8 + ci*4 + bi) % len(STATUSES)]
                days_offset = rnd.choice([-60,-30,-14,-7,1,3,7,14,21])
                bd = today + timedelta(days=days_offset)
                while bd.weekday() == 6: bd += timedelta(days=1)
                slot = TIME_SLOTS[(i+ci+bi) % len(TIME_SLOTS)]
                created_dt = datetime.combine(bd, datetime.min.time()) - timedelta(days=rnd.randint(1,3))
                svc = SERVICES[(i*8 + ci*4 + bi) % len(SERVICES)]
                needs_car = status in ["received","in_progress","waiting_approval","finished","delivered"]
                approval  = APPROVAL_NOTES[(i+bi) % len(APPROVAL_NOTES)] if status in ["waiting_approval","finished","delivered"] else None
                approval_comment = APPROVAL_COMMENTS[(i+bi) % len(APPROVAL_COMMENTS)] if status in ["finished","delivered"] else None

                extra = {}
                if needs_car:
                    extra = {
                        "car_brand": brand, "car_model": model, "car_year": year,
                        "car_plate": plate, "car_color": color, "car_km": km,
                        "failure_desc": FAILURE[(i*8 + ci*4 + bi) % len(FAILURE)],
                        "reception_notes": RECEPTION_NOTES[(i*8 + ci*4 + bi) % len(RECEPTION_NOTES)],
                        "reception_images": json.dumps([]),
                    }
                if approval:         extra["approval_note"]    = approval
                if approval_comment: extra["approval_comment"] = approval_comment

                bid_val = await database.execute(bookings.insert().values(
                    client_name=ud["name"], client_phone=f"98700{i*10+ci*4+bi:04d}",
                    client_email=ud["email"], service=svc,
                    booking_date=bd, time_slot=slot,
                    notes=rnd.choice(NOTES), created_at=created_dt, status=status,
                    owner_user_id=uid, car_id=car_id,
                    **extra
                ))

                # Progress for active/done bookings
                if status in ["received","in_progress","waiting_approval","finished","delivered"]:
                    for si,(t,ps,desc) in enumerate([
                        ("Diagnóstico inicial","in_progress",f"Revisión completa realizada."),
                        ("Trabajo en progreso","in_progress","Reparación iniciada."),
                        *([("Esperando aprobación","waiting_parts",approval or "Repuesto adicional.")] if status=="waiting_approval" else []),
                        *([("Reparación terminada","ready","Trabajo completado.")] if status in ("finished","delivered") else []),
                    ]):
                        edt = created_dt + timedelta(hours=si*6+3)
                        await database.execute(car_progress.insert().values(
                            booking_id=bid_val, title=t, description=desc, status=ps,
                            parts_needed=json.dumps([]), image_urls=json.dumps([]),
                            notify_customer=(si==1), created_by=None, created_at=edt, updated_at=edt))

        # Seed a welcome message from admin
        await database.execute(messages_table.insert().values(
            user_id=uid, booking_id=None, sender_role="admin",
            body=f"¡Bienvenido/a {ud['name']}! Gracias por registrarte en WEC Taller Automotriz. Puedes hacer seguimiento de tus vehículos y enviarnos mensajes desde tu cuenta. 🔧",
            is_read=False, created_at=now))

        created_users.append({"name":ud["name"],"email":ud["email"],"password":"Demo2024!","cars":len(car_ids)})

    return {
        "message": "✅ Usuarios demo creados",
        "users": created_users,
        "note": "3 usuarios × 2 autos × 4 reservas = 24 reservas con estados variados"
    }

@app.get("/bookings/{bid}/workflow-history")
async def get_workflow_history(bid: int, user=Depends(require_admin)):
    """Return full chronological timeline of every status change for a booking,
    including the initial creation event, plus approval notes/comments when present.
    """
    booking = await database.fetch_one(bookings.select().where(bookings.c.id == bid))
    if not booking: raise HTTPException(404, "Reserva no encontrada")

    # Seed with the creation event (always present)
    events = [{
        "id": f"created-{bid}",
        "created_at": booking["created_at"],
        "from_status": None,
        "to_status": "requested",
        "admin_name": None,
        "approval_note": None,
        "approval_comment": None,
    }]

    rows = await database.fetch_all(
        audit_log.select()
        .where(audit_log.c.entity_type == "booking", audit_log.c.entity_id == bid,
               audit_log.c.action.in_(["status_change", "redo"]))
        .order_by(audit_log.c.created_at)
    )
    for r in rows:
        try: new = json.loads(r["new_value"] or "{}")
        except: new = {}
        try: old = json.loads(r["old_value"] or "{}")
        except: old = {}
        events.append({
            "id": r["id"],
            "created_at": r["created_at"],
            "from_status": old.get("status"),
            "to_status": new.get("status"),
            "admin_name": r["admin_name"],
            "approval_note": new.get("approval_note") or old.get("approval_note"),
            "approval_comment": new.get("approval_comment") or old.get("approval_comment"),
        })
    return events

@app.get("/bookings/{bid}/approval-history")
async def get_approval_history(bid: int, user=Depends(require_admin)):
    """Return a chronological list (most recent first) of times a booking was marked as requiring approval,
    including the approval text, who set it, when, and any approval_comment.
    """
    rows = await database.fetch_all(
        audit_log.select()
        .where(audit_log.c.entity_type == "booking", audit_log.c.entity_id == bid, audit_log.c.action == "status_change")
        .order_by(audit_log.c.created_at.desc())
    )
    result = []
    for r in rows:
        try:
            new = json.loads(r["new_value"] or "{}")
        except:
            new = {}
        try:
            old = json.loads(r["old_value"] or "{}")
        except:
            old = {}
        note = new.get("approval_note") or old.get("approval_note")
        status = new.get("status") or old.get("status")
        approval_comment_val = new.get("approval_comment") or old.get("approval_comment")
        # include entries where an approval_note exists, status was waiting_approval, or an approval_comment was recorded
        if note or status == "waiting_approval" or approval_comment_val:
            result.append({
                "id": r["id"],
                "admin_name": r["admin_name"],
                "created_at": r["created_at"],
                "description": r["description"],
                "approval_note": note,
                "approval_comment": approval_comment_val,
                "status": status,
            })
    return result

import axios from 'axios'

const API = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000' })

API.interceptors.request.use(cfg => {
  const token = localStorage.getItem('tb_token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

// Public
export const getAvailability     = (date) => API.get(`/availability/${date}`)
export const createBooking       = (data) => API.post('/bookings', data)
export const getBookingStatuses  = ()     => API.get('/booking-statuses')

// Auth
export const login    = (data) => API.post('/auth/login', data)
export const register = (data) => API.post('/auth/register', data)
export const getMe    = ()     => API.get('/auth/me')

// Admin — bookings
export const getAllBookings      = (status) => API.get('/admin/bookings/all', { params: status ? { status_filter: status } : {} })
export const getBookingStats    = ()       => API.get('/admin/bookings/stats')
export const updateBookingStatus = (id, status, approvalNote, email, wa, approvalComment) =>
  API.patch(`/bookings/${id}/status`, { status, approval_note: approvalNote || null, approval_comment: approvalComment || null }, { params: { notify_email: email, notify_wa: wa } })
export const updateCarProfile   = (id, data) => API.patch(`/bookings/${id}/car-profile`, data)
export const cancelBooking      = (id)       => API.patch(`/bookings/${id}/cancel`)
export const setCapacity        = (data)     => API.post('/admin/capacity', data)

// WhatsApp
export const getWaLink      = (id)        => API.get(`/bookings/${id}/wa-link`)
export const sendWhatsApp   = (id, data)  => API.post(`/bookings/${id}/send-whatsapp`, data)

// Progress
export const getProgress         = (bookingId) => API.get(`/progress/${bookingId}`)
export const createProgress      = (data)      => API.post('/progress', data)
export const updateProgressStatus = (id, s, n) => API.patch(`/progress/${id}/status`, null, { params: { status: s, notify: n } })
export const deleteProgress      = (id)        => API.delete(`/progress/${id}`)
export const uploadProgressImage = (data)      => API.post('/progress/upload-image', data)
export const uploadReceptionImage= (data)      => API.post('/bookings/upload-reception-image', data)

// Users (superadmin)
export const getUsers    = ()          => API.get('/users')
export const toggleUser  = (id)       => API.patch(`/users/${id}/toggle`)
export const changeRole  = (id, role) => API.patch(`/users/${id}/role`, null, { params: { role } })
export const deleteUser  = (id)       => API.delete(`/users/${id}`)

// Seed
export const seedData = () => API.post('/admin/seed')

export default API

// Analytics
export const getAnalytics = (dateFrom, dateTo) => API.get('/admin/analytics', {
  params: { ...(dateFrom ? {date_from: dateFrom} : {}), ...(dateTo ? {date_to: dateTo} : {}) }
})

// User portal
export const getMyCars        = ()        => API.get('/my/cars')
export const addMyCar         = (data)    => API.post('/my/cars', data)
export const updateMyCar      = (id,data) => API.patch(`/my/cars/${id}`, data)
export const deleteMyCar      = (id)      => API.delete(`/my/cars/${id}`)
export const getMyBookings    = ()        => API.get('/my/bookings')
export const createMyBooking  = (data)    => API.post('/my/bookings', data)
export const getMyBookingProg = (id)      => API.get(`/my/bookings/${id}/progress`)
export const getMyMessages    = ()        => API.get('/my/messages')
export const sendMyMessage    = (data)    => API.post('/my/messages', data)
export const getMyUnread      = ()        => API.get('/my/messages/unread-count')
// Admin messages
export const adminGetMessages = (uid)      => API.get(`/admin/messages/${uid}`)
export const adminReplyMessage= (uid,data) => API.post(`/admin/messages/${uid}`, data)
export const adminUnreadCount = ()         => API.get('/admin/messages/unread-count')
// Seed users
export const seedUsers = () => API.post('/admin/seed-users')

// Admin-accessible user list (for messaging)
export const getAdminUsers = () => API.get('/admin/users')

// User self-approval
export const approveMyBooking = (id) => API.post(`/my/bookings/${id}/approve`)

// Audit logs
export const getAuditLogs  = (limit=50) => API.get('/admin/logs', { params: { limit } })
export const undoAction    = (id)       => API.post(`/admin/logs/${id}/undo`)
export const redoAction    = (id)       => API.post(`/admin/logs/${id}/redo`)

// Page analytics
export const trackEvent      = (event_type, page) => API.post('/track', { event_type, page }).catch(()=>{})
export const getPageAnalytics = (days=30)          => API.get('/admin/page-analytics', { params: { days } })

// Approval History
export const getApprovalHistory  = (id) => API.get(`/bookings/${id}/approval-history`)
export const getWorkflowHistory  = (id) => API.get(`/bookings/${id}/workflow-history`)

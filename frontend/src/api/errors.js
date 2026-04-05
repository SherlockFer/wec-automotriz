/**
 * Safely extract a readable error message from any Axios error response.
 * Handles:
 *   - Plain string: { detail: "message" }
 *   - Pydantic v2 array: { detail: [{msg, loc, type, ...}] }
 *   - Network errors
 */
export function extractError(err, fallback = 'Ocurrió un error. Inténtalo de nuevo.') {
  if (!err) return fallback
  const detail = err.response?.data?.detail
  if (!detail) {
    if (err.message) return err.message
    return fallback
  }
  // Plain string
  if (typeof detail === 'string') return detail
  // Array of Pydantic v2 errors
  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object') {
      let msg = first.msg || first.message || fallback
      msg = msg.replace('Value error, ', '')
      return msg
    }
  }
  // Object with msg
  if (typeof detail === 'object' && detail.msg) return detail.msg
  return fallback
}

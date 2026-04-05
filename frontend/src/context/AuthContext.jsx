import React, { createContext, useContext, useState, useEffect } from 'react'
import { getMe } from '../api/index.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('tb_token')
    if (token) {
      getMe().then(r => setUser(r.data)).catch(() => localStorage.removeItem('tb_token')).finally(() => setLoading(false))
    } else { setLoading(false) }
  }, [])

  const loginUser = (token, userData) => { localStorage.setItem('tb_token', token); setUser(userData) }
  const logout    = () => { localStorage.removeItem('tb_token'); setUser(null) }

  return <AuthContext.Provider value={{ user, loading, loginUser, logout }}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

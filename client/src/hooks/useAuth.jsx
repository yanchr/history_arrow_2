import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'
import { withTimeout } from '../utils/asyncTimeout'

const AuthContext = createContext({})

const REQUEST_TIMEOUT_MS = 15000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const resolveAdminStatus = async (sessionUser) => {
      if (!sessionUser) {
        setIsAdmin(false)
        return
      }

      const { data, error } = await withTimeout(
        supabase.rpc('is_admin'),
        REQUEST_TIMEOUT_MS,
        'Admin check timed out.'
      )
      if (error) {
        setIsAdmin(false)
        return
      }

      setIsAdmin(Boolean(data))
    }

    // Check active session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user ?? null)
      await resolveAdminStatus(session?.user ?? null)
      setLoading(false)
    }

    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null)
        await resolveAdminStatus(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const value = {
    user,
    isAdmin,
    loading,
    signIn,
    signOut,
    isAuthenticated: !!user
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

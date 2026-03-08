import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../utils/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let isMounted = true

    const resolveAdminStatus = async (sessionUser) => {
      if (!isMounted) return
      if (!sessionUser) {
        setIsAdmin(false)
        return
      }

      try {
        const { data, error } = await supabase.rpc('is_admin')
        if (!isMounted) return
        if (error) {
          setIsAdmin(false)
          return
        }

        setIsAdmin(Boolean(data))
      } catch {
        if (!isMounted) return
        setIsAdmin(false)
      }
    }

    // Check active session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!isMounted) return
      setUser(session?.user ?? null)
      setLoading(false)
      // Run role lookup after releasing auth initialization path.
      void resolveAdminStatus(session?.user ?? null)
    }

    getSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!isMounted) return
        setUser(session?.user ?? null)
        setLoading(false)
        // Avoid awaiting Supabase calls inside auth callbacks to prevent lock contention.
        void resolveAdminStatus(session?.user ?? null)
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
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

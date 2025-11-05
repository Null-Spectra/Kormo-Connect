import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase, UserRole, Profile } from '@/lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  userRole: UserRole | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUserRole: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [userRole, setUserRole] = useState<UserRole | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching user role:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in fetchUserRole:', error)
      return null
    }
  }

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Error in fetchProfile:', error)
      return null
    }
  }

  const refreshUserRole = async () => {
    if (user) {
      const role = await fetchUserRole(user.id)
      setUserRole(role)
    }
  }

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id)
      setProfile(profileData)
    }
  }

  // Initial auth check on mount
  useEffect(() => {
    let isMounted = true
    
    async function initializeAuth() {
      try {
        // Get initial session
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!isMounted) return
        
        setSession(session)
        setUser(session?.user ?? null)
        
        // Fetch user role and profile if we have a session
        if (session?.user) {
          const [role, profileData] = await Promise.all([
            fetchUserRole(session.user.id),
            fetchProfile(session.user.id)
          ])
          if (isMounted) {
            setUserRole(role)
            setProfile(profileData)
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // Set up auth state listener - CRITICAL: Keep callback simple with NO async operations
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        // IMPORTANT: No async operations in this callback to avoid deadlocks
        setSession(session)
        setUser(session?.user ?? null)
        
        // Clear user role and profile when session ends
        if (!session?.user) {
          setUserRole(null)
          setProfile(null)
        }
        // Note: User role and profile will be fetched by the separate useEffect below
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Separate effect to fetch user role and profile when user changes
  useEffect(() => {
    let isMounted = true

    async function loadUserData() {
      if (user?.id) {
        const [role, profileData] = await Promise.all([
          fetchUserRole(user.id),
          fetchProfile(user.id)
        ])
        if (isMounted) {
          setUserRole(role)
          setProfile(profileData)
        }
      } else {
        setUserRole(null)
        setProfile(null)
      }
    }

    loadUserData()

    return () => {
      isMounted = false
    }
  }, [user?.id])

  // Safety timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        console.warn('Auth initialization timeout - forcing loading to false')
        setLoading(false)
      }
    }, 5000) // 5 second timeout

    return () => clearTimeout(timeout)
  }, [loading])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setUserRole(null)
    setProfile(null)
  }

  const value = {
    user,
    session,
    userRole,
    profile,
    loading,
    signOut,
    refreshUserRole,
    refreshProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
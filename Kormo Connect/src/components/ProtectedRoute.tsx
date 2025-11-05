import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useEffect, useState } from 'react'
import { getRouteForRole } from '@/lib/utils'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'worker' | 'company'
}

export default function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { user, userRole, profile, loading } = useAuth()
  const [showTimeout, setShowTimeout] = useState(false)

  // Safety timeout for loading state
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (loading) {
        setShowTimeout(true)
      }
    }, 8000) // 8 second timeout

    return () => clearTimeout(timeout)
  }, [loading])

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {showTimeout ? 'This is taking longer than expected...' : 'Loading...'}
          </p>
          {showTimeout && (
            <button
              onClick={() => window.location.href = '/auth'}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Login
            </button>
          )}
        </div>
      </div>
    )
  }

  // Redirect to auth if not logged in
  if (!user) {
    return <Navigate to="/auth" replace />
  }

  // If we have a user but no role yet, wait briefly then redirect
  if (!userRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Setting up your account...</p>
          {showTimeout && (
            <div className="mt-4 space-y-2">
              <p className="text-sm text-gray-500">
                Having trouble? Try logging out and back in.
              </p>
              <button
                onClick={() => window.location.href = '/auth'}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Check role requirements
  if (requiredRole && userRole.role !== requiredRole) {
    // Redirect to appropriate dashboard based on actual role
    const redirectPath = getRouteForRole(userRole.role)
    return <Navigate to={redirectPath} replace />
  }

  // Check if employer account is inactive and needs subscription
  if (requiredRole === 'company' && userRole.role === 'company') {
    if (profile && profile.is_active === false) {
      return <Navigate to="/choose-subscription" replace />
    }
  }

  return <>{children}</>
}
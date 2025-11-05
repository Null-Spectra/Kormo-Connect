import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import AuthPage from '@/pages/AuthPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import WorkerDashboard from '@/pages/WorkerDashboard'
import CompanyDashboard from '@/pages/CompanyDashboard'
import ChooseSubscriptionPage from '@/pages/ChooseSubscriptionPage'
import PaymentSuccessPage from '@/pages/PaymentSuccessPage'
import WorkerUpgradePremiumPage from '@/pages/WorkerUpgradePremiumPage'
import { Toaster } from '@/components/ui/toaster'
import { getRouteForRole } from '@/lib/utils'

function AppRoutes() {
  const { user, userRole, loading } = useAuth()

  // Show loading while checking auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading application...</p>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      
      {/* Subscription routes - require authentication */}
      <Route path="/choose-subscription" element={<ChooseSubscriptionPage />} />
      <Route path="/payment-success" element={<PaymentSuccessPage />} />
      
      {/* Protected routes */}
      <Route
        path="/professional/dashboard"
        element={
          <ProtectedRoute requiredRole="worker">
            <WorkerDashboard />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/professional/upgrade-premium"
        element={
          <ProtectedRoute requiredRole="worker">
            <WorkerUpgradePremiumPage />
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/employer/dashboard"
        element={
          <ProtectedRoute requiredRole="company">
            <CompanyDashboard />
          </ProtectedRoute>
        }
      />

      {/* Root route - redirect based on auth state */}
      <Route
        path="/"
        element={
          user && userRole ? (
            <Navigate 
              to={getRouteForRole(userRole.role)} 
              replace 
            />
          ) : (
            <Navigate to="/auth" replace />
          )
        }
      />

      {/* Catch all - redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </Router>
  )
}

export default App
import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Input, Label } from '@/components/ui/forms'
import { Button } from '@/components/ui/button'
import { Briefcase, User, Building2, CheckCircle2 } from 'lucide-react'

interface CustomAuthFormProps {
  onSuccess?: () => void
}

type AuthMode = 'signin' | 'signup'
type UserRole = 'professional' | 'employer'

export function CustomAuthForm({ onSuccess }: CustomAuthFormProps) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  // Form state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [selectedRole, setSelectedRole] = useState<'worker' | 'company' | null>(null)

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) throw error

      setSuccess('Signed in successfully!')
      if (onSuccess) onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to sign in')
    } finally {
      setLoading(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validate role selection
      if (!selectedRole) {
        throw new Error('Please select an account type')
      }

      // Call the signup-with-role edge function
      const { data, error } = await supabase.functions.invoke('signup-with-role', {
        body: {
          email,
          password,
          fullName,
          role: selectedRole,
        },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error.message)

      // Check if subscription is required (employer accounts)
      if (data?.data?.requiresSubscription) {
        // Sign in the user automatically
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) throw signInError

        // Redirect to subscription page
        navigate('/choose-subscription')
        return
      }

      // For professional accounts, show success message
      setSuccess('Account created successfully! You can now sign in.')
      
      // Switch to sign in mode after successful signup
      setTimeout(() => {
        setMode('signin')
        setPassword('')
        setFullName('')
        setSelectedRole(null)
        setSuccess(null)
      }, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to sign up')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEmail('')
    setPassword('')
    setFullName('')
    setSelectedRole(null)
    setError(null)
    setSuccess(null)
  }

  const switchMode = () => {
    resetForm()
    setMode(mode === 'signin' ? 'signup' : 'signin')
  }

  return (
    <div className="space-y-6">
      {/* Mode Toggle */}
      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
        <button
          type="button"
          onClick={() => mode !== 'signin' && switchMode()}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-200 ${
            mode === 'signin'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => mode !== 'signup' && switchMode()}
          className={`flex-1 py-2 px-4 rounded-md font-medium transition-all duration-200 ${
            mode === 'signup'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Sign Up
        </button>
      </div>

      {/* Error and Success Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800">{success}</p>
        </div>
      )}

      {/* Sign In Form */}
      {mode === 'signin' && (
        <form onSubmit={handleSignIn} className="space-y-4">
          <div>
            <Label htmlFor="signin-email">Email</Label>
            <Input
              id="signin-email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="signin-password">Password</Label>
              <Link
                to="/forgot-password"
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="signin-password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md hover:shadow-lg transition-all"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Signing in...
              </div>
            ) : (
              'Sign In'
            )}
          </Button>
        </form>
      )}

      {/* Sign Up Form */}
      {mode === 'signup' && (
        <form onSubmit={handleSignUp} className="space-y-4">
          <div>
            <Label htmlFor="signup-name">Full Name</Label>
            <Input
              id="signup-name"
              type="text"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              placeholder="your.email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Any valid email address is accepted
            </p>
          </div>

          <div>
            <Label htmlFor="signup-password">Password</Label>
            <Input
              id="signup-password"
              type="password"
              placeholder="Create a password (min 6 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Account Type</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
              {/* Professional Card */}
              <button
                type="button"
                onClick={() => setSelectedRole('worker')}
                className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  selectedRole === 'worker'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    selectedRole === 'worker' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <User className={`h-5 w-5 ${
                      selectedRole === 'worker' ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900">I am a Professional</h4>
                      {selectedRole === 'worker' && (
                        <CheckCircle2 className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Find jobs and showcase your skills
                    </p>
                  </div>
                </div>
              </button>

              {/* Employer Card */}
              <button
                type="button"
                onClick={() => setSelectedRole('company')}
                className={`relative p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                  selectedRole === 'company'
                    ? 'border-indigo-500 bg-indigo-50 shadow-md'
                    : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${
                    selectedRole === 'company' ? 'bg-indigo-100' : 'bg-gray-100'
                  }`}>
                    <Building2 className={`h-5 w-5 ${
                      selectedRole === 'company' ? 'text-indigo-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900">I am an Employer</h4>
                      {selectedRole === 'company' && (
                        <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      Post jobs and hire talent
                    </p>
                  </div>
                </div>
              </button>
            </div>
            {!selectedRole && (
              <p className="text-xs text-red-500 mt-2">
                Please select an account type to continue
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading || !selectedRole}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Creating account...
              </div>
            ) : (
              'Create Account'
            )}
          </Button>
        </form>
      )}
    </div>
  )
}

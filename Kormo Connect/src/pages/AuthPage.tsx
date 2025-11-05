import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { CustomAuthForm } from '@/components/CustomAuthForm'
import { Briefcase, Users, Star, Zap, Shield, TrendingUp } from 'lucide-react'

export default function AuthPage() {
  const { user, userRole } = useAuth()
  const navigate = useNavigate()
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    setIsVisible(true)

    if (user && userRole) {
      // Redirect based on user role
      navigate(userRole.role === 'worker' ? '/professional/dashboard' : '/employer/dashboard')
    }
  }, [user, userRole, navigate])

  const features = [
    { icon: Star, label: 'AI-Powered Analysis', color: 'text-yellow-500' },
    { icon: Zap, label: 'Instant Matching', color: 'text-blue-500' },
    { icon: Shield, label: 'Secure & Private', color: 'text-green-500' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Main Content */}
      <div 
        className={`max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center relative z-10 transition-all duration-1000 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {/* Left Side - Branding & Info */}
        <div className="space-y-8 text-center lg:text-left">
          {/* Logo and Title */}
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center lg:justify-start space-x-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-300"></div>
                <div className="relative bg-gradient-to-br from-blue-600 to-indigo-600 p-4 rounded-2xl shadow-lg transform group-hover:scale-110 transition-transform duration-300">
                  <Briefcase className="h-10 w-10 text-white" />
                </div>
              </div>
              <div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-indigo-900 bg-clip-text text-transparent">
                  Kormo Connect
                </h1>
              </div>
            </div>
            
            <p className="text-xl text-gray-700 font-medium">
              AI-Powered Professional-Employer Matching
            </p>
            
            <p className="text-gray-600 max-w-lg mx-auto lg:mx-0 leading-relaxed">
              Connect talented professionals with perfect opportunities through intelligent job matching and comprehensive suitability analysis.
            </p>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto lg:mx-0">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 group"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <feature.icon className={`h-8 w-8 ${feature.color} mx-auto mb-2 group-hover:scale-110 transition-transform duration-300`} />
                <p className="text-sm font-medium text-gray-800">{feature.label}</p>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 max-w-md mx-auto lg:mx-0 pt-4">
            <div className="text-center">
              <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                AI
              </div>
              <div className="text-sm text-gray-600 mt-1">Powered</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                Fast
              </div>
              <div className="text-sm text-gray-600 mt-1">Matching</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Smart
              </div>
              <div className="text-sm text-gray-600 mt-1">Analysis</div>
            </div>
          </div>
        </div>

        {/* Right Side - Auth Card */}
        <div className="flex items-center justify-center">
          <div 
            className={`w-full max-w-md transition-all duration-700 delay-200 ${
              isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'
            }`}
          >
            {/* Auth Card */}
            <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-200 overflow-hidden transform hover:scale-[1.02] transition-transform duration-300">
              {/* Card Header */}
              <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-8 py-6">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <Users className="h-6 w-6 text-white" />
                  <h2 className="text-2xl font-bold text-white">Welcome</h2>
                </div>
                <p className="text-blue-100 text-center text-sm">
                  Sign in to access your dashboard
                </p>
              </div>

              {/* Auth Form */}
              <div className="p-8">
                <CustomAuthForm />
              </div>

              {/* Card Footer */}
              <div className="bg-gradient-to-br from-gray-50 to-blue-50 px-8 py-6 border-t border-gray-200">
                <div className="space-y-3 text-sm text-center">
                  <p className="text-gray-700">
                    Choose your account type during signup
                  </p>
                  <div className="flex items-center justify-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-gray-600">Professional</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      <span className="text-gray-600">Employer</span>
                    </div>
                  </div>
                </div>
                
                {/* Trust Indicators */}
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-center space-x-6 text-xs text-gray-500">
                    <div className="flex items-center space-x-1">
                      <Shield className="h-4 w-4 text-green-600" />
                      <span>Secure</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Zap className="h-4 w-4 text-blue-600" />
                      <span>Fast</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <TrendingUp className="h-4 w-4 text-purple-600" />
                      <span>Reliable</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                By signing in, you agree to our{' '}
                <a href="#" className="text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200">
                  Terms of Service
                </a>
                {' '}and{' '}
                <a href="#" className="text-blue-600 hover:text-blue-700 font-medium transition-colors duration-200">
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Custom CSS for animations */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(20px, -50px) scale(1.1); }
          50% { transform: translate(-20px, 20px) scale(0.9); }
          75% { transform: translate(50px, 50px) scale(1.05); }
        }
        
        .animate-blob {
          animation: blob 15s infinite;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  )
}

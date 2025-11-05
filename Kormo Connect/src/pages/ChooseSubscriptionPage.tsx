import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Check, Loader2, Sparkles, LogOut } from 'lucide-react'

export default function ChooseSubscriptionPage() {
  const { user, refreshProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const subscriptionPlans = [
    {
      id: 'monthly',
      name: 'Monthly Plan',
      price: '3,000',
      period: 'month',
      savings: null,
      features: [
        'Post unlimited job listings',
        'Access to professional database',
        'Performance analytics',
        'Email support',
        'Monthly billing'
      ]
    },
    {
      id: 'yearly',
      name: 'Yearly Plan',
      price: '30,000',
      period: 'year',
      savings: '6,000 BDT',
      popular: true,
      features: [
        'Post unlimited job listings',
        'Access to professional database',
        'Performance analytics',
        'Priority email support',
        'Save 6,000 BDT annually',
        'Yearly billing'
      ]
    }
  ]

  const handleChoosePlan = async (planId: string) => {
    if (!user) {
      setError('Please log in to continue')
      return
    }

    setLoading(planId)
    setError(null)

    try {
      // Show loading state for 3 seconds (simulating payment processing)
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Call the mock activation edge function
      const { data, error } = await supabase.functions.invoke('mock-activate-subscription', {
        body: {
          subscriptionPlan: planId
        }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error.message)

      // Refresh the user profile to get updated activation status
      await refreshProfile()

      // Redirect to success page
      navigate('/payment-success')
    } catch (err: any) {
      console.error('Activation error:', err)
      setError(err.message || 'Failed to activate subscription. Please try again.')
      setLoading(null)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Activate Your Kormo Connect Account
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
            Choose a subscription plan to unlock full access to Kormo Connect and start hiring talented professionals for your organization.
          </p>
          
          {/* Sign Out Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleSignOut}
              variant="outline"
              className="text-sm text-gray-600 hover:text-gray-800 border-gray-300 hover:border-gray-400"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg max-w-2xl mx-auto">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Subscription Plans */}
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {subscriptionPlans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-xl p-8 ${
                plan.popular ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-lg text-gray-600">BDT</span>
                  <span className="text-gray-500">/ {plan.period}</span>
                </div>
                {plan.savings && (
                  <p className="mt-2 text-sm font-semibold text-green-600">
                    Save {plan.savings}!
                  </p>
                )}
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleChoosePlan(plan.id)}
                disabled={loading !== null}
                className={`w-full py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all ${
                  plan.popular
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
                    : 'bg-gray-800 hover:bg-gray-900'
                }`}
              >
                {loading === plan.id ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Processing your activation...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Choose {plan.name}
                  </div>
                )}
              </Button>
            </div>
          ))}
        </div>

        {/* Payment Info */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-white rounded-lg shadow-md">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span className="font-medium">Instant Activation</span>
            </div>
          </div>
          <p className="mt-4 text-sm text-gray-500">
            Your account will be activated immediately after selection.
          </p>
        </div>
      </div>
    </div>
  )
}

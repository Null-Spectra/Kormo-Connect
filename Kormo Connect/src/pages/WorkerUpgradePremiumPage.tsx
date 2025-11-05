import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Check, Loader2, Crown, Sparkles, Star, Zap } from 'lucide-react'

export default function WorkerUpgradePremiumPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const subscriptionPlans = [
    {
      id: 'weekly',
      name: 'Weekly Plan',
      price: '399',
      period: 'week',
      duration: '7 days',
      features: [
        'Full access to AI suggestions',
        'Priority application sorting',
        'Appear first to employers',
        'Premium badge on profile',
        '7 days of premium access'
      ]
    },
    {
      id: 'monthly',
      name: 'Monthly Plan',
      price: '999',
      period: 'month',
      duration: '30 days',
      popular: true,
      savings: 'Save 60%',
      features: [
        'Full access to AI suggestions',
        'Priority application sorting',
        'Appear first to employers',
        'Premium badge on profile',
        '30 days of premium access',
        'Best value for money'
      ]
    },
    {
      id: 'yearly',
      name: 'Yearly Plan',
      price: '9,999',
      period: 'year',
      duration: '365 days',
      savings: 'Save 80%',
      features: [
        'Full access to AI suggestions',
        'Priority application sorting',
        'Appear first to employers',
        'Premium badge on profile',
        '365 days of premium access',
        'Biggest savings',
        'Maximum visibility'
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
      // Show loading for 3 seconds (mock payment processing)
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Call worker-upgrade-subscription edge function
      const { data, error } = await supabase.functions.invoke('worker-upgrade-subscription', {
        body: {
          plan: planId
        }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error.message)

      // Redirect to professional dashboard with success message
      navigate('/professional/dashboard', { 
        state: { 
          premiumUpgradeSuccess: true,
          message: 'Congratulations! Your account is now Premium.' 
        } 
      })
    } catch (err: any) {
      console.error('Upgrade error:', err)
      setError(err.message || 'Failed to upgrade subscription. Please try again.')
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full mb-4">
            <Crown className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Unlock Premium Access
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Get detailed suggestions and appear first in applications. Stand out from other professionals and get hired faster.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-lg max-w-2xl mx-auto">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Subscription Plans */}
        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
          {subscriptionPlans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl shadow-xl p-8 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1 ${
                plan.popular ? 'ring-2 ring-purple-500 scale-105' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="inline-flex items-center px-4 py-1 rounded-full text-sm font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </span>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-lg text-gray-600">BDT</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Billed every {plan.period}
                </p>
                {plan.savings && (
                  <p className="mt-2 text-sm font-semibold text-green-600">
                    {plan.savings}
                  </p>
                )}
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleChoosePlan(plan.id)}
                disabled={loading !== null}
                className={`w-full py-6 text-lg font-semibold shadow-lg hover:shadow-xl transition-all ${
                  plan.popular
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
                    : 'bg-gray-800 hover:bg-gray-900'
                }`}
              >
                {loading === plan.id ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Activating your subscription...
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Choose Plan
                  </div>
                )}
              </Button>
            </div>
          ))}
        </div>

        {/* Benefits Section */}
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-4xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Why Upgrade to Premium?
          </h3>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 rounded-full mb-3">
                <Sparkles className="h-6 w-6 text-purple-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">AI-Powered Suggestions</h4>
              <p className="text-sm text-gray-600">
                Get detailed recommendations to improve your profile and increase your chances
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-100 rounded-full mb-3">
                <Zap className="h-6 w-6 text-indigo-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Priority Placement</h4>
              <p className="text-sm text-gray-600">
                Your applications appear first when employers review candidates
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-3">
                <Crown className="h-6 w-6 text-blue-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Premium Badge</h4>
              <p className="text-sm text-gray-600">
                Stand out with a premium badge that shows your commitment to quality
              </p>
            </div>
          </div>
        </div>

        {/* Back Button */}
        <div className="mt-8 text-center">
          <Button
            variant="outline"
            onClick={() => navigate('/professional/dashboard')}
            disabled={loading !== null}
          >
            Back to Dashboard
          </Button>
        </div>
      </div>
    </div>
  )
}

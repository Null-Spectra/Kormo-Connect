import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function PaymentSuccessPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        {/* Success Icon */}
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>
        
        {/* Heading */}
        <h1 className="text-3xl font-bold text-gray-900 mb-3">
          Payment Successful!
        </h1>
        
        {/* Message */}
        <p className="text-lg text-gray-600 mb-8">
          Your account is now active. Welcome to Kormo Connect.
        </p>

        {/* Success Details */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-8 text-left">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-900 font-medium">Account Status:</span>
              <span className="text-sm text-green-700 font-semibold">Active</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-green-900 font-medium">Access Level:</span>
              <span className="text-sm text-green-700 font-semibold">Full Access</span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          onClick={() => navigate('/employer/dashboard')}
          className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all"
        >
          Go to My Dashboard
        </Button>

        {/* Additional Info */}
        <p className="mt-6 text-xs text-gray-500">
          You can now post jobs, access the professional database, and use all platform features.
        </p>
      </div>
    </div>
  )
}

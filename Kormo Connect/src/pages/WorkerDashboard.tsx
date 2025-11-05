import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase, Profile, Task, Analysis, JobApplication } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, Textarea } from '@/components/ui/forms'
import { Badge, Separator, Skeleton, Progress } from '@/components/ui/utilities'
import { CollapsibleText } from '@/components/ui/collapsible-text'
import { useToast } from '@/hooks/use-toast'
import { 
  User, Briefcase, Star, Clock, LogOut, Edit, Save, X, Upload, FileText, 
  ChevronDown, ChevronUp, TrendingUp, Target, Award, Zap, Rocket, Lock, 
  Search, Filter, Sparkles
} from 'lucide-react'
import { PerformanceDashboard } from '@/components/performance/PerformanceDashboard'

// Helper functions to determine subscription status
const isFreeUser = (profile: Profile | null): boolean => {
  if (!profile) return true
  
  // If no subscription_plan, user is free
  if (!profile.subscription_plan) return true
  
  // If subscription_status is active and not expired, user is premium
  if (profile.subscription_status === 'active') {
    // Check if subscription has expired
    if (profile.subscription_expires_on) {
      const expiresAt = new Date(profile.subscription_expires_on)
      const now = new Date()
      return expiresAt <= now // Expired, treat as free user
    }
    // Active subscription with no expiry, user is premium
    return false
  }
  
  // Any other status (free, pending, expired) means free user
  return true
}

// Helper function to check if user has valid premium subscription
const isPremiumUser = (profile: Profile | null): boolean => {
  if (!profile) return false
  
  if (profile.subscription_status !== 'active') return false
  
  const now = new Date()
  if (profile.subscription_expires_on) {
    const expiresAt = new Date(profile.subscription_expires_on)
    return expiresAt > now // Valid premium subscription
  }
  
  return false
}

// Job Level Checkbox Component
const JobLevelCheckbox = ({ level, checked, onChange }: { 
  level: string
  checked: boolean
  onChange: (checked: boolean) => void 
}) => (
  <label className="flex items-center space-x-2 cursor-pointer group">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 group-hover:border-blue-400 transition-colors"
    />
    <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
      {level}
    </span>
  </label>
)

// Search Type Toggle Component
const SearchTypeToggle = ({ value, onChange }: { 
  value: 'title' | 'keywords'
  onChange: (value: 'title' | 'keywords') => void 
}) => (
  <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
    <button
      type="button"
      onClick={() => onChange('title')}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
        value === 'title'
          ? 'bg-white text-blue-600 shadow-sm'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      Title
    </button>
    <button
      type="button"
      onClick={() => onChange('keywords')}
      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
        value === 'keywords'
          ? 'bg-white text-blue-600 shadow-sm'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      Keywords
    </button>
  </div>
)

// Loading Skeleton Component
const DashboardSkeleton = () => (
  <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
    <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    </header>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Skeleton className="h-[600px] w-full rounded-xl" />
        </div>
        <div className="lg:col-span-2 space-y-6">
          <Skeleton className="h-[200px] w-full rounded-xl" />
          <Skeleton className="h-[400px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  </div>
)

// Profile Stats Card Component
const ProfileStatsCard = React.memo(({ profile, analysisCount }: { profile: Profile | null, analysisCount: number }) => (
  <div className="grid grid-cols-3 gap-4 mb-6">
    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
      <div className="flex items-center justify-between">
        <Target className="h-5 w-5 text-blue-600" />
        <span className="text-2xl font-bold text-blue-700">{analysisCount}</span>
      </div>
      <p className="text-xs text-blue-600 mt-1 font-medium">Analyses</p>
    </div>
    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
      <div className="flex items-center justify-between">
        <Award className="h-5 w-5 text-green-600" />
        <span className="text-2xl font-bold text-green-700">
          {profile?.skills ? profile.skills.split(',').length : 0}
        </span>
      </div>
      <p className="text-xs text-green-600 mt-1 font-medium">Skills</p>
    </div>
    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
      <div className="flex items-center justify-between">
        <Zap className="h-5 w-5 text-purple-600" />
        <span className="text-2xl font-bold text-purple-700">
          {profile?.cv_url ? '100' : '0'}
        </span>
      </div>
      <p className="text-xs text-purple-600 mt-1 font-medium">Profile %</p>
    </div>
  </div>
))

// Task Card Component with Performance Optimization
const TaskCard = React.memo(({ 
  task, 
  analysis, 
  isAnalyzing, 
  onAnalyze, 
  isExpanded, 
  onToggleExpand,
  hasCv,
  profile,
  hasApplied,
  onApplyClick,
  isApplying
}: { 
  task: Task
  analysis: Analysis | undefined
  isAnalyzing: boolean
  onAnalyze: (taskId: string) => void
  isExpanded: boolean
  onToggleExpand: (taskId: string) => void
  hasCv: boolean
  profile: Profile | null
  hasApplied: boolean
  onApplyClick: (taskId: string, taskTitle: string) => void
  isApplying: boolean
}) => {
  const navigate = useNavigate()
  const formatScore = (score: number) => Math.round(score * 100)
  const score = analysis?.analysis_result?.score || 0
  const scorePercent = formatScore(score)
  
  // Determine score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'from-green-500 to-emerald-600'
    if (score >= 0.6) return 'from-blue-500 to-blue-600'
    if (score >= 0.4) return 'from-yellow-500 to-orange-600'
    return 'from-red-500 to-red-600'
  }

  return (
    <div className="group border border-gray-200 rounded-xl p-6 bg-white hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-lg text-gray-900 group-hover:text-blue-600 transition-colors">
              {task.title}
            </h3>
            {task.is_boosted && task.boost_expires_at && new Date(task.boost_expires_at) > new Date() && (
              <Badge variant="outline" className="bg-gradient-to-r from-orange-50 to-red-50 text-orange-700 border-orange-300 text-xs flex items-center gap-1">
                <Rocket className="h-3 w-3" />
                Featured
              </Badge>
            )}
          </div>
          {analysis && (
            <div className="mt-2 flex items-center">
              <div className="flex-1 mr-3">
                <Progress value={scorePercent} className="h-2" />
              </div>
              <Badge 
                variant="outline" 
                className={`bg-gradient-to-r ${getScoreColor(score)} text-white border-0 shadow-sm`}
              >
                <Star className="h-3 w-3 mr-1" />
                {scorePercent}%
              </Badge>
            </div>
          )}
        </div>
      </div>
      
      <div className="mb-4">
        <CollapsibleText 
          text={task.description} 
          maxLength={180}
          className="text-sm"
        />
      </div>
      
      <div className="flex flex-wrap gap-2 mb-4">
        {task.required_skills && (
          <Badge variant="secondary" className="text-xs">
            <Briefcase className="h-3 w-3 mr-1" />
            {task.required_skills}
          </Badge>
        )}
        {task.experience_level && (
          <Badge variant="secondary" className="text-xs">
            <TrendingUp className="h-3 w-3 mr-1" />
            {task.experience_level}
          </Badge>
        )}
        {(task.budget_min && task.budget_max) && (
          <Badge variant="secondary" className="text-xs bg-green-50 text-green-700 border-green-200">
            <span className="text-green-600 mr-1">💰</span>
            {task.currency ? `${task.currency} ${task.budget_min} - ${task.budget_max}` : `$${task.budget_min} - $${task.budget_max}`}
          </Badge>
        )}
      </div>

      {analysis ? (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 mt-4 border border-gray-200">
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => onToggleExpand(task.id)}
          >
            <h4 className="font-medium flex items-center text-gray-900">
              <Star className="h-4 w-4 mr-2 text-yellow-500" />
              Analysis Results
            </h4>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onAnalyze(task.id)
                }}
                disabled={isAnalyzing || hasApplied}
                className="text-xs h-8"
              >
                {isAnalyzing ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-1"></div>
                    Analyzing...
                  </>
                ) : (
                  'Re-analyze'
                )}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onApplyClick(task.id, task.title)
                }}
                disabled={isApplying || hasApplied}
                className={`text-xs h-8 ${hasApplied 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isApplying ? (
                  <>
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-1"></div>
                    Applying...
                  </>
                ) : hasApplied ? (
                  'Applied'
                ) : (
                  'Apply'
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          {isExpanded && (
            <div className="space-y-3 text-sm mt-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="bg-white rounded-md p-3 border border-gray-200">
                <span className="font-medium text-gray-700">Suitability Score: </span>
                <span className="text-blue-600 font-semibold">
                  {scorePercent}%
                </span>
              </div>
              {analysis.analysis_result?.strengths && (
                <div className="bg-white rounded-md p-3 border border-green-200">
                  <span className="font-medium text-gray-700 flex items-center mb-2">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    Strengths:
                  </span>
                  <div className="text-green-700">
                    {Array.isArray(analysis.analysis_result.strengths) ? (
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        {analysis.analysis_result.strengths.map((item, index) => (
                          <li key={index} className="text-sm">{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-sm">{analysis.analysis_result.strengths}</span>
                    )}
                  </div>
                </div>
              )}
              {analysis.analysis_result?.weaknesses && (
                <div className="bg-white rounded-md p-3 border border-orange-200">
                  <span className="font-medium text-gray-700 flex items-center mb-2">
                    <span className="inline-block w-2 h-2 bg-orange-500 rounded-full mr-2"></span>
                    Areas to Improve:
                  </span>
                  <div className="text-orange-700">
                    {Array.isArray(analysis.analysis_result.weaknesses) ? (
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        {analysis.analysis_result.weaknesses.map((item, index) => (
                          <li key={index} className="text-sm">{item}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-sm">{analysis.analysis_result.weaknesses}</span>
                    )}
                  </div>
                </div>
              )}
              {analysis.analysis_result?.suggestions && (
                <div className="relative">
                  <div className={`bg-white rounded-md p-3 border border-blue-200 ${isFreeUser(profile) ? 'blur-sm' : ''}`}>
                    <span className="font-medium text-gray-700 flex items-center mb-2">
                      <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                      Suggestions:
                    </span>
                    <div className="text-blue-700">
                      {Array.isArray(analysis.analysis_result.suggestions) ? (
                        <ul className="list-disc list-inside space-y-1 ml-2">
                          {analysis.analysis_result.suggestions.map((item, index) => (
                            <li key={index} className="text-sm">{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-sm">{analysis.analysis_result.suggestions}</span>
                      )}
                    </div>
                  </div>
                  {isFreeUser(profile) && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-md">
                      <div className="text-center px-4 py-3">
                        <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
                          <Lock className="h-6 w-6 text-white" />
                        </div>
                        <p className="font-semibold text-gray-900 mb-1 text-sm">
                          This is a Premium feature
                        </p>
                        <p className="text-xs text-gray-600 mb-3">
                          Upgrade to access personalized suggestions
                        </p>
                        <Button
                          size="sm"
                          onClick={() => navigate('/professional/upgrade-premium')}
                          className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 shadow-md text-xs"
                        >
                          Upgrade to Premium
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-center text-xs text-gray-500 mt-3">
                <Clock className="h-3 w-3 mr-1" />
                Analyzed on {new Date(analysis.created_at).toLocaleDateString()}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-3">
          {!hasCv && (
            <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start">
                <FileText className="h-4 w-4 text-amber-600 mr-2 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  <span className="font-semibold">CV Required:</span> Please upload your CV/Resume to analyze jobs
                </p>
              </div>
            </div>
          )}
          <Button
            onClick={() => onAnalyze(task.id)}
            disabled={isAnalyzing || !hasCv}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Analyzing...
              </>
            ) : (
              <>
                <Star className="h-4 w-4 mr-2" />
                Analyze Suitability
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
})

export default function WorkerDashboard() {
  const { user, signOut } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [jobApplications, setJobApplications] = useState<JobApplication[]>([])
  const [loading, setLoading] = useState(true)
  const [editingProfile, setEditingProfile] = useState(false)
  const [analyzingTask, setAnalyzingTask] = useState<string | null>(null)
  const [applyingTask, setApplyingTask] = useState<string | null>(null)
  const [showApplyConfirm, setShowApplyConfirm] = useState<{taskId: string, taskTitle: string} | null>(null)
  const [uploadingCV, setUploadingCV] = useState(false)
  const [readingCV, setReadingCV] = useState(false)
  const [expandedAnalyses, setExpandedAnalyses] = useState<Set<string>>(new Set())
  const [showAutoFillModal, setShowAutoFillModal] = useState(false)
  const [analyzingCV, setAnalyzingCV] = useState(false)
  const [pendingCVData, setPendingCVData] = useState<{file: File, base64: string} | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('')
  const [searchType, setSearchType] = useState<'title' | 'keywords'>('title')
  const [selectedLevels, setSelectedLevels] = useState<string[]>([])
  const [findingMatches, setFindingMatches] = useState(false)

  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    skills: '',
    experience: '',
    education: '',
    phone: ''
  })

  useEffect(() => {
    if (user) {
      fetchProfile()
      fetchTasks()
      fetchAnalyses()
      fetchJobApplications()
    }
  }, [user])

  // Handle premium upgrade success message
  useEffect(() => {
    if (location.state?.premiumUpgradeSuccess) {
      toast({
        variant: "success",
        title: "Premium Activated!",
        description: location.state.message || "Your account is now Premium."
      })
      // Clear the state to prevent showing toast again on refresh
      window.history.replaceState({}, document.title)
    }
  }, [location, toast])

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching profile:', error)
        return
      }

      setProfile(data)
      if (data) {
        setProfileForm({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          skills: data.skills || '',
          experience: data.experience || '',
          education: data.education || '',
          phone: data.phone || ''
        })
      }
    } catch (error) {
      console.error('Error in fetchProfile:', error)
    }
  }

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_public', true)

      if (error) {
        console.error('Error fetching tasks:', error)
        return
      }

      // Sort tasks: Boosted tasks first (by created_at ascending), then regular tasks (by created_at descending)
      const now = new Date()
      const sortedTasks = (data || []).sort((a, b) => {
        const aIsBoosted = a.is_boosted && a.boost_expires_at && new Date(a.boost_expires_at) > now
        const bIsBoosted = b.is_boosted && b.boost_expires_at && new Date(b.boost_expires_at) > now

        // Both boosted or both not boosted
        if (aIsBoosted === bIsBoosted) {
          // If both boosted, sort by created_at ascending (oldest first)
          if (aIsBoosted) {
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
          }
          // If both not boosted, sort by created_at descending (newest first)
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        }

        // Boosted tasks always come first
        return aIsBoosted ? -1 : 1
      })

      setTasks(sortedTasks)
    } catch (error) {
      console.error('Error in fetchTasks:', error)
    }
  }

  const fetchAnalyses = async () => {
    try {
      const { data, error } = await supabase
        .from('analyses')
        .select('*')
        .eq('worker_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching analyses:', error)
        return
      }

      setAnalyses(data || [])
      setLoading(false)
    } catch (error) {
      console.error('Error in fetchAnalyses:', error)
      setLoading(false)
    }
  }

  const fetchJobApplications = async () => {
    try {
      const { data, error } = await supabase
        .from('job_applications')
        .select('*')
        .eq('worker_id', user?.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching job applications:', error)
        return
      }

      setJobApplications(data || [])
    } catch (error) {
      console.error('Error in fetchJobApplications:', error)
    }
  }

  const hasAppliedForTask = useCallback((taskId: string) => {
    return jobApplications.some(app => app.task_id === taskId)
  }, [jobApplications])

  const handleApplyClick = useCallback((taskId: string, taskTitle: string) => {
    setShowApplyConfirm({ taskId, taskTitle })
  }, [])

  const handleApplyConfirm = useCallback(async () => {
    if (!showApplyConfirm) return

    setApplyingTask(showApplyConfirm.taskId)
    
    try {
      const response = await supabase.functions.invoke('apply-for-job', {
        body: {
          taskId: showApplyConfirm.taskId
        }
      })

      if (response.error) {
        console.error('Error applying for job:', response.error)
        toast({
          variant: "destructive",
          title: "Application Failed",
          description: response.error.message || 'Failed to apply for job. Please try again.'
        })
        return
      }

      await fetchJobApplications()
      
      toast({
        variant: "success",
        title: "Application Submitted!",
        description: "Your application has been submitted successfully. The employer can now see your analysis."
      })
    } catch (error) {
      console.error('Error in handleApplyConfirm:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to apply for job. Please try again."
      })
    } finally {
      setApplyingTask(null)
      setShowApplyConfirm(null)
    }
  }, [showApplyConfirm, toast])

  const handleApplyCancel = useCallback(() => {
    setShowApplyConfirm(null)
  }, [])

  const updateProfile = useCallback(async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user?.id,
          ...profileForm
        })

      if (error) {
        console.error('Error updating profile:', error)
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update profile. Please try again."
        })
        return
      }

      await fetchProfile()
      setEditingProfile(false)
      toast({
        variant: "success",
        title: "Success",
        description: "Profile updated successfully!"
      })
    } catch (error) {
      console.error('Error in updateProfile:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update profile. Please try again."
      })
    }
  }, [profileForm, user, toast])

  const handleCVUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Support multiple file formats now
    const supportedFormats = ['.pdf', '.doc', '.docx', '.txt']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    
    if (!supportedFormats.includes(fileExtension)) {
      toast({
        variant: "destructive",
        title: "Invalid File",
        description: "Please upload a PDF, DOC, DOCX, or TXT file only"
      })
      return
    }

    if (file.size > 10485760) {
      toast({
        variant: "destructive",
        title: "File Too Large",
        description: "File size must be less than 10MB"
      })
      return
    }

    // Show loading while reading file - delay for visibility
    setReadingCV(true)
    
    // Add a small delay to show the reading animation
    setTimeout(() => {
      // Convert file to base64 for analysis
      try {
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64 = reader.result as string
          // Store the file and base64 data for later processing
          setPendingCVData({ file, base64 })
          setReadingCV(false)
          // Show the auto-fill modal
          setShowAutoFillModal(true)
        }
        reader.onerror = () => {
          setReadingCV(false)
          toast({
            variant: "destructive",
            title: "File Error",
            description: "Failed to read file. Please try again."
          })
        }
        reader.readAsDataURL(file)
      } catch (error) {
        setReadingCV(false)
        console.error('Error reading file:', error)
        toast({
          variant: "destructive",
          title: "File Error",
          description: "Failed to read file. Please try again."
        })
      } finally {
        // Clear the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    }, 1000) // 1 second delay to show loading animation
  }, [toast])

  const handleAutoFillAccept = useCallback(async () => {
    if (!pendingCVData) return

    // Keep modal open during analysis phase
    setAnalyzingCV(true)
    setUploadingCV(true)

    try {
      // First upload the CV to storage
      const uploadResponse = await supabase.functions.invoke('upload-cv', {
        body: {
          cvData: pendingCVData.base64,
          filename: pendingCVData.file.name
        }
      })

      if (uploadResponse.error) {
        console.error('CV upload error:', uploadResponse.error)
        setUploadingCV(false)
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: "Failed to upload CV. Please try again."
        })
        return
      }

      // Mark upload complete, now analyzing
      setUploadingCV(false)

      // Then analyze the CV with Gemini AI
      const analysisResponse = await supabase.functions.invoke('analyze-cv', {
        body: {
          cvFile: pendingCVData.base64,
          filename: pendingCVData.file.name
        }
      })

      if (analysisResponse.error) {
        console.error('CV analysis error:', analysisResponse.error)
        setAnalyzingCV(false)
        toast({
          variant: "destructive",
          title: "Analysis Failed",
          description: "Failed to analyze CV. Please try again."
        })
        return
      }

      // Update the profile form with extracted data
      const extractedData = analysisResponse.data?.data?.extracted_data
      if (extractedData) {
        setProfileForm({
          first_name: extractedData.first_name || '',
          last_name: extractedData.last_name || '',
          skills: extractedData.skills || '',
          experience: extractedData.experience || '',
          education: extractedData.education || '',
          phone: extractedData.phone || ''
        })
        setEditingProfile(true)
        toast({
          variant: "success",
          title: "Auto-Fill Complete",
          description: "Your profile has been auto-filled with CV data. Please review and save."
        })
      }

      await fetchProfile()
      toast({
        variant: "success",
        title: "Success",
        description: "CV uploaded and analyzed successfully!"
      })
    } catch (error) {
      console.error('Error in auto-fill process:', error)
      setAnalyzingCV(false)
      setUploadingCV(false)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to process CV. Please try again."
      })
    } finally {
      setAnalyzingCV(false)
      setUploadingCV(false)
      setPendingCVData(null)
      setShowAutoFillModal(false)
    }
  }, [pendingCVData, toast])

  const handleAutoFillDecline = useCallback(async () => {
    if (!pendingCVData) {
      setShowAutoFillModal(false)
      setReadingCV(false)
      setUploadingCV(false)
      return
    }

    // User wants to upload CV but skip auto-fill
    setUploadingCV(true)
    setShowAutoFillModal(false)

    try {
      // Upload the CV to storage
      const uploadResponse = await supabase.functions.invoke('upload-cv', {
        body: {
          cvData: pendingCVData.base64,
          filename: pendingCVData.file.name
        }
      })

      if (uploadResponse.error) {
        console.error('CV upload error:', uploadResponse.error)
        setUploadingCV(false)
        toast({
          variant: "destructive",
          title: "Upload Failed",
          description: "Failed to upload CV. Please try again."
        })
        return
      }

      setUploadingCV(false)
      toast({
        variant: "success",
        title: "CV Uploaded Successfully",
        description: "Your CV has been uploaded. You can now manually edit your profile."
      })
      
    } catch (error) {
      console.error('Error uploading CV:', error)
      setUploadingCV(false)
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: "Failed to upload CV. Please try again."
      })
    } finally {
      setPendingCVData(null)
      setReadingCV(false)
      setUploadingCV(false)
      fetchProfile()
    }
  }, [pendingCVData, toast])

  const toggleAnalysisExpansion = useCallback((taskId: string) => {
    setExpandedAnalyses(prev => {
      const newSet = new Set(prev)
      if (newSet.has(taskId)) {
        newSet.delete(taskId)
      } else {
        newSet.add(taskId)
      }
      return newSet
    })
  }, [])

  const getRemainingAnalyses = useMemo(() => {
    const isFree = isFreeUser(profile)
    const maxLimit = isFree ? 3 : 10
    
    if (!profile?.last_analysis_time || !profile?.analysis_count_this_minute) {
      return maxLimit
    }

    const lastAnalysisTime = new Date(profile.last_analysis_time).getTime()
    const now = Date.now()
    const oneMinute = 60 * 1000

    if (now - lastAnalysisTime > oneMinute) {
      return maxLimit
    }

    return Math.max(0, maxLimit - profile.analysis_count_this_minute)
  }, [profile?.last_analysis_time, profile?.analysis_count_this_minute, profile])

  // Filter tasks based on search term and selected levels
  const filteredTasks = useMemo(() => {
    let filtered = [...tasks]

    // Apply search filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim()
      filtered = filtered.filter(task => {
        if (searchType === 'title') {
          return task.title.toLowerCase().includes(searchLower)
        } else {
          // Keywords: Split search term into individual words and check if ANY match
          const searchKeywords = searchLower.split(/\s+/).filter(keyword => keyword.length > 0)
          
          // Check if ANY keyword matches title, description, or required_skills
          return searchKeywords.some(keyword => {
            const titleMatch = task.title.toLowerCase().includes(keyword)
            const descriptionMatch = task.description.toLowerCase().includes(keyword)
            const skillsMatch = task.required_skills?.toLowerCase().includes(keyword) || false
            
            return titleMatch || descriptionMatch || skillsMatch
          })
        }
      })
    }

    // Apply level filter
    if (selectedLevels.length > 0) {
      filtered = filtered.filter(task => {
        return selectedLevels.includes(task.experience_level || '')
      })
    }

    // Maintain existing sorting: boosted tasks first (by created_at ascending), then regular tasks (by created_at descending)
    const now = new Date()
    return filtered.sort((a, b) => {
      const aIsBoosted = a.is_boosted && a.boost_expires_at && new Date(a.boost_expires_at) > now
      const bIsBoosted = b.is_boosted && b.boost_expires_at && new Date(b.boost_expires_at) > now

      // Both boosted or both not boosted
      if (aIsBoosted === bIsBoosted) {
        // If both boosted, sort by created_at ascending (oldest first)
        if (aIsBoosted) {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        }
        // If both not boosted, sort by created_at descending (newest first)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }

      // Boosted tasks always come first
      return aIsBoosted ? -1 : 1
    })
  }, [tasks, searchTerm, searchType, selectedLevels])

  // Helper function to handle level filter changes
  const handleLevelChange = (level: string, checked: boolean) => {
    setSelectedLevels(prev => {
      if (checked) {
        return [...prev, level]
      } else {
        return prev.filter(l => l !== level)
      }
    })
  }

  const analyzeTask = useCallback(async (taskId: string) => {
    if (!profile?.cv_url) {
      toast({
        variant: "destructive",
        title: "CV Required",
        description: "Please upload your CV/Resume before analyzing jobs."
      })
      return
    }

    if (!profile || !profileForm.skills || !profileForm.experience) {
      toast({
        variant: "destructive",
        title: "Incomplete Profile",
        description: "Please complete your profile first to get job analysis."
      })
      return
    }

    if (getRemainingAnalyses <= 0) {
      toast({
        variant: "destructive",
        title: "Rate Limit",
        description: isFreeUser(profile) ? "Rate limit reached. You can perform 3 analyses per minute. Please wait and try again." : "Rate limit reached. You can perform 10 analyses per minute. Please wait and try again."
      })
      return
    }

    setAnalyzingTask(taskId)

    try {
      const task = tasks.find(t => t.id === taskId)
      if (!task) return

      const response = await supabase.functions.invoke('analyze-suitability', {
        body: {
          taskId,
          profile: profileForm
        }
      })

      if (response.error) {
        console.error('Error analyzing task:', response.error)
        const errorMsg = response.error.message || 'Error analyzing job. Please try again.'
        toast({
          variant: "destructive",
          title: "Analysis Failed",
          description: errorMsg
        })
        return
      }

      await fetchAnalyses()
      await fetchProfile()
      
      toast({
        variant: "success",
        title: "Success",
        description: "Job analysis completed successfully!"
      })
    } catch (error) {
      console.error('Error in analyzeTask:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error analyzing job. Please try again."
      })
    } finally {
      setAnalyzingTask(null)
    }
  }, [profile, profileForm, getRemainingAnalyses, tasks, toast])

  const getAnalysisForTask = useCallback((taskId: string) => {
    return analyses.find(a => a.task_id === taskId)
  }, [analyses])

  const handleFindBestMatches = useCallback(async () => {
    if (!profile) {
      toast({
        variant: "destructive",
        title: "Profile Not Found",
        description: "Please refresh the page and try again."
      })
      return
    }

    // Check if profile has minimum required information
    if (!profile.skills && !profile.experience && !profile.education) {
      toast({
        variant: "destructive",
        title: "Incomplete Profile",
        description: "Please complete your profile with skills, experience, or education to use this feature."
      })
      return
    }

    setFindingMatches(true)

    try {
      const response = await supabase.functions.invoke('find-best-matches', {
        body: {}
      })

      if (response.error) {
        console.error('Error finding best matches:', response.error)
        toast({
          variant: "destructive",
          title: "Failed to Find Matches",
          description: response.error.message || 'Unable to analyze your profile. Please try again.'
        })
        return
      }

      const { keywords, level } = response.data.data

      // Auto-populate search field with keywords
      if (keywords && keywords.length > 0) {
        const searchQuery = keywords.join(' ')
        setSearchTerm(searchQuery)
        setSearchType('keywords') // Switch to keywords mode for better matching
      }

      // Auto-select job level filter
      if (level) {
        setSelectedLevels([level])
      }

      toast({
        variant: "success",
        title: "Best Matches Found!",
        description: `Search updated with: ${keywords.join(', ')} | Level: ${level}`
      })

    } catch (error) {
      console.error('Error in handleFindBestMatches:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to find best matches. Please try again."
      })
    } finally {
      setFindingMatches(false)
    }
  }, [profile, toast])

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md mr-3">
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Professional Dashboard
                </h1>
                <p className="text-xs text-gray-500">
                  Discover your perfect match
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">
                  {profile?.first_name || user?.email}
                </p>
                {isPremiumUser(profile) ? (
                  <p className="text-xs text-purple-600 font-semibold flex items-center justify-end gap-1">
                    <Star className="h-3 w-3 fill-purple-600" />
                    Premium Member
                  </p>
                ) : (
                  <p className="text-xs text-gray-500">{user?.email}</p>
                )}
              </div>
              {isFreeUser(profile) && (
                <Button
                  size="sm"
                  onClick={() => navigate('/professional/upgrade-premium')}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all flex items-center gap-1"
                >
                  <Zap className="h-4 w-4" />
                  <span className="hidden sm:inline">Upgrade to Premium</span>
                  <span className="sm:hidden">Upgrade</span>
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="flex items-center hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Section */}
          <div className="lg:col-span-1">
            <Card className="shadow-xl border-0 bg-white/90 backdrop-blur">
              <CardHeader className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center text-white">
                    <User className="h-5 w-5 mr-2" />
                    Profile
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (editingProfile) {
                        setEditingProfile(false)
                        setProfileForm({
                          first_name: profile?.first_name || '',
                          last_name: profile?.last_name || '',
                          skills: profile?.skills || '',
                          experience: profile?.experience || '',
                          education: profile?.education || '',
                          phone: profile?.phone || ''
                        })
                      } else {
                        setEditingProfile(true)
                      }
                    }}
                    className="bg-white/20 text-white border-white/30 hover:bg-white/30"
                  >
                    {editingProfile ? (
                      <>
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                      </>
                    ) : (
                      <>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </>
                    )}
                  </Button>
                </div>
                <CardDescription className="text-blue-100">
                  Complete your profile for accurate analysis
                </CardDescription>
              </CardHeader>
              
              {/* Auto-Fill Modal */}
              {showAutoFillModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-auto transform transition-all">
                    <div className="p-6">
                      <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full mx-auto mb-4 shadow-lg">
                        <FileText className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-center text-gray-900 mb-3">
                        Auto-Fill Profile?
                      </h3>
                      <p className="text-gray-600 text-center mb-6 leading-relaxed">
                        I can analyze your CV using AI to automatically fill your profile with skills, experience, education, and other details. Would you like me to do this?
                      </p>
                      {(analyzingCV || uploadingCV) && (
                        <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                          <div className="flex items-center justify-center mb-3">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                          </div>
                          <p className="text-center text-blue-700 text-sm font-medium">
                            {uploadingCV ? 'Uploading CV...' : 'Analyzing your CV with AI...'}
                          </p>
                          <p className="text-center text-blue-600 text-xs mt-1">
                            {uploadingCV 
                              ? 'Storing your CV securely' 
                              : 'Extracting skills, experience, and education details'
                            }
                          </p>
                        </div>
                      )}
                      <div className="space-y-3">
                        <Button
                          onClick={handleAutoFillAccept}
                          disabled={analyzingCV || uploadingCV}
                          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg transition-all"
                        >
                          {analyzingCV || uploadingCV ? (
                            <div className="flex items-center justify-center w-full">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              {uploadingCV ? 'Uploading CV...' : 'Analyzing CV...'}
                            </div>
                          ) : (
                            <>
                              <Zap className="h-4 w-4 mr-2" />
                              Yes, Auto-Fill My Profile
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={handleAutoFillDecline}
                          variant="outline"
                          disabled={analyzingCV || uploadingCV}
                          className="w-full hover:bg-gray-50"
                        >
                          No, I'll Fill Manually
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <CardContent className="space-y-4 pt-6">
                <ProfileStatsCard profile={profile} analysisCount={analyses.length} />
                
                {/* Premium Status Badge */}
                {isPremiumUser(profile) && profile?.subscription_expires_on && (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-lg p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 shadow-md">
                        <Star className="h-5 w-5 text-white fill-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-purple-900 flex items-center gap-1">
                          Premium Member
                        </h4>
                        <p className="text-xs text-purple-700">
                          Expires: {new Date(profile.subscription_expires_on).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Free User Upgrade Prompt */}
                {profile?.subscription_status === 'free' && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 shadow-md flex-shrink-0">
                        <Zap className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-amber-900 mb-1">
                          Unlock Premium Features
                        </h4>
                        <p className="text-xs text-amber-700 mb-3">
                          Get AI suggestions, priority placement, and premium badge
                        </p>
                        <Button
                          size="sm"
                          onClick={() => navigate('/professional/upgrade-premium')}
                          className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white shadow-md"
                        >
                          <Star className="h-4 w-4 mr-2" />
                          Upgrade to Premium
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                
                {editingProfile ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="first_name" className="text-gray-700">First Name</Label>
                        <Input
                          id="first_name"
                          value={profileForm.first_name}
                          onChange={(e) => setProfileForm(prev => ({
                            ...prev,
                            first_name: e.target.value
                          }))}
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="last_name" className="text-gray-700">Last Name</Label>
                        <Input
                          id="last_name"
                          value={profileForm.last_name}
                          onChange={(e) => setProfileForm(prev => ({
                            ...prev,
                            last_name: e.target.value
                          }))}
                          className="mt-1"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-gray-700">Phone</Label>
                      <Input
                        id="phone"
                        value={profileForm.phone}
                        onChange={(e) => setProfileForm(prev => ({
                          ...prev,
                          phone: e.target.value
                        }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="skills" className="text-gray-700">Skills</Label>
                      <Textarea
                        id="skills"
                        placeholder="e.g., JavaScript, React, Node.js, Project Management"
                        value={profileForm.skills}
                        onChange={(e) => setProfileForm(prev => ({
                          ...prev,
                          skills: e.target.value
                        }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="experience" className="text-gray-700">Experience</Label>
                      <Textarea
                        id="experience"
                        placeholder="Describe your work experience and achievements"
                        value={profileForm.experience}
                        onChange={(e) => setProfileForm(prev => ({
                          ...prev,
                          experience: e.target.value
                        }))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="education" className="text-gray-700">Education</Label>
                      <Textarea
                        id="education"
                        placeholder="Your educational background"
                        value={profileForm.education}
                        onChange={(e) => setProfileForm(prev => ({
                          ...prev,
                          education: e.target.value
                        }))}
                        className="mt-1"
                      />
                    </div>
                    <Button 
                      onClick={updateProfile}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save Profile
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
                      <p className="font-semibold text-gray-900 text-lg">
                        {profile?.first_name || profile?.last_name 
                          ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
                          : 'Name not set'
                        }
                      </p>
                      <p className="text-sm text-gray-600">{user?.email}</p>
                      {profile?.phone && (
                        <p className="text-sm text-gray-600">{profile.phone}</p>
                      )}
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-2 text-gray-900 flex items-center">
                        <Award className="h-4 w-4 mr-2 text-blue-600" />
                        Skills
                      </h4>
                      <p className="text-sm text-gray-600 bg-blue-50 rounded-md p-3 border border-blue-100">
                        {profile?.skills || 'No skills added yet'}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2 text-gray-900 flex items-center">
                        <Briefcase className="h-4 w-4 mr-2 text-green-600" />
                        Experience
                      </h4>
                      <p className="text-sm text-gray-600 bg-green-50 rounded-md p-3 border border-green-100">
                        {profile?.experience || 'No experience added yet'}
                      </p>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-2 text-gray-900 flex items-center">
                        <Target className="h-4 w-4 mr-2 text-purple-600" />
                        Education
                      </h4>
                      <p className="text-sm text-gray-600 bg-purple-50 rounded-md p-3 border border-purple-100">
                        {profile?.education || 'No education added yet'}
                      </p>
                    </div>
                    <Separator />
                    <div>
                      <h4 className="font-semibold mb-3 flex items-center text-gray-900">
                        <FileText className="h-4 w-4 mr-2 text-orange-600" />
                        CV/Resume
                      </h4>
                      {profile?.cv_url ? (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                            <div className="flex items-center">
                              <FileText className="h-4 w-4 text-green-600 mr-2" />
                              <div>
                                <p className="text-sm font-medium text-green-900">
                                  {profile.cv_filename}
                                </p>
                                <p className="text-xs text-green-600">
                                  Uploaded {new Date(profile.cv_uploaded_at || '').toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingCV}
                            className="w-full"
                          >
                            {uploadingCV || readingCV ? (
                              <div className="flex items-center justify-center w-full">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                                {readingCV ? 'Reading File...' : 'Uploading CV...'}
                              </div>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Replace CV
                              </>
                            )}
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-lg p-4">
                            <div className="flex items-start mb-2">
                              <div className="flex-shrink-0">
                                <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                                  <FileText className="h-4 w-4 text-red-600" />
                                </div>
                              </div>
                              <div className="ml-3">
                                <h5 className="text-sm font-semibold text-red-900 mb-1">
                                  CV Required
                                </h5>
                                <p className="text-xs text-red-700">
                                  You must upload your CV/Resume before you can analyze jobs. This helps provide accurate suitability assessments.
                                </p>
                              </div>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingCV}
                            className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 shadow-md hover:shadow-lg transition-all"
                          >
                            {uploadingCV || readingCV ? (
                              <div className="flex items-center justify-center w-full">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                {readingCV ? 'Reading File...' : 'Uploading CV...'}
                              </div>
                            ) : (
                              <>
                                <Upload className="h-4 w-4 mr-2" />
                                Upload CV Now
                              </>
                            )}
                          </Button>
                          <p className="text-xs text-center text-gray-500">
                            PDF, DOC, DOCX, or TXT, max 10MB
                          </p>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.txt"
                        onChange={handleCVUpload}
                        className="hidden"
                      />
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Jobs and Analysis Section */}
          <div className="lg:col-span-2 space-y-6">
            {/* Performance Dashboard */}
            <PerformanceDashboard workerId={user?.id || ''} />
            
            <Card className="shadow-xl border-0 bg-white/90 backdrop-blur">
              <CardHeader className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center text-white">
                      <Briefcase className="h-5 w-5 mr-2" />
                      Available Jobs
                    </CardTitle>
                    <CardDescription className="text-indigo-100">
                      Analyze your suitability for available positions
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="text-sm bg-white/20 text-white border-white/30">
                    {getRemainingAnalyses} / {isFreeUser(profile) ? 3 : 10} remaining
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {/* Find Best Matches Button */}
                <div className="mb-4">
                  <Button
                    onClick={handleFindBestMatches}
                    disabled={findingMatches || !profile?.skills && !profile?.experience && !profile?.education}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {findingMatches ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        AI is analyzing your profile...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Find Best Matches for Me
                      </>
                    )}
                  </Button>
                  {!profile?.skills && !profile?.experience && !profile?.education && (
                    <p className="text-xs text-center text-gray-500 mt-2">
                      Complete your profile to use AI-powered job matching
                    </p>
                  )}
                </div>
                
                {/* Search and Filter Bar */}
                <div className="bg-gradient-to-r from-gray-50 to-blue-50 rounded-lg p-4 mb-6 border border-gray-200">
                  <div className="space-y-4">
                    {/* Search Section */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          type="text"
                          placeholder="Search for jobs..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Search by:</span>
                        <SearchTypeToggle value={searchType} onChange={setSearchType} />
                      </div>
                    </div>
                    
                    {/* Filter Section */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center space-x-2">
                        <Filter className="h-4 w-4 text-gray-600" />
                        <span className="text-sm font-medium text-gray-700">Job Level:</span>
                      </div>
                      <div className="flex flex-wrap gap-4">
                        <JobLevelCheckbox
                          level="Entry"
                          checked={selectedLevels.includes('Entry')}
                          onChange={(checked) => handleLevelChange('Entry', checked)}
                        />
                        <JobLevelCheckbox
                          level="Intermediate"
                          checked={selectedLevels.includes('Intermediate')}
                          onChange={(checked) => handleLevelChange('Intermediate', checked)}
                        />
                        <JobLevelCheckbox
                          level="Senior"
                          checked={selectedLevels.includes('Senior')}
                          onChange={(checked) => handleLevelChange('Senior', checked)}
                        />
                        <JobLevelCheckbox
                          level="Expert"
                          checked={selectedLevels.includes('Expert')}
                          onChange={(checked) => handleLevelChange('Expert', checked)}
                        />
                      </div>
                    </div>
                    
                    {/* Results Summary */}
                    {(searchTerm.trim() || selectedLevels.length > 0) && (
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <p className="text-sm text-gray-600">
                          Showing <span className="font-semibold text-gray-900">{filteredTasks.length}</span> of <span className="font-semibold text-gray-900">{tasks.length}</span> jobs
                        </p>
                        {(searchTerm.trim() || selectedLevels.length > 0) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSearchTerm('')
                              setSelectedLevels([])
                            }}
                            className="text-xs"
                          >
                            <X className="h-3 w-3 mr-1" />
                            Clear Filters
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Tasks List */}
                <div className="space-y-4">
                  {filteredTasks.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Briefcase className="h-10 w-10 text-gray-400" />
                      </div>
                      <p className="text-gray-600 font-medium">
                        {tasks.length === 0 ? 'No jobs available at the moment' : 'No jobs match your search criteria'}
                      </p>
                      <p className="text-gray-500 text-sm mt-1">
                        {tasks.length === 0 ? 'Check back later for new opportunities' : 'Try adjusting your search or filters'}
                      </p>
                    </div>
                  ) : (
                    filteredTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        analysis={getAnalysisForTask(task.id)}
                        isAnalyzing={analyzingTask === task.id}
                        onAnalyze={analyzeTask}
                        isExpanded={expandedAnalyses.has(task.id)}
                        onToggleExpand={toggleAnalysisExpansion}
                        hasCv={!!profile?.cv_url}
                        profile={profile}
                        hasApplied={hasAppliedForTask(task.id)}
                        onApplyClick={handleApplyClick}
                        isApplying={applyingTask === task.id}
                      />
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Apply Confirmation Modal */}
      {showApplyConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-auto transform transition-all">
            <div className="p-6">
              <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full mx-auto mb-4 shadow-lg">
                <FileText className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-center text-gray-900 mb-3">
                Apply for Job?
              </h3>
              <p className="text-gray-600 text-center mb-2 leading-relaxed">
                You are about to apply for:
              </p>
              <p className="text-gray-900 text-center font-semibold mb-4">
                "{showApplyConfirm.taskTitle}"
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center">
                      <span className="text-amber-600 font-bold">!</span>
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-amber-800">
                      <span className="font-semibold">Warning:</span> This action cannot be reversed. 
                      Once you apply, the employer will be able to see your analysis and contact you.
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <Button
                  onClick={handleApplyConfirm}
                  disabled={!!applyingTask}
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-md hover:shadow-lg transition-all"
                >
                  {applyingTask ? (
                    <div className="flex items-center justify-center w-full">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting Application...
                    </div>
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Yes, Apply Now
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleApplyCancel}
                  variant="outline"
                  disabled={!!applyingTask}
                  className="w-full hover:bg-gray-50"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

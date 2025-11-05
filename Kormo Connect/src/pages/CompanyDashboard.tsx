import React, { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase, Task, Analysis } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label, Textarea } from '@/components/ui/forms'
import { Badge, Separator } from '@/components/ui/utilities'
import { CollapsibleText } from '@/components/ui/collapsible-text'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Building2, Plus, Users, Star, Clock, LogOut, Briefcase, Eye, Download, Edit, Trash2, User, Briefcase as BriefcaseIcon, DollarSign, Rocket } from 'lucide-react'
import { TagInput } from '@/components/ui/tag-input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { WorkerReviewForm, ReviewData } from '@/components/WorkerReviewForm'
import { useToast } from '@/hooks/use-toast'
import { MessageSquare } from 'lucide-react'

interface TaskWithAnalyses extends Task {
  analysis_count: number
}

interface AnalysisWithWorker {
  id: string
  task_id: string
  worker_id: string
  analysis_result: any
  created_at: string
  worker_email: string
  worker_name: string
  cv_url: string | null
  cv_filename: string | null
  subscription_status?: string
  worker_profile: {
    first_name: string
    last_name: string
    skills: string
    experience: string
    education: string
    phone: string
    cv_url: string | null
    cv_filename: string | null
    subscription_status?: string
  }
}

export default function CompanyDashboard() {
  const { user, signOut } = useAuth()
  const [tasks, setTasks] = useState<TaskWithAnalyses[]>([])
  const [selectedTaskAnalyses, setSelectedTaskAnalyses] = useState<AnalysisWithWorker[]>([])
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)

  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    required_skills: [] as string[],
    experience_level: '',
    is_public: true,
    budget_min: '',
    budget_max: '',
    currency: ''
  })

  const [editTaskForm, setEditTaskForm] = useState({
    title: '',
    description: '',
    required_skills: [] as string[],
    experience_level: '',
    is_public: true,
    budget_min: '',
    budget_max: '',
    currency: ''
  })

  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null)
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false)
  const [reviewingWorkerId, setReviewingWorkerId] = useState<string | null>(null)
  const [reviewingWorkerName, setReviewingWorkerName] = useState<string>('')
  const [submittedReviews, setSubmittedReviews] = useState<Set<string>>(new Set())
  const [boostDialogOpen, setBoostDialogOpen] = useState(false)
  const [boostingTaskId, setBoostingTaskId] = useState<string | null>(null)
  const [boosting, setBoosting] = useState(false)
  const [boostTimers, setBoostTimers] = useState<Record<string, string>>({})
  const { toast } = useToast()

  useEffect(() => {
    if (user) {
      fetchTasks()
    }
  }, [user])

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          job_applications(count)
        `)
        .eq('created_by', user?.id)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching tasks:', error)
        return
      }

      // Transform the data to include application count
      const tasksWithCount = (data || []).map(task => ({
        ...task,
        analysis_count: task.job_applications?.[0]?.count || 0
      }))

      setTasks(tasksWithCount)
      setLoading(false)
    } catch (error) {
      console.error('Error in fetchTasks:', error)
      setLoading(false)
    }
  }

  const openEditDialog = (task: TaskWithAnalyses) => {
    setEditingTaskId(task.id)
    setEditTaskForm({
      title: task.title,
      description: task.description,
      required_skills: task.required_skills ? task.required_skills.split(',').map(s => s.trim()).filter(s => s) : [],
      experience_level: task.experience_level,
      is_public: task.is_public ?? true,
      budget_min: task.budget_min?.toString() || '',
      budget_max: task.budget_max?.toString() || '',
      currency: task.currency || ''
    })
    setEditDialogOpen(true)
  }

  const validateBudgetFields = (budget_min: string, budget_max: string): string | null => {
    if (budget_min && budget_max) {
      const min = parseFloat(budget_min)
      const max = parseFloat(budget_max)
      if (isNaN(min) || isNaN(max)) {
        return 'Budget values must be valid numbers'
      }
      if (max <= min) {
        return 'Maximum budget must be greater than minimum budget'
      }
    }
    return null
  }

  const openDeleteDialog = (taskId: string) => {
    setDeleteTaskId(taskId)
    setDeleteDialogOpen(true)
  }

  const editTask = async () => {
    if (!editTaskForm.title || !editTaskForm.description || editTaskForm.required_skills.length === 0 || !editTaskForm.experience_level) {
      alert('Please fill in all fields and add at least one required skill')
      return
    }

    // Validate budget fields
    const budgetError = validateBudgetFields(editTaskForm.budget_min, editTaskForm.budget_max)
    if (budgetError) {
      alert(budgetError)
      return
    }

    setEditing(true)

    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      if (!token) {
        throw new Error('No authentication token')
      }

      // Call the edit-task edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/edit-task`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taskId: editingTaskId,
          title: editTaskForm.title,
          description: editTaskForm.description,
          required_skills: editTaskForm.required_skills.join(', '),
          experience_level: editTaskForm.experience_level,
          is_public: editTaskForm.is_public,
          budget_min: editTaskForm.budget_min ? parseFloat(editTaskForm.budget_min) : null,
          budget_max: editTaskForm.budget_max ? parseFloat(editTaskForm.budget_max) : null,
          currency: editTaskForm.currency || null
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to edit job')
      }

      // Reset form and close dialog
      setEditTaskForm({
        title: '',
        description: '',
        required_skills: [],
        experience_level: '',
        is_public: true,
        budget_min: '',
        budget_max: '',
        currency: ''
      })
      setEditDialogOpen(false)
      setEditingTaskId(null)
      
      // Refresh tasks
      await fetchTasks()
    } catch (error) {
      console.error('Error in editTask:', error)
      alert('Error editing job. Please try again.')
    } finally {
      setEditing(false)
    }
  }

  const deleteTask = async () => {
    if (!deleteTaskId) return

    setDeleting(true)

    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token

      if (!token) {
        throw new Error('No authentication token')
      }

      // Call the delete-task edge function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-task`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taskId: deleteTaskId
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to delete job')
      }

      // Close dialog and reset state
      setDeleteDialogOpen(false)
      setDeleteTaskId(null)
      
      // Refresh tasks
      await fetchTasks()
    } catch (error) {
      console.error('Error in deleteTask:', error)
      alert('Error deleting job. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const createTask = async () => {
    if (!taskForm.title || !taskForm.description || taskForm.required_skills.length === 0 || !taskForm.experience_level) {
      alert('Please fill in all fields and add at least one required skill')
      return
    }

    // Validate budget fields
    const budgetError = validateBudgetFields(taskForm.budget_min, taskForm.budget_max)
    if (budgetError) {
      alert(budgetError)
      return
    }

    setCreating(true)

    try {
      const { error } = await supabase
        .from('tasks')
        .insert([
          {
            created_by: user?.id,
            task_id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title: taskForm.title,
            description: taskForm.description,
            required_skills: taskForm.required_skills.join(', '), // Store as comma-separated string
            experience_level: taskForm.experience_level,
            is_public: taskForm.is_public,
            budget_min: taskForm.budget_min ? parseFloat(taskForm.budget_min) : null,
            budget_max: taskForm.budget_max ? parseFloat(taskForm.budget_max) : null,
            currency: taskForm.currency || null
          }
        ])

      if (error) {
        console.error('Error creating task:', error)
        alert('Error creating job. Please try again.')
        return
      }

      // Reset form and close dialog
      setTaskForm({
        title: '',
        description: '',
        required_skills: [],
        experience_level: '',
        is_public: true,
        budget_min: '',
        budget_max: '',
        currency: ''
      })
      setCreateDialogOpen(false)
      
      // Refresh tasks
      await fetchTasks()
    } catch (error) {
      console.error('Error in createTask:', error)
      alert('Error creating task. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  // Calculate time remaining for boost
  const calculateBoostTimeRemaining = (boost_expires_at: string | null | undefined): string | null => {
    if (!boost_expires_at) return null
    
    const now = new Date()
    const expiresAt = new Date(boost_expires_at)
    const diff = expiresAt.getTime() - now.getTime()
    
    if (diff <= 0) return null
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  // Update boost timers every minute
  useEffect(() => {
    const updateTimers = () => {
      const newTimers: Record<string, string> = {}
      tasks.forEach(task => {
        if (task.is_boosted && task.boost_expires_at) {
          const timeRemaining = calculateBoostTimeRemaining(task.boost_expires_at)
          if (timeRemaining) {
            newTimers[task.id] = timeRemaining
          }
        }
      })
      setBoostTimers(newTimers)
    }

    updateTimers()
    const interval = setInterval(updateTimers, 60000) // Update every minute

    return () => clearInterval(interval)
  }, [tasks])

  const openBoostDialog = (taskId: string) => {
    setBoostingTaskId(taskId)
    setBoostDialogOpen(true)
  }

  const handleBoostTask = async () => {
    if (!boostingTaskId) return

    setBoosting(true)

    try {
      // Show loading for 3 seconds (mock payment processing)
      await new Promise(resolve => setTimeout(resolve, 3000))

      // Call boost-task edge function
      const { data, error } = await supabase.functions.invoke('boost-task', {
        body: {
          taskId: boostingTaskId
        }
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error.message)

      toast({
        title: "Job Boosted Successfully!",
        description: "Your job will be featured at the top of Professional Dashboard for 7 days.",
        variant: "default"
      })

      // Refresh tasks to show updated boost status
      await fetchTasks()
      
      // Close dialog
      setBoostDialogOpen(false)
      setBoostingTaskId(null)
    } catch (err: any) {
      console.error('Boost error:', err)
      toast({
        title: "Boost Failed",
        description: err.message || 'Failed to boost job. Please try again.',
        variant: "destructive"
      })
    } finally {
      setBoosting(false)
    }
  }

  const fetchExistingReviews = async (taskId: string, analyses: AnalysisWithWorker[]) => {
    try {
      // Get existing reviews for this task
      const { data: reviews, error } = await supabase
        .from('worker_reviews')
        .select('worker_id')
        .eq('task_id', taskId)
        .eq('company_id', user?.id)

      if (error) {
        console.error('Error fetching existing reviews:', error)
        return
      }

      // Create a set of worker IDs that have been reviewed
      const reviewedWorkerIds = new Set(reviews?.map(review => review.worker_id) || [])
      setSubmittedReviews(reviewedWorkerIds)
    } catch (error) {
      console.error('Error in fetchExistingReviews:', error)
    }
  }

  const fetchTaskAnalyses = async (taskId: string) => {
    try {
      setViewingTaskId(taskId)
      
      const response = await supabase.functions.invoke('fetch-task-analyses', {
        body: { taskId },
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      })

      if (response.error) {
        console.error('Error fetching task analyses:', response.error)
        alert('Error fetching analyses. Please try again.')
        return
      }

      const analyses = response.data?.data || []
      setSelectedTaskAnalyses(analyses)
      
      // Auto-select the first worker (highest score)
      if (analyses.length > 0) {
        const sortedAnalyses = analyses.sort((a, b) => (b.analysis_result?.score || 0) - (a.analysis_result?.score || 0))
        setSelectedWorkerId(sortedAnalyses[0].worker_id)
      }
      
      // Check for existing reviews
      await fetchExistingReviews(taskId, analyses)
      
      setViewDialogOpen(true)
    } catch (error) {
      console.error('Error in fetchTaskAnalyses:', error)
      alert('Error fetching analyses. Please try again.')
    } finally {
      setViewingTaskId(null)
    }
  }

  const formatScore = (score: number) => {
    return Math.round(score * 100)
  }

  const getScoreColor = (score: number) => {
    const percentage = score * 100
    if (percentage >= 80) return 'text-green-600'
    if (percentage >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const handleReviewSubmit = async (reviewData: ReviewData) => {
    try {
      const response = await supabase.functions.invoke('submit-worker-review', {
        body: reviewData
      });

      if (response.error) {
        console.error('Review submission error:', response.error);
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to submit review. Please try again."
        });
        return;
      }

      toast({
        variant: "success",
        title: "Success",
        description: "Review submitted successfully! Performance metrics updated."
      });

      // Add the worker to the submitted reviews set
      setSubmittedReviews(prev => new Set([...prev, reviewingWorkerId]))

      setReviewDialogOpen(false);
      setReviewingWorkerId(null);
      setReviewingWorkerName('');
    } catch (error) {
      console.error('Error in handleReviewSubmit:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to submit review. Please try again."
      });
    }
  }

  const openReviewDialog = (workerId: string, workerName: string) => {
    setReviewingWorkerId(workerId);
    setReviewingWorkerName(workerName);
    setReviewDialogOpen(true);
  }

  const hasWorkerBeenReviewed = (workerId: string) => {
    return submittedReviews.has(workerId);
  }

  // Filter and sort analyses - Premium workers first
  const filteredAnalyses = selectedTaskAnalyses
    .filter(analysis => 
      analysis.worker_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      analysis.worker_email?.toLowerCase().includes(searchTerm.toLowerCase())
    )

  // Separate into premium (active subscription) and free workers
  const premiumWorkers = filteredAnalyses
    .filter(analysis => 
      analysis.subscription_status === 'active' || 
      analysis.worker_profile?.subscription_status === 'active'
    )
    .sort((a, b) => (b.analysis_result?.score || 0) - (a.analysis_result?.score || 0))

  const freeWorkers = filteredAnalyses
    .filter(analysis => 
      analysis.subscription_status !== 'active' && 
      analysis.worker_profile?.subscription_status !== 'active'
    )
    .sort((a, b) => (b.analysis_result?.score || 0) - (a.analysis_result?.score || 0))

  // Premium workers appear first, then free workers
  const filteredAndSortedAnalyses = [...premiumWorkers, ...freeWorkers]

  // Get selected worker data
  const selectedWorker = selectedWorkerId 
    ? selectedTaskAnalyses.find(analysis => analysis.worker_id === selectedWorkerId)
    : null

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            Loading dashboard...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Building2 className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-xl font-semibold text-gray-900">
                Employer Dashboard
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">{user?.email}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={signOut}
                className="flex items-center"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Briefcase className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Jobs</p>
                  <p className="text-2xl font-bold text-gray-900">{tasks.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Applications</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {(tasks || []).reduce((sum, task) => sum + task.analysis_count, 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Star className="h-8 w-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Jobs</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {tasks.filter(task => task.is_public).length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Jobs Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <Briefcase className="h-5 w-5 mr-2" />
                  Your Jobs
                </CardTitle>
                <CardDescription>
                  Manage your job postings and view applicant analyses
                </CardDescription>
              </div>
              
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Job
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
                  <DialogHeader className="space-y-3 pb-4">
                    <div className="flex items-center space-x-2">
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <BriefcaseIcon className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <DialogTitle className="text-xl font-semibold">Create New Job</DialogTitle>
                        <DialogDescription className="text-sm text-gray-600 mt-1">
                          Add a new job posting to attract qualified professionals and receive AI-powered suitability analyses.
                        </DialogDescription>
                      </div>
                    </div>
                  </DialogHeader>
                  
                  <div className="bg-gradient-to-br from-gray-50 to-blue-50/20 rounded-xl p-6 space-y-6 border border-gray-100 shadow-sm">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="title" className="text-sm font-semibold text-gray-800 flex items-center">
                          <BriefcaseIcon className="h-4 w-4 mr-2 text-blue-600" />
                          Job Title <span className="text-red-500 ml-1">*</span>
                        </Label>
                        <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Required</Badge>
                      </div>
                      <div className="relative group">
                        <Input
                          id="title"
                          placeholder="e.g., Senior React Developer"
                          value={taskForm.title}
                          onChange={(e) => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                          className="w-full h-11 px-4 py-2 bg-white border-2 border-gray-200 rounded-lg transition-all duration-300 hover:border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 focus:shadow-lg group-hover:shadow-md placeholder:text-gray-400"
                        />
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10 blur-sm"></div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="description" className="text-sm font-semibold text-gray-800 flex items-center">
                          <Users className="h-4 w-4 mr-2 text-green-600" />
                          Job Description <span className="text-red-500 ml-1">*</span>
                        </Label>
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Detailed Info</Badge>
                      </div>
                      <div className="relative group">
                        <Textarea
                          id="description"
                          placeholder="Describe the role, responsibilities, key projects, employer culture, and what makes this opportunity exciting..."
                          value={taskForm.description}
                          onChange={(e) => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                          className="min-h-[140px] w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg resize-y transition-all duration-300 hover:border-gray-300 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 focus:shadow-lg group-hover:shadow-md placeholder:text-gray-400 leading-relaxed"
                          rows={5}
                        />
                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-blue-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10 blur-sm"></div>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center">
                        <Star className="h-3 w-3 mr-1 text-yellow-500" />
                        Provide a detailed description to help professionals understand the role better
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold text-gray-800 flex items-center">
                          <Star className="h-4 w-4 mr-2 text-yellow-600" />
                          Required Skills <span className="text-red-500 ml-1">*</span>
                        </Label>
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">Skills & Tech</Badge>
                      </div>
                      <div className="relative group">
                        <div className="bg-white border-2 border-gray-200 rounded-lg transition-all duration-300 hover:border-gray-300 focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-500/20 focus-within:shadow-lg group-hover:shadow-md">
                          <TagInput
                            value={taskForm.required_skills}
                            onChange={(skills) => setTaskForm(prev => ({ ...prev, required_skills: skills }))}
                            placeholder="Type a skill and press Enter..."
                            className="border-0 focus:ring-0 focus:outline-0 px-4 py-3 bg-transparent"
                          />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10 blur-sm"></div>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center">
                        <Star className="h-3 w-3 mr-1 text-purple-500" />
                        Add relevant skills, technologies, and competencies required for this role
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold text-gray-800 flex items-center">
                          <Clock className="h-4 w-4 mr-2 text-indigo-600" />
                          Minimum Experience Level <span className="text-red-500 ml-1">*</span>
                        </Label>
                        <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">Career Stage</Badge>
                      </div>
                      <div className="relative group">
                        <Select 
                          value={taskForm.experience_level} 
                          onValueChange={(value) => setTaskForm(prev => ({ ...prev, experience_level: value }))}
                        >
                          <SelectTrigger className="w-full h-11 px-4 py-2 bg-white border-2 border-gray-200 rounded-lg transition-all duration-300 hover:border-gray-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 focus:shadow-lg group-hover:shadow-md">
                            <SelectValue placeholder="Select experience level" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Entry">Entry</SelectItem>
                            <SelectItem value="Intermediate">Intermediate</SelectItem>
                            <SelectItem value="Senior">Senior</SelectItem>
                            <SelectItem value="Expert">Expert</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10 blur-sm"></div>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center">
                        <Star className="h-3 w-3 mr-1 text-indigo-500" />
                        Choose the appropriate experience level for this position
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold text-gray-800 flex items-center">
                          <DollarSign className="h-4 w-4 mr-2 text-green-600" />
                          Budget Range
                        </Label>
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Payment Range</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="relative group">
                          <Input
                            type="text"
                            placeholder="Currency (e.g., USD, EUR, BDT)"
                            value={taskForm.currency}
                            onChange={(e) => setTaskForm(prev => ({ ...prev, currency: e.target.value }))}
                            className="w-full h-11 px-4 py-2 bg-white border-2 border-gray-200 rounded-lg transition-all duration-300 hover:border-gray-300 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 focus:shadow-lg group-hover:shadow-md placeholder:text-gray-400"
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10 blur-sm"></div>
                        </div>
                        <div className="relative group">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Min"
                            value={taskForm.budget_min}
                            onChange={(e) => setTaskForm(prev => ({ ...prev, budget_min: e.target.value }))}
                            className="w-full h-11 px-4 py-2 bg-white border-2 border-gray-200 rounded-lg transition-all duration-300 hover:border-gray-300 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 focus:shadow-lg group-hover:shadow-md placeholder:text-gray-400"
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10 blur-sm"></div>
                        </div>
                        <div className="relative group">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="Max"
                            value={taskForm.budget_max}
                            onChange={(e) => setTaskForm(prev => ({ ...prev, budget_max: e.target.value }))}
                            className="w-full h-11 px-4 py-2 bg-white border-2 border-gray-200 rounded-lg transition-all duration-300 hover:border-gray-300 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 focus:shadow-lg group-hover:shadow-md placeholder:text-gray-400"
                          />
                          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10 blur-sm"></div>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center">
                        <Star className="h-3 w-3 mr-1 text-green-500" />
                        Set the currency and budget range for this job (maximum must be greater than minimum)
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold text-gray-800 flex items-center">
                          <Eye className="h-4 w-4 mr-2 text-purple-600" />
                          Job Visibility <span className="text-red-500 ml-1">*</span>
                        </Label>
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">Privacy</Badge>
                      </div>
                      <div className="relative group">
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setTaskForm(prev => ({ ...prev, is_public: true }))}
                            className={`flex-1 h-11 px-4 py-2 border-2 rounded-lg transition-all duration-300 font-medium text-sm ${
                              taskForm.is_public
                                ? 'bg-green-50 border-green-500 text-green-700 shadow-md'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            Public
                          </button>
                          <button
                            type="button"
                            onClick={() => setTaskForm(prev => ({ ...prev, is_public: false }))}
                            className={`flex-1 h-11 px-4 py-2 border-2 rounded-lg transition-all duration-300 font-medium text-sm ${
                              !taskForm.is_public
                                ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-md'
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                            }`}
                          >
                            Private
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center">
                        <Star className="h-3 w-3 mr-1 text-purple-500" />
                        Public jobs are visible to all professionals, Private jobs are only visible to your employer
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-6 border-t border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-blue-50/30 -mx-6 px-6 pb-0 mt-6 rounded-b-xl">
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span>Ready to create your job posting</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCreateDialogOpen(false)}
                        disabled={creating}
                        className="px-6 py-2.5 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-300 font-medium rounded-lg"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        onClick={createTask}
                        disabled={creating}
                        className="relative px-8 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 min-w-[140px] transform hover:scale-105 active:scale-95"
                      >
                        {creating ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Job
                            <div className="absolute inset-0 bg-white/20 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tasks.length === 0 ? (
                <div className="text-center py-16 relative overflow-hidden">
                  {/* Background decoration */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 to-purple-50/30 rounded-xl"></div>
                  <div className="absolute top-8 left-1/2 transform -translate-x-1/2 w-24 h-24 bg-blue-100 rounded-full opacity-50 animate-pulse"></div>
                  <div className="absolute top-12 left-1/4 w-16 h-16 bg-purple-100 rounded-full opacity-30 animate-pulse delay-300"></div>
                  <div className="absolute top-16 right-1/4 w-12 h-12 bg-green-100 rounded-full opacity-40 animate-pulse delay-700"></div>
                  
                  {/* Content */}
                  <div className="relative z-10">
                    <div className="bg-gradient-to-br from-blue-100 to-purple-100 p-6 rounded-full w-20 h-20 mx-auto mb-6 shadow-lg">
                      <Briefcase className="h-8 w-8 text-blue-600 mx-auto" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-3">No jobs created yet</h3>
                    <p className="text-gray-600 mb-8 max-w-md mx-auto leading-relaxed">
                      Start by creating your first job posting to attract qualified professionals and receive AI-powered suitability analyses.
                    </p>
                    <div className="flex items-center justify-center space-x-4">
                      <Button 
                        onClick={() => setCreateDialogOpen(true)}
                        className="relative px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
                      >
                        <Plus className="h-5 w-5 mr-2" />
                        Create Your First Job
                        <div className="absolute inset-0 bg-white/20 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                      </Button>
                    </div>
                    <div className="mt-6 flex items-center justify-center space-x-6 text-sm text-gray-500">
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                        <span>AI-Powered Analysis</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse delay-300"></div>
                        <span>Skill Matching</span>
                      </div>
                      <div className="flex items-center">
                        <div className="w-2 h-2 bg-purple-500 rounded-full mr-2 animate-pulse delay-700"></div>
                        <span>Professional Results</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                tasks.map((task) => (
                  <div key={task.id} className="group relative border border-gray-200 hover:border-blue-200 rounded-xl p-6 bg-white hover:bg-gradient-to-br hover:from-white hover:to-blue-50/20 transition-all duration-300 shadow-sm hover:shadow-lg transform hover:-translate-y-1">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-bold text-xl text-gray-900 group-hover:text-blue-700 transition-colors duration-300">{task.title}</h3>
                          {task.is_public ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 px-2 py-0.5 text-xs">
                              Public
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 px-2 py-0.5 text-xs">
                              Private
                            </Badge>
                          )}
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        </div>
                        <div className="mb-4">
                          <CollapsibleText 
                            text={task.description} 
                            maxLength={200}
                          />
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {new Date(task.created_at).toLocaleDateString()}
                          </span>
                          <span className="flex items-center">
                            <Users className="h-4 w-4 mr-1" />
                            {task.analysis_count} applications
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end space-y-2">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 px-3 py-1">
                          <Briefcase className="h-3 w-3 mr-1" />
                          {task.analysis_count} {task.analysis_count === 1 ? 'Application' : 'Applications'}
                        </Badge>
                        {task.analysis_count > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => fetchTaskAnalyses(task.id)}
                            disabled={viewingTaskId === task.id}
                            className="transition-all duration-300 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                          >
                            {viewingTaskId === task.id ? (
                              <>
                                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600 mr-2"></div>
                                Loading...
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" />
                                View Applications
                              </>
                            )}
                          </Button>
                        )}
                        {/* Boost Button */}
                        {task.is_boosted && boostTimers[task.id] ? (
                          <Badge variant="outline" className="bg-gradient-to-r from-orange-50 to-red-50 text-orange-700 border-orange-300 px-3 py-2">
                            <Rocket className="h-4 w-4 mr-2" />
                            Boosted: {boostTimers[task.id]} remaining
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openBoostDialog(task.id)}
                            disabled={boosting}
                            className="transition-all duration-300 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700"
                          >
                            <Rocket className="h-4 w-4 mr-2" />
                            Boost Job
                          </Button>
                        )}
                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(task)}
                            disabled={editing}
                            className="transition-all duration-300 hover:bg-green-50 hover:border-green-300 hover:text-green-700"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openDeleteDialog(task.id)}
                            disabled={deleting}
                            className="transition-all duration-300 hover:bg-red-50 hover:border-red-300 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
                      <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100 transition-colors duration-200">
                        <Star className="h-3 w-3 mr-1" />
                        Skills: {task.required_skills}
                      </Badge>
                      <Badge variant="secondary" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                        <BriefcaseIcon className="h-3 w-3 mr-1" />
                        Level: {task.experience_level}
                      </Badge>
                      {task.budget_min && task.budget_max && (
                        <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                          <DollarSign className="h-3 w-3 mr-1" />
                          {task.currency ? `${task.currency} ${task.budget_min} - ${task.budget_max}` : `$${task.budget_min} - $${task.budget_max}`}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs bg-gray-50 text-gray-600 border-gray-200">
                        <Clock className="h-3 w-3 mr-1" />
                        Posted {new Date(task.created_at).toLocaleDateString()}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Edit Task Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-[500px] max-h-[80vh] overflow-y-auto">
            <DialogHeader className="space-y-3 pb-4">
              <div className="flex items-center space-x-2">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Edit className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold">Edit Job</DialogTitle>
                  <DialogDescription className="text-sm text-gray-600 mt-1">
                    Update the job details. Changes will be applied immediately and will affect future analyses.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <div className="bg-gradient-to-br from-gray-50 to-purple-50/20 rounded-xl p-6 space-y-6 border border-gray-100 shadow-sm">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-title" className="text-sm font-semibold text-gray-800 flex items-center">
                    <BriefcaseIcon className="h-4 w-4 mr-2 text-blue-600" />
                    Job Title <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">Required</Badge>
                </div>
                <div className="relative group">
                  <Input
                    id="edit-title"
                    placeholder="e.g., Senior React Developer"
                    value={editTaskForm.title}
                    onChange={(e) => setEditTaskForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full h-11 px-4 py-2 bg-white border-2 border-gray-200 rounded-lg transition-all duration-300 hover:border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 focus:shadow-lg group-hover:shadow-md placeholder:text-gray-400"
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10 blur-sm"></div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="edit-description" className="text-sm font-semibold text-gray-800 flex items-center">
                    <Users className="h-4 w-4 mr-2 text-green-600" />
                    Job Description <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Detailed Info</Badge>
                </div>
                <div className="relative group">
                  <Textarea
                    id="edit-description"
                    placeholder="Describe the role, responsibilities, key projects, employer culture, and what makes this opportunity exciting..."
                    value={editTaskForm.description}
                    onChange={(e) => setEditTaskForm(prev => ({ ...prev, description: e.target.value }))}
                    className="min-h-[140px] w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-lg resize-y transition-all duration-300 hover:border-gray-300 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 focus:shadow-lg group-hover:shadow-md placeholder:text-gray-400 leading-relaxed"
                    rows={5}
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-blue-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10 blur-sm"></div>
                </div>
                <p className="text-xs text-gray-500 flex items-center">
                  <Star className="h-3 w-3 mr-1 text-yellow-500" />
                  Provide a detailed description to help professionals understand the role better
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-gray-800 flex items-center">
                    <Star className="h-4 w-4 mr-2 text-yellow-600" />
                    Required Skills <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">Skills & Tech</Badge>
                </div>
                <div className="relative group">
                  <div className="bg-white border-2 border-gray-200 rounded-lg transition-all duration-300 hover:border-gray-300 focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-500/20 focus-within:shadow-lg group-hover:shadow-md">
                    <TagInput
                      value={editTaskForm.required_skills}
                      onChange={(skills) => setEditTaskForm(prev => ({ ...prev, required_skills: skills }))}
                      placeholder="Type a skill and press Enter..."
                      className="border-0 focus:ring-0 focus:outline-0 px-4 py-3 bg-transparent"
                    />
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10 blur-sm"></div>
                </div>
                <p className="text-xs text-gray-500 flex items-center">
                  <Star className="h-3 w-3 mr-1 text-purple-500" />
                  Add relevant skills, technologies, and competencies required for this role
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-gray-800 flex items-center">
                    <Clock className="h-4 w-4 mr-2 text-indigo-600" />
                    Minimum Experience Level <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">Career Stage</Badge>
                </div>
                <div className="relative group">
                  <Select 
                    value={editTaskForm.experience_level} 
                    onValueChange={(value) => setEditTaskForm(prev => ({ ...prev, experience_level: value }))}
                  >
                    <SelectTrigger className="w-full h-11 px-4 py-2 bg-white border-2 border-gray-200 rounded-lg transition-all duration-300 hover:border-gray-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 focus:shadow-lg group-hover:shadow-md">
                      <SelectValue placeholder="Select experience level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Entry">Entry</SelectItem>
                      <SelectItem value="Intermediate">Intermediate</SelectItem>
                      <SelectItem value="Senior">Senior</SelectItem>
                      <SelectItem value="Expert">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10 blur-sm"></div>
                </div>
                <p className="text-xs text-gray-500 flex items-center">
                  <Star className="h-3 w-3 mr-1 text-indigo-500" />
                  Choose the appropriate experience level for this position
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-gray-800 flex items-center">
                    <DollarSign className="h-4 w-4 mr-2 text-green-600" />
                    Budget Range
                  </Label>
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">Payment Range</Badge>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="relative group">
                    <Input
                      type="text"
                      placeholder="Currency (e.g., USD, EUR, BDT)"
                      value={editTaskForm.currency}
                      onChange={(e) => setEditTaskForm(prev => ({ ...prev, currency: e.target.value }))}
                      className="w-full h-11 px-4 py-2 bg-white border-2 border-gray-200 rounded-lg transition-all duration-300 hover:border-gray-300 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 focus:shadow-lg group-hover:shadow-md placeholder:text-gray-400"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10 blur-sm"></div>
                  </div>
                  <div className="relative group">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Min"
                      value={editTaskForm.budget_min}
                      onChange={(e) => setEditTaskForm(prev => ({ ...prev, budget_min: e.target.value }))}
                      className="w-full h-11 px-4 py-2 bg-white border-2 border-gray-200 rounded-lg transition-all duration-300 hover:border-gray-300 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 focus:shadow-lg group-hover:shadow-md placeholder:text-gray-400"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10 blur-sm"></div>
                  </div>
                  <div className="relative group">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Max"
                      value={editTaskForm.budget_max}
                      onChange={(e) => setEditTaskForm(prev => ({ ...prev, budget_max: e.target.value }))}
                      className="w-full h-11 px-4 py-2 bg-white border-2 border-gray-200 rounded-lg transition-all duration-300 hover:border-gray-300 focus:border-green-500 focus:ring-4 focus:ring-green-500/20 focus:shadow-lg group-hover:shadow-md placeholder:text-gray-400"
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 to-emerald-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none -z-10 blur-sm"></div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 flex items-center">
                  <Star className="h-3 w-3 mr-1 text-green-500" />
                  Set the currency and budget range for this job (maximum must be greater than minimum)
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-gray-800 flex items-center">
                    <Eye className="h-4 w-4 mr-2 text-purple-600" />
                    Job Visibility <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">Privacy</Badge>
                </div>
                <div className="relative group">
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditTaskForm(prev => ({ ...prev, is_public: true }))}
                      className={`flex-1 h-11 px-4 py-2 border-2 rounded-lg transition-all duration-300 font-medium text-sm ${
                        editTaskForm.is_public
                          ? 'bg-green-50 border-green-500 text-green-700 shadow-md'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      Public
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditTaskForm(prev => ({ ...prev, is_public: false }))}
                      className={`flex-1 h-11 px-4 py-2 border-2 rounded-lg transition-all duration-300 font-medium text-sm ${
                        !editTaskForm.is_public
                          ? 'bg-orange-50 border-orange-500 text-orange-700 shadow-md'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      Private
                    </button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 flex items-center">
                  <Star className="h-3 w-3 mr-1 text-purple-500" />
                  Public jobs are visible to all professionals, Private jobs are only visible to your employer
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-gray-200/60 bg-gradient-to-r from-gray-50/50 to-purple-50/30 -mx-6 px-6 pb-0 mt-6 rounded-b-xl">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></div>
                <span>Update job details</span>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                  disabled={editing}
                  className="px-6 py-2.5 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-300 font-medium rounded-lg"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  onClick={editTask}
                  disabled={editing}
                  className="relative px-8 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-medium rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 min-w-[140px] transform hover:scale-105 active:scale-95"
                >
                  {editing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </>
                  ) : (
                    <>
                      <Edit className="h-4 w-4 mr-2" />
                      Update Job
                      <div className="absolute inset-0 bg-white/20 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-300"></div>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Task Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Permanently Delete Job?</DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete the job and all related data from the database.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex">
                  <Trash2 className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Are you absolutely sure?
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p className="mb-2">This will permanently delete:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>The job itself</li>
                        <li>All applications/applicants</li>
                        <li>All suitability analyses</li>
                        <li>All related data</li>
                      </ul>
                      <p className="mt-2 font-medium">This data cannot be recovered.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={deleteTask}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  'Permanently Delete'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Analyses Dialog - Two Panel Layout */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-[1200px] max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle>Job Applications</DialogTitle>
              <DialogDescription>
                Review professional suitability analyses for this position
              </DialogDescription>
            </DialogHeader>
            
            {!selectedTaskAnalyses || selectedTaskAnalyses.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-12">
                <div className="text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No applications yet</p>
                </div>
              </div>
            ) : (
              <div className="flex h-[600px] gap-4">
                {/* Left Panel - Professional List */}
                <div className="w-1/3 border rounded-lg flex flex-col">
                  <div className="p-4 border-b">
                    <div className="mb-3">
                      <Input
                        placeholder="Search professionals..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full"
                      />
                    </div>
                    <p className="text-sm text-gray-600">
                      {filteredAndSortedAnalyses.length} professional{filteredAndSortedAnalyses.length !== 1 ? 's' : ''} found
                      <span className="text-xs text-orange-600 ml-2">(Premium users shown first)</span>
                    </p>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto">
                    <div className="space-y-1 p-2">
                      {filteredAndSortedAnalyses.map((analysis) => (
                        <div
                          key={analysis.id}
                          className={`p-3 rounded-lg cursor-pointer transition-colors ${
                            selectedWorkerId === analysis.worker_id 
                              ? 'bg-blue-50 border border-blue-200' 
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                          onClick={() => setSelectedWorkerId(analysis.worker_id)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2">
                                <p className="font-medium text-sm truncate">
                                  {analysis.worker_name || 'Anonymous Professional'}
                                </p>
                                {(analysis.subscription_status === 'active' || analysis.worker_profile?.subscription_status === 'active') && (
                                  <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300 px-2 py-0.5 font-semibold">
                                    ★ PREMIUM
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 truncate">
                                {analysis.worker_email}
                              </p>
                              {hasWorkerBeenReviewed(analysis.worker_id) ? (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 mt-1">
                                  ✓ Reviewed
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openReviewDialog(analysis.worker_id, analysis.worker_name || 'Professional');
                                  }}
                                  className="h-6 px-2 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                                >
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                  Provide Feedback
                                </Button>
                              )}
                            </div>
                            <div className="text-right ml-2 flex-shrink-0">
                              <div className={`text-sm font-bold ${getScoreColor(analysis.analysis_result?.score || 0)}`}>
                                {formatScore(analysis.analysis_result?.score || 0)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Panel - Professional Details */}
                <div className="flex-1 border rounded-lg p-6 overflow-y-auto">
                  {selectedWorker ? (
                    <div className="space-y-6">
                      {/* Worker Header */}
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-xl font-semibold">
                              {selectedWorker.worker_name || 'Anonymous Professional'}
                            </h3>
                            {(selectedWorker.subscription_status === 'active' || selectedWorker.worker_profile?.subscription_status === 'active') && (
                              <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1 text-sm font-bold shadow-lg">
                                ⭐ PREMIUM MEMBER
                              </Badge>
                            )}
                          </div>
                          <p className="text-gray-600">{selectedWorker.worker_email}</p>
                        </div>
                        <div className="text-right">
                          <div className={`text-2xl font-bold ${getScoreColor(selectedWorker.analysis_result?.score || 0)}`}>
                            {formatScore(selectedWorker.analysis_result?.score || 0)}%
                          </div>
                          <p className="text-sm text-gray-500">Suitability Score</p>
                        </div>
                      </div>

                      {/* CV Download */}
                      {selectedWorker.cv_url && (
                        <div className="flex items-center gap-3">
                          <Button
                            onClick={() => window.open(selectedWorker.cv_url!, '_blank')}
                            className="flex-1"
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download CV ({selectedWorker.cv_filename || 'CV'})
                          </Button>
                          {hasWorkerBeenReviewed(selectedWorker.worker_id) ? (
                            <Button
                              disabled
                              variant="outline"
                              className="flex-1 bg-green-50 text-green-700 border-green-200 cursor-not-allowed"
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Feedback Provided
                            </Button>
                          ) : (
                            <Button
                              onClick={() => openReviewDialog(selectedWorker.worker_id, selectedWorker.worker_name || 'Professional')}
                              variant="outline"
                              className="flex-1 bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-blue-200"
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Provide Feedback
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Professional Profile Information */}
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2 pb-2 border-b">
                          <User className="h-5 w-5 text-gray-600" />
                          <h4 className="text-lg font-semibold">Professional Profile</h4>
                          <Badge variant="outline" className="text-xs">
                            {new Date(selectedWorker.created_at).toLocaleDateString()}
                          </Badge>
                        </div>
                        
                        {selectedWorker.worker_profile && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {selectedWorker.worker_profile.skills && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h5 className="font-medium text-blue-800 mb-2 flex items-center">
                                  <Star className="h-4 w-4 mr-2" />
                                  Skills
                                </h5>
                                <div className="flex flex-wrap gap-1">
                                  {selectedWorker.worker_profile.skills.split(',').map((skill: string, index: number) => (
                                    <Badge key={index} variant="secondary" className="text-xs">
                                      {skill.trim()}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {selectedWorker.worker_profile.experience && (
                              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <h5 className="font-medium text-green-800 mb-2 flex items-center">
                                  <Briefcase className="h-4 w-4 mr-2" />
                                  Experience
                                </h5>
                                <p className="text-green-700 text-sm leading-relaxed">
                                  {selectedWorker.worker_profile.experience}
                                </p>
                              </div>
                            )}

                            {selectedWorker.worker_profile.education && (
                              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                <h5 className="font-medium text-purple-800 mb-2">
                                  Education
                                </h5>
                                <p className="text-purple-700 text-sm leading-relaxed">
                                  {selectedWorker.worker_profile.education}
                                </p>
                              </div>
                            )}

                            {selectedWorker.worker_profile.phone && (
                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                <h5 className="font-medium text-gray-800 mb-2">
                                  Contact
                                </h5>
                                <p className="text-gray-700 text-sm">
                                  {selectedWorker.worker_profile.phone}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Analysis Results */}
                      <div className="space-y-4">
                        <div className="flex items-center space-x-2 pb-2 border-b">
                          <Star className="h-5 w-5 text-gray-600" />
                          <h4 className="text-lg font-semibold">AI Analysis Results</h4>
                        </div>
                        
                        {selectedWorker.analysis_result?.strengths && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                            <h5 className="font-medium text-green-800 mb-2 flex items-center">
                              <Star className="h-4 w-4 mr-2" />
                              Strengths
                            </h5>
                            <p className="text-green-700 text-sm leading-relaxed">
                              {selectedWorker.analysis_result.strengths}
                            </p>
                          </div>
                        )}

                        {selectedWorker.analysis_result?.weaknesses && (
                          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <h5 className="font-medium text-orange-800 mb-2">
                              Areas to Improve
                            </h5>
                            <p className="text-orange-700 text-sm leading-relaxed">
                              {selectedWorker.analysis_result.weaknesses}
                            </p>
                          </div>
                        )}

                        {selectedWorker.analysis_result?.suggestions && (
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <h5 className="font-medium text-blue-800 mb-2">
                              Suggestions
                            </h5>
                            <p className="text-blue-700 text-sm leading-relaxed">
                              {selectedWorker.analysis_result.suggestions}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center text-sm text-gray-500 pt-4 border-t">
                        <Clock className="h-4 w-4 mr-2" />
                        Analysis completed on {new Date(selectedWorker.created_at).toLocaleDateString()} at {new Date(selectedWorker.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-gray-500">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Select a professional to view their analysis</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Professional Review Form */}
        {reviewingWorkerId && (
          <WorkerReviewForm
            open={reviewDialogOpen}
            onOpenChange={setReviewDialogOpen}
            workerId={reviewingWorkerId}
            workerName={reviewingWorkerName}
            taskId={selectedTaskAnalyses[0]?.task_id || ''}
            companyId={user.id}
            onSubmit={handleReviewSubmit}
          />
        )}

        {/* Boost Task Confirmation Dialog */}
        <Dialog open={boostDialogOpen} onOpenChange={setBoostDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <div className="flex items-center space-x-2">
                <div className="bg-orange-100 p-2 rounded-lg">
                  <Rocket className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-semibold">Boost This Job?</DialogTitle>
                  <DialogDescription className="text-sm text-gray-600 mt-1">
                    Feature your job at the top of Professional Dashboard
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            
            <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 space-y-4 border border-orange-200">
              <div className="flex items-start space-x-3">
                <Rocket className="h-6 w-6 text-orange-600 mt-1 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900 mb-2">Premium Visibility</h4>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    For a one-time fee of <strong className="text-orange-700">1,000 BDT</strong>, 
                    this job will be pinned to the top of the Professional Dashboard for <strong className="text-orange-700">7 days</strong>. 
                    Boosted jobs receive priority visibility and attract more qualified workers.
                  </p>
                </div>
              </div>

              <div className="bg-white/70 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-semibold text-gray-900">7 Days</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">One-time Fee:</span>
                  <span className="font-semibold text-orange-700">1,000 BDT</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-gray-200">
                  <span className="text-gray-900 font-medium">Total:</span>
                  <span className="font-bold text-lg text-orange-700">1,000 BDT</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setBoostDialogOpen(false)
                  setBoostingTaskId(null)
                }}
                disabled={boosting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBoostTask}
                disabled={boosting}
                className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white"
              >
                {boosting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Boosting job...
                  </>
                ) : (
                  <>
                    <Rocket className="h-4 w-4 mr-2" />
                    Confirm & Pay 1,000 BDT
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders, status: 200 })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing environment variables')
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'No authorization header' } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Parse request body
    const { taskId } = await req.json()

    if (!taskId) {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'Task ID is required' } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Verify task exists and user owns it
    const { data: task, error: taskError } = await supabaseAdmin
      .from('tasks')
      .select('id, created_by, is_boosted, boost_expires_at')
      .eq('id', taskId)
      .single()

    if (taskError || !task) {
      return new Response(
        JSON.stringify({ error: { code: 'TASK_NOT_FOUND', message: 'Task not found' } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      )
    }

    // Verify user owns the task
    if (task.created_by !== user.id) {
      return new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'You do not own this task' } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Check if task is already boosted
    if (task.is_boosted && task.boost_expires_at) {
      const expiresAt = new Date(task.boost_expires_at)
      if (expiresAt > new Date()) {
        return new Response(
          JSON.stringify({ error: { code: 'ALREADY_BOOSTED', message: 'Task is already boosted' } }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    }

    // Calculate boost expiration (7 days from now)
    const boostExpiresAt = new Date()
    boostExpiresAt.setDate(boostExpiresAt.getDate() + 7)

    // Update task with boost status
    const { error: updateError } = await supabaseAdmin
      .from('tasks')
      .update({
        is_boosted: true,
        boost_expires_at: boostExpiresAt.toISOString()
      })
      .eq('id', taskId)

    if (updateError) {
      console.error('Error boosting task:', updateError)
      return new Response(
        JSON.stringify({ error: { code: 'UPDATE_FAILED', message: 'Failed to boost task' } }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      )
    }

    // Return success
    return new Response(
      JSON.stringify({
        data: {
          success: true,
          message: 'Task boosted successfully',
          taskId: taskId,
          boostExpiresAt: boostExpiresAt.toISOString()
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error in boost-task:', error)
    return new Response(
      JSON.stringify({
        error: {
          code: 'INTERNAL_ERROR',
          message: error.message || 'An unexpected error occurred'
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

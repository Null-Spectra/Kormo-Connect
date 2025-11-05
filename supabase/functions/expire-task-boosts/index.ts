import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

    // Find all tasks with expired boosts
    const now = new Date().toISOString()
    
    const { data: expiredTasks, error: fetchError } = await supabaseAdmin
      .from('tasks')
      .select('id, task_id, title')
      .eq('is_boosted', true)
      .lte('boost_expires_at', now)

    if (fetchError) {
      console.error('Error fetching expired tasks:', fetchError)
      throw fetchError
    }

    if (!expiredTasks || expiredTasks.length === 0) {
      console.log('No expired boosts found')
      return new Response(
        JSON.stringify({
          data: {
            success: true,
            message: 'No expired boosts to process',
            expiredCount: 0
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Reset boost status for expired tasks
    const taskIds = expiredTasks.map(task => task.id)
    
    const { error: updateError } = await supabaseAdmin
      .from('tasks')
      .update({
        is_boosted: false,
        boost_expires_at: null
      })
      .in('id', taskIds)

    if (updateError) {
      console.error('Error updating expired tasks:', updateError)
      throw updateError
    }

    console.log(`Expired ${expiredTasks.length} boosts:`, expiredTasks.map(t => t.task_id))

    return new Response(
      JSON.stringify({
        data: {
          success: true,
          message: `Expired ${expiredTasks.length} boost(s)`,
          expiredCount: expiredTasks.length,
          expiredTaskIds: expiredTasks.map(t => t.task_id)
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error in expire-task-boosts:', error)
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

Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        // Verify authorization
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('No authorization header');
        }

        // Get request data
        const { taskId, title, description, required_skills, experience_level, is_public, budget_min, budget_max, currency } = await req.json();

        if (!taskId) {
            throw new Error('Task ID is required');
        }

        // Get Supabase credentials
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

        if (!serviceRoleKey || !supabaseUrl || !supabaseAnonKey) {
            throw new Error('Supabase configuration missing');
        }

        // Verify auth token and get user info using Supabase Auth API
        const userResponse = await fetch(
            `${supabaseUrl}/auth/v1/user`,
            {
                headers: {
                    'Authorization': authHeader,
                    'apikey': supabaseAnonKey
                }
            }
        );
        
        if (!userResponse.ok) {
            const errorText = await userResponse.text();
            throw new Error(`Authentication failed: ${errorText}. Please ensure you are logged in.`);
        }
        
        const userData = await userResponse.json();
        const workerId = userData.id;
        
        if (!workerId) {
            throw new Error('Could not extract user ID from authentication token.');
        }

        // Verify the task exists and user has permission to edit it
        const taskResponse = await fetch(
            `${supabaseUrl}/rest/v1/tasks?id=eq.${taskId}&select=*`,
            {
                headers: {
                    'Authorization': authHeader,
                    'apikey': supabaseAnonKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!taskResponse.ok) {
            const errorText = await taskResponse.text();
            throw new Error(`Failed to fetch task: ${errorText}`);
        }

        const tasks = await taskResponse.json();
        const task = tasks?.[0];

        if (!task) {
            throw new Error('Task not found');
        }

        // Prepare update data
        const updateData: any = {};
        
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (required_skills !== undefined) updateData.required_skills = required_skills;
        if (experience_level !== undefined) updateData.experience_level = experience_level;
        if (is_public !== undefined) updateData.is_public = is_public;
        if (budget_min !== undefined && budget_min !== null) updateData.budget_min = budget_min;
        if (budget_max !== undefined && budget_max !== null) updateData.budget_max = budget_max;
        if (currency !== undefined && currency !== null && currency !== '') updateData.currency = currency;
        
        // Add updated timestamp
        updateData.updated_at = new Date().toISOString();

        // Update the task
        const updateResponse = await fetch(
            `${supabaseUrl}/rest/v1/tasks?id=eq.${taskId}`,
            {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(updateData)
            }
        );

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`Failed to update task: ${errorText}`);
        }

        const updatedTask = await updateResponse.json();

        return new Response(JSON.stringify({
            data: updatedTask[0] // Return the updated task
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Edit task error:', error);

        const errorResponse = {
            error: {
                code: 'EDIT_TASK_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
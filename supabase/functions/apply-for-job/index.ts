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

        // Get request body
        const { taskId } = await req.json();
        if (!taskId) {
            throw new Error('Task ID is required');
        }

        // Get Supabase credentials
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase configuration missing');
        }

        // Get user ID from auth token
        const userResponse = await fetch(
            `${supabaseUrl}/auth/v1/user`,
            {
                headers: {
                    'Authorization': authHeader,
                    'apikey': serviceRoleKey
                }
            }
        );

        if (!userResponse.ok) {
            throw new Error('Invalid auth token');
        }

        const userData = await userResponse.json();
        const workerId = userData.id;

        if (!workerId) {
            throw new Error('User ID not found');
        }

        // 1. Check if an analysis exists for this worker and task
        const analysisResponse = await fetch(
            `${supabaseUrl}/rest/v1/analyses?worker_id=eq.${workerId}&task_id=eq.${taskId}&select=id`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!analysisResponse.ok) {
            throw new Error('Failed to check analysis');
        }

        const analyses = await analysisResponse.json();
        if (!analyses || analyses.length === 0) {
            throw new Error('No analysis found for this job. Please analyze the job first.');
        }

        const analysisId = analyses[0].id;

        // 2. Check if worker has already applied for this task
        const applicationCheckResponse = await fetch(
            `${supabaseUrl}/rest/v1/job_applications?worker_id=eq.${workerId}&task_id=eq.${taskId}&select=id`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!applicationCheckResponse.ok) {
            throw new Error('Failed to check existing applications');
        }

        const existingApplications = await applicationCheckResponse.json();
        if (existingApplications && existingApplications.length > 0) {
            throw new Error('You have already applied for this job');
        }

        // 3. Validate that the task exists and is public
        const taskResponse = await fetch(
            `${supabaseUrl}/rest/v1/tasks?id=eq.${taskId}&is_public=eq.true&select=id,title`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!taskResponse.ok) {
            throw new Error('Failed to validate task');
        }

        const tasks = await taskResponse.json();
        if (!tasks || tasks.length === 0) {
            throw new Error('Task not found or not available for applications');
        }

        // 4. Create the job application
        const applicationData = {
            task_id: taskId,
            worker_id: workerId,
            analysis_id: analysisId,
            created_at: new Date().toISOString()
        };

        const createApplicationResponse = await fetch(
            `${supabaseUrl}/rest/v1/job_applications`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(applicationData)
            }
        );

        if (!createApplicationResponse.ok) {
            const errorText = await createApplicationResponse.text();
            throw new Error(`Failed to create application: ${errorText}`);
        }

        const createdApplication = await createApplicationResponse.json();

        return new Response(JSON.stringify({
            success: true,
            data: {
                applicationId: createdApplication[0]?.id,
                taskId: taskId,
                message: 'Application submitted successfully! The employer can now see your analysis.'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Apply for job error:', error);

        const errorResponse = {
            success: false,
            error: {
                code: 'APPLICATION_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
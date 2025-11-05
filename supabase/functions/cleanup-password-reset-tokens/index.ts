Deno.serve(async (req) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Max-Age': '86400',
        'Access-Control-Allow-Credentials': 'false'
    };

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: corsHeaders });
    }

    try {
        console.log('Starting cleanup of expired password reset tokens...');
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Supabase configuration missing');
        }

        // Call RPC function to cleanup expired reset tokens
        const cleanupResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/cleanup_expired_reset_tokens`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!cleanupResponse.ok) {
            throw new Error(`Failed to cleanup reset tokens: ${cleanupResponse.statusText}`);
        }

        const resetTokensResult = await cleanupResponse.json();

        // Call RPC function to cleanup old rate limits
        const rateLimitResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/cleanup_old_rate_limits`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!rateLimitResponse.ok) {
            throw new Error(`Failed to cleanup rate limits: ${rateLimitResponse.statusText}`);
        }

        const rateLimitResult = await rateLimitResponse.json();

        console.log('Password reset token cleanup completed successfully');
        console.log('Reset tokens cleaned:', resetTokensResult);
        console.log('Rate limits cleaned:', rateLimitResult);

        return new Response(JSON.stringify({
            success: true,
            message: 'Password reset token cleanup completed',
            resetTokensCleaned: resetTokensResult,
            rateLimitsCleaned: rateLimitResult,
            timestamp: new Date().toISOString()
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error during password reset token cleanup:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

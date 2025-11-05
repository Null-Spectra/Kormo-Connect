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
        console.log('Starting check for expired active subscriptions...');
        
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error('Supabase configuration missing');
        }

        // Update profiles with expired active subscriptions
        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?subscription_status=eq.active&subscription_expires_on=lte.${new Date().toISOString()}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                subscription_status: 'free',
                subscription_plan: null,
                subscription_expires_on: null,
                updated_at: new Date().toISOString()
            })
        });

        if (!updateResponse.ok) {
            throw new Error(`Failed to update expired subscriptions: ${updateResponse.statusText}`);
        }

        const updatedProfiles = await updateResponse.json();

        console.log(`Processed ${updatedProfiles.length} expired active subscriptions`);
        console.log('Processed subscriptions:', updatedProfiles.map(p => ({ id: p.id, name: p.full_name, expires_on: p.subscription_expires_on })));

        return new Response(JSON.stringify({
            success: true,
            message: `Processed ${updatedProfiles.length} expired active subscriptions`,
            processedSubscriptions: updatedProfiles.length,
            subscriptions: updatedProfiles.map(p => ({
                id: p.id,
                name: p.full_name,
                role: p.role,
                expires_on: p.subscription_expires_on
            })),
            timestamp: new Date().toISOString()
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error during subscription expiry check:', error);
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

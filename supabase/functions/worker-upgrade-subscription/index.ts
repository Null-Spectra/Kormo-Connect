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
    // Extract parameters from request body
    const requestData = await req.json();
    const { plan } = requestData;

    // Validate plan type
    const validPlans = ['weekly', 'monthly', 'yearly'];
    if (!validPlans.includes(plan)) {
      return new Response(JSON.stringify({ error: { message: `Invalid plan type. Valid options are: ${validPlans.join(', ')}` } }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get authorization header and extract user info
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: { message: 'No authorization header' } }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extract JWT token from Bearer header
    const token = authHeader.replace('Bearer ', '');
    
    // Get Supabase service role key for server operations
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseServiceKey) {
      return new Response(JSON.stringify({ error: { message: 'Server configuration error' } }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Create Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseClient = `${supabaseUrl}/auth/v1/user`;
    
    // Verify token and get user ID
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        'Authorization': authHeader,
        'apikey': supabaseServiceKey
      }
    });

    if (!userResponse.ok) {
      return new Response(JSON.stringify({ error: { message: 'Invalid authentication token' } }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userData = await userResponse.json();
    const userId = userData.id;

    if (!userId) {
      return new Response(JSON.stringify({ error: { message: 'User not found' } }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Calculate expiration date based on plan
    const now = new Date();
    let expirationDate;

    switch (plan) {
      case 'weekly':
        expirationDate = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days
        break;
      case 'monthly':
        expirationDate = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000)); // 30 days
        break;
      case 'yearly':
        expirationDate = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)); // 365 days
        break;
    }

    // Update the user profile in the database
    const updateResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        subscription_status: 'active',
        subscription_plan: plan,
        subscription_expires_on: expirationDate.toISOString()
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('Database update failed:', errorText);
      return new Response(JSON.stringify({ error: { message: 'Failed to update subscription status' } }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const updatedProfile = await updateResponse.json();
    console.log(`Successfully updated user ${userId} with plan: ${plan}, expires: ${expirationDate.toISOString()}`);

    // Return success response
    const result = {
      success: true,
      message: `Successfully upgraded to ${plan} plan`,
      user_id: userId,
      subscription_status: 'active',
      subscription_plan: plan,
      subscription_expires_on: expirationDate.toISOString(),
      upgraded_at: now.toISOString()
    };

    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Worker upgrade subscription error:', error);
    
    const errorResponse = {
      error: {
        code: 'WORKER_UPGRADE_ERROR',
        message: error.message || 'An error occurred while processing the subscription upgrade'
      }
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

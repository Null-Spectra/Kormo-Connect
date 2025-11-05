Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const { subscriptionPlan, userId, userEmail, userName } = await req.json()

    // Validate inputs
    if (!subscriptionPlan || !userId || !userEmail || !userName) {
      return new Response(
        JSON.stringify({ error: { message: 'Missing required fields' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (subscriptionPlan !== 'monthly' && subscriptionPlan !== 'yearly') {
      return new Response(
        JSON.stringify({ error: { message: 'Invalid subscription plan' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase environment variables')
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.3')
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // SSLCommerz credentials from environment variables
    const storeId = Deno.env.get('SSL_COMMERZ_STORE_ID') || 'novag690831b69b72e'
    const storePassword = Deno.env.get('SSL_COMMERZ_STORE_PASSWORD') || 'novag690831b69b72e@ssl'
    
    // Determine amount and product name
    const amount = subscriptionPlan === 'monthly' ? 3000 : 30000
    const productName = subscriptionPlan === 'monthly' 
      ? 'Kormo Connect Monthly Subscription'
      : 'Kormo Connect Yearly Subscription'

    // Generate unique transaction ID
    const tranId = `KORMO-${Date.now()}-${userId.substring(0, 8)}`
    const sessionId = crypto.randomUUID()

    // Base URL for callbacks (use deployed frontend URL)
    const baseUrl = Deno.env.get('APP_URL') || 'https://u4w2w4ys66uu.space.minimax.io'

    // Prepare SSLCommerz payment data
    const paymentData = new URLSearchParams({
      store_id: storeId,
      store_passwd: storePassword,
      total_amount: amount.toString(),
      currency: 'BDT',
      tran_id: tranId,
      success_url: `${baseUrl}/subscription/success?session_id=${sessionId}&plan=${subscriptionPlan}&user_id=${userId}`,
      fail_url: `${baseUrl}/subscription/fail?session_id=${sessionId}&user_id=${userId}`,
      cancel_url: `${baseUrl}/subscription/cancel?session_id=${sessionId}&user_id=${userId}`,
      ipn_url: `https://hisavlctrkuezvpgieqn.supabase.co/functions/v1/sslcommerz-ipn-handler?session_id=${sessionId}&plan=${subscriptionPlan}&user_id=${userId}`,
      cus_name: userName,
      cus_email: userEmail,
      cus_add1: 'Dhaka, Bangladesh',
      cus_city: 'Dhaka',
      cus_postcode: '1000',
      cus_country: 'Bangladesh',
      cus_phone: '01700000000',
      shipping_method: 'NO',
      product_name: productName,
      product_category: 'Software/Service',
      product_profile: 'general',
      multi_card_name: 'mastercard,visacard,amexcard',
      value_a: sessionId, // Store session ID for reference
      value_b: userId,
      value_c: subscriptionPlan,
    })

    // Create transaction record in database
    const { error: transactionError } = await supabaseAdmin
      .from('subscription_transactions')
      .insert({
        user_id: userId,
        session_id: sessionId,
        tran_id: tranId,
        amount: amount,
        currency: 'BDT',
        subscription_plan: subscriptionPlan,
        payment_status: 'pending'
      })

    if (transactionError) {
      console.error('Transaction record error:', transactionError)
      throw new Error('Failed to create transaction record')
    }

    // Initialize payment with SSLCommerz using v4 API
    const sslcommerzResponse = await fetch('https://sandbox.sslcommerz.com/gwprocess/v4/api.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: paymentData.toString(),
    })

    if (!sslcommerzResponse.ok) {
      const errorText = await sslcommerzResponse.text()
      console.error('SSLCommerz API error:', sslcommerzResponse.status, errorText)
      throw new Error(`Payment initialization failed: HTTP ${sslcommerzResponse.status}`)
    }

    const sslcommerzData = await sslcommerzResponse.json()
    
    console.log('SSLCommerz Response:', JSON.stringify(sslcommerzData, null, 2))

    if (sslcommerzData.status !== 'SUCCESS') {
      console.error('SSLCommerz initialization failed:', sslcommerzData)
      const errorMessage = sslcommerzData.failedreason || 
                          sslcommerzData.error || 
                          'Payment initialization failed'
      throw new Error(errorMessage)
    }

    if (!sslcommerzData.GatewayPageURL) {
      console.error('No GatewayPageURL in response:', sslcommerzData)
      throw new Error('Payment gateway URL not received')
    }

    console.log('Payment initialized successfully')
    console.log('Session ID:', sessionId)
    console.log('Transaction ID:', tranId)
    console.log('Gateway URL:', sslcommerzData.GatewayPageURL)

    return new Response(
      JSON.stringify({
        data: {
          sessionId: sessionId,
          gatewayUrl: sslcommerzData.GatewayPageURL,
          tranId: tranId,
          amount: amount,
          plan: subscriptionPlan
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Payment initiation error:', error)
    return new Response(
      JSON.stringify({ error: { message: error.message || 'Failed to initiate payment' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

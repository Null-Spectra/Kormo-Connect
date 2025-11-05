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
    const { sessionId, valId } = await req.json()

    if (!sessionId) {
      return new Response(
        JSON.stringify({ error: { message: 'Missing session ID' } }),
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

    // Get transaction from database
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('subscription_transactions')
      .select('*')
      .eq('session_id', sessionId)
      .single()

    if (txError || !transaction) {
      console.error('Transaction not found:', txError)
      return new Response(
        JSON.stringify({ error: { message: 'Transaction not found' } }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // If already processed, return success
    if (transaction.payment_status === 'success') {
      return new Response(
        JSON.stringify({
          data: {
            status: 'already_processed',
            message: 'Payment already confirmed'
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Validate payment with SSLCommerz if valId is provided
    let validated = false
    let validationData: any = null

    if (valId) {
      const storeId = 'novag690831b69b72e'
      const storePassword = 'novag690831b69b72e@ssl'

      const validationParams = new URLSearchParams({
        val_id: valId,
        store_id: storeId,
        store_passwd: storePassword,
        format: 'json'
      })

      try {
        const validationResponse = await fetch(
          `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?${validationParams.toString()}`,
          { 
            method: 'GET',
            headers: {
              'User-Agent': 'Kormo-Connect/1.0',
            }
          }
        )

        if (validationResponse.ok) {
          validationData = await validationResponse.json()
          
          console.log('Validation Response:', JSON.stringify(validationData, null, 2))
          
          // Check if validation was successful
          if (validationData.status === 'VALID' || validationData.status === 'VALIDATED') {
            // Additional validation checks
            if (validationData.tran_id === transaction.tran_id && 
                validationData.amount === transaction.amount.toString()) {
              validated = true
              console.log('Payment validated successfully:', validationData)
            } else {
              console.error('Transaction data mismatch in validation:', {
                expected_tran_id: transaction.tran_id,
                received_tran_id: validationData.tran_id,
                expected_amount: transaction.amount,
                received_amount: validationData.amount
              })
            }
          } else {
            console.error('Payment validation failed:', validationData)
          }
        } else {
          const errorText = await validationResponse.text()
          console.error('Validation request failed:', validationResponse.status, errorText)
        }
      } catch (validationError) {
        console.error('Validation request error:', validationError)
      }
    }

    // For sandbox, if no valId but transaction is in pending state, assume success (for testing purposes)
    // Note: In production, this should always require validation
    if (!valId && Deno.env.get('ENVIRONMENT') === 'sandbox') {
      validated = true
      console.log('Sandbox mode: Assuming payment success for testing')
    }

    if (validated) {
      // Calculate subscription expiration
      const now = new Date()
      const expiresOn = new Date(now)
      if (transaction.subscription_plan === 'monthly') {
        expiresOn.setDate(expiresOn.getDate() + 30)
      } else {
        expiresOn.setDate(expiresOn.getDate() + 365)
      }

      // Update transaction status
      const { error: updateTxError } = await supabaseAdmin
        .from('subscription_transactions')
        .update({
          payment_status: 'success',
          payment_method: validationData?.card_type || 'unknown',
          validation_data: validationData,
          updated_at: new Date().toISOString()
        })
        .eq('session_id', sessionId)

      if (updateTxError) {
        console.error('Failed to update transaction:', updateTxError)
      }

      // Activate user subscription
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .update({
          is_active: true,
          subscription_status: 'active',
          subscription_plan: transaction.subscription_plan,
          subscription_expires_on: expiresOn.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.user_id)

      if (profileError) {
        console.error('Failed to activate subscription:', profileError)
        throw new Error('Failed to activate subscription')
      }

      console.log('Subscription activated successfully for user:', transaction.user_id)

      return new Response(
        JSON.stringify({
          data: {
            status: 'success',
            message: 'Payment verified and subscription activated',
            expiresOn: expiresOn.toISOString()
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      // Update transaction to failed
      await supabaseAdmin
        .from('subscription_transactions')
        .update({
          payment_status: 'failed',
          validation_data: validationData,
          updated_at: new Date().toISOString(),
          error_message: 'Payment validation failed - not VALID or VALIDATED'
        })
        .eq('session_id', sessionId)

      return new Response(
        JSON.stringify({
          error: {
            message: 'Payment validation failed'
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Payment verification error:', error)
    return new Response(
      JSON.stringify({ error: { message: error.message || 'Payment verification failed' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

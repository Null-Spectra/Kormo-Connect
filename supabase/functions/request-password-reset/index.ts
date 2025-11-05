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
    const { email } = await req.json()

    // Validate email
    if (!email) {
      return new Response(
        JSON.stringify({ error: { message: 'Email is required' } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: { message: 'Invalid email format' } }),
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

    // Get client IP address for rate limiting
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 
                     req.headers.get('x-real-ip') || 
                     'unknown'

    // Check rate limit (3 requests per hour per email)
    const { data: rateLimitCheck, error: rateLimitError } = await supabaseAdmin
      .rpc('check_password_reset_rate_limit', {
        p_email: email.toLowerCase(),
        p_ip_address: clientIp,
        p_max_requests: 3,
        p_window_minutes: 60
      })

    if (rateLimitError) {
      console.error('Rate limit check error:', rateLimitError)
      // Continue anyway - don't block if rate limit check fails
    } else if (rateLimitCheck && rateLimitCheck.length > 0 && !rateLimitCheck[0].allowed) {
      // Rate limit exceeded
      return new Response(
        JSON.stringify({ 
          error: { 
            message: 'Too many password reset requests. Please try again later.' 
          } 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Record this request for rate limiting
    await supabaseAdmin
      .from('password_reset_rate_limits')
      .insert({
        email: email.toLowerCase(),
        ip_address: clientIp,
        request_count: 1,
        window_start: new Date().toISOString()
      })

    // Check if user exists (but don't reveal this information in response)
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (userError) {
      console.error('Error listing users:', userError)
      // Return generic success message for security
      return new Response(
        JSON.stringify({ 
          data: { 
            message: 'If an account with that email exists, a reset link has been sent.' 
          } 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const user = userData.users.find(u => u.email === email)

    if (!user) {
      // Return generic success message for security (don't reveal user doesn't exist)
      return new Response(
        JSON.stringify({ 
          data: { 
            message: 'If an account with that email exists, a reset link has been sent.' 
          } 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate secure token (64 characters)
    const tokenArray = new Uint8Array(32)
    crypto.getRandomValues(tokenArray)
    const token = Array.from(tokenArray, byte => byte.toString(16).padStart(2, '0')).join('')

    // Set expiration to 1 hour from now
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    // Store token in database
    const { error: tokenError } = await supabaseAdmin
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token: token,
        expires_at: expiresAt.toISOString(),
      })

    if (tokenError) {
      console.error('Error creating reset token:', tokenError)
      throw new Error('Failed to create password reset token')
    }

    // Determine the base URL for the reset link
    const baseUrl = Deno.env.get('APP_URL') || 'https://w8x1b5fkat9m.space.minimax.io'
    const resetLink = `${baseUrl}/reset-password?token=${token}`

    // Send email with reset link
    const emailSent = await sendPasswordResetEmail(email, resetLink, expiresAt)

    if (!emailSent) {
      console.error('Failed to send password reset email to:', email)
      // Don't fail the request - token is created and logged
    }

    console.log('Password reset requested for:', email)
    console.log('Reset link:', resetLink)
    console.log('Token expires at:', expiresAt.toISOString())

    return new Response(
      JSON.stringify({ 
        data: { 
          message: 'If an account with that email exists, a reset link has been sent.'
        } 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Password reset request error:', error)
    return new Response(
      JSON.stringify({ error: { message: 'An error occurred while processing your request' } }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/**
 * Send password reset email using Resend API
 * Configure RESEND_API_KEY in Supabase secrets to enable email delivery
 */
async function sendPasswordResetEmail(
  toEmail: string, 
  resetLink: string, 
  expiresAt: Date
): Promise<boolean> {
  try {
    const resendApiKey = Deno.env.get('RESEND_API_KEY')
    
    if (!resendApiKey) {
      console.warn('RESEND_API_KEY not configured - email not sent')
      console.log('Reset link for', toEmail, ':', resetLink)
      return false
    }

    const expiresInMinutes = Math.floor((expiresAt.getTime() - Date.now()) / 1000 / 60)

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding: 40px;">
                      <h1 style="margin: 0 0 24px 0; font-size: 24px; font-weight: 700; color: #18181b;">Password Reset Request</h1>
                      
                      <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #52525b;">
                        You requested to reset your password. Click the button below to set a new password for your account.
                      </p>
                      
                      <table cellpadding="0" cellspacing="0" style="margin: 32px 0;">
                        <tr>
                          <td align="center" style="border-radius: 6px; background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);">
                            <a href="${resetLink}" style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none;">
                              Reset Your Password
                            </a>
                          </td>
                        </tr>
                      </table>
                      
                      <div style="margin: 24px 0; padding: 16px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                        <p style="margin: 0; font-size: 14px; color: #92400e;">
                          <strong>This link will expire in ${expiresInMinutes} minutes.</strong>
                        </p>
                      </div>
                      
                      <p style="margin: 16px 0 0 0; font-size: 14px; line-height: 20px; color: #71717a;">
                        If the button doesn't work, copy and paste this link into your browser:
                      </p>
                      <p style="margin: 8px 0 0 0; font-size: 13px; color: #2563eb; word-break: break-all;">
                        ${resetLink}
                      </p>
                      
                      <hr style="margin: 32px 0; border: none; border-top: 1px solid #e4e4e7;">
                      
                      <p style="margin: 0; font-size: 13px; line-height: 20px; color: #71717a;">
                        If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
                      </p>
                      
                      <p style="margin: 16px 0 0 0; font-size: 13px; color: #a1a1aa;">
                        For security reasons, never share this email or link with anyone.
                      </p>
                    </td>
                  </tr>
                </table>
                
                <p style="margin: 24px 0 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">
                  Kormo Connect - Secure Password Reset
                </p>
              </td>
            </tr>
          </table>
        </body>
      </html>
    `

    const emailText = `
Password Reset Request

You requested to reset your password. Click the link below to set a new password:

${resetLink}

This link will expire in ${expiresInMinutes} minutes.

If you didn't request this password reset, please ignore this email.

---
Kormo Connect
    `

    // Send email via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Kormo Connect <noreply@resend.dev>',
        to: [toEmail],
        subject: 'Password Reset Request',
        html: emailHtml,
        text: emailText,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Resend API error:', response.status, errorData)
      return false
    }

    const result = await response.json()
    console.log('Email sent successfully via Resend:', result.id)
    return true

  } catch (error) {
    console.error('Error sending password reset email:', error)
    return false
  }
}

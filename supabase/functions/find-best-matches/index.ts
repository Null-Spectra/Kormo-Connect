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
        // Get environment variables
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!geminiApiKey) {
            throw new Error('Gemini API key not configured');
        }

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase configuration missing');
        }

        // Get user from auth header
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('No authorization header');
        }

        const token = authHeader.replace('Bearer ', '');

        // Verify token and get user
        const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': serviceRoleKey
            }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid token');
        }

        const userData = await userResponse.json();
        const userId = userData.id;

        // Fetch user profile
        const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=*`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!profileResponse.ok) {
            throw new Error('Failed to fetch user profile');
        }

        const profileData = await profileResponse.json();
        const profile = profileData[0];

        if (!profile) {
            throw new Error('Profile not found');
        }

        // Check if profile has minimum required information
        if (!profile.skills && !profile.experience && !profile.education) {
            return new Response(JSON.stringify({
                error: {
                    code: 'INCOMPLETE_PROFILE',
                    message: 'Please complete your profile with skills, experience, or education before using Find Best Matches.'
                }
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Check rate limiting (max 3 AI match requests per minute for free users, 10 for premium)
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60000);
        
        // Determine if user is premium
        const isPremium = profile.subscription_status === 'active' && 
                         profile.subscription_expires_on && 
                         new Date(profile.subscription_expires_on) > now;
        const maxRequests = isPremium ? 10 : 3;

        if (profile.last_analysis_time && profile.analysis_count_this_minute) {
            const lastAnalysis = new Date(profile.last_analysis_time);
            const countThisMinute = profile.analysis_count_this_minute || 0;

            if (lastAnalysis > oneMinuteAgo && countThisMinute >= maxRequests) {
                return new Response(JSON.stringify({
                    error: {
                        code: 'RATE_LIMIT_EXCEEDED',
                        message: `Rate limit reached. You can use Find Best Matches ${maxRequests} times per minute. Please wait and try again.${!isPremium ? ' Upgrade to Premium for higher limits!' : ''}`
                    }
                }), {
                    status: 429,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            }
        }

        // Prepare profile summary for AI analysis
        const profileSummary = `
        User Profile:
        - Name: ${profile.first_name || ''} ${profile.last_name || ''}
        - Skills: ${profile.skills || 'Not provided'}
        - Experience: ${profile.experience || 'Not provided'}
        - Education: ${profile.education || 'Not provided'}
        `;

        // Prepare Gemini AI prompt for job matching
        const prompt = `You are a career advisor AI. Analyze this professional's profile and suggest the best job search keywords and appropriate job level.

${profileSummary}

Based on this profile, provide:
1. 2-3 most relevant job search keywords (these should be specific job titles, technologies, or fields that match their skills and experience)
2. The most appropriate job level from: Entry, Intermediate, Senior, or Expert

Consider:
- Their skills and technical expertise
- Their work experience level and accomplishments
- Their educational background
- Industry standards for job levels

Job Level Guidelines:
- Entry: 0-2 years of experience, entry-level skills, fresh graduates
- Intermediate: 2-5 years of experience, solid skill set, some leadership
- Senior: 5-10 years of experience, advanced skills, team leadership
- Expert: 10+ years of experience, deep expertise, strategic leadership

Respond ONLY with a valid JSON object in this exact format:
{
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "level": "Entry|Intermediate|Senior|Expert"
}

Be specific with keywords - use actual job titles, technologies, or fields rather than generic terms.`;

        // Call Gemini AI
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 512,
                }
            })
        });

        if (!geminiResponse.ok) {
            const errorText = await geminiResponse.text();
            throw new Error(`Gemini API error: ${errorText}`);
        }

        const geminiData = await geminiResponse.json();
        const generatedText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!generatedText) {
            throw new Error('No response from Gemini AI');
        }

        // Parse Gemini response
        let suggestions;
        try {
            // Clean the response to extract JSON
            const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : generatedText;
            suggestions = JSON.parse(jsonString);

            // Validate the response structure
            if (!suggestions.keywords || !Array.isArray(suggestions.keywords)) {
                throw new Error('Invalid keywords format');
            }
            if (!suggestions.level || !['Entry', 'Intermediate', 'Senior', 'Expert'].includes(suggestions.level)) {
                throw new Error('Invalid job level');
            }

            // Ensure we have 2-3 keywords
            suggestions.keywords = suggestions.keywords.slice(0, 3);

        } catch (parseError) {
            console.error('Gemini response:', generatedText);
            throw new Error(`Failed to parse AI response: ${parseError.message}`);
        }

        // Update rate limit counters
        const updateCountData: any = {
            last_analysis_time: now.toISOString()
        };

        // Reset counter if outside the 1-minute window
        if (!profile.last_analysis_time || new Date(profile.last_analysis_time) <= oneMinuteAgo) {
            updateCountData.analysis_count_this_minute = 1;
        } else {
            updateCountData.analysis_count_this_minute = (profile.analysis_count_this_minute || 0) + 1;
        }

        // Update profile with new rate limit data
        await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify(updateCountData)
        });

        return new Response(JSON.stringify({
            data: {
                success: true,
                keywords: suggestions.keywords,
                level: suggestions.level,
                message: 'Best matches found successfully!'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Find best matches error:', error);

        const errorResponse = {
            error: {
                code: 'FIND_MATCHES_FAILED',
                message: error.message || 'Failed to find best matches. Please try again.'
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

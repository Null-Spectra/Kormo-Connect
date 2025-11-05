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
        const { profile, taskId } = await req.json();

        if (!profile || !taskId) {
            throw new Error('Profile and taskId are required');
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

        // OPTIMIZATION: Check cache first before API call
        const cacheKey = generateCacheKey(profile, taskId);
        const cachedAnalysis = await getCachedAnalysis(supabaseUrl, serviceRoleKey, cacheKey);
        
        if (cachedAnalysis) {
            console.log('Cache hit - returning cached analysis');
            return new Response(JSON.stringify({
                data: cachedAnalysis,
                cached: true
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Check rate limiting based on subscription plan
        const profileCheckResponse = await fetch(
            `${supabaseUrl}/rest/v1/profiles?id=eq.${workerId}&select=last_analysis_time,analysis_count_this_minute,subscription_plan`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (profileCheckResponse.ok) {
            const profiles = await profileCheckResponse.json();
            const profileData = profiles?.[0];

            if (profileData) {
                const now = new Date();
                const lastAnalysisTime = profileData.last_analysis_time ? new Date(profileData.last_analysis_time) : null;
                const timeDiff = lastAnalysisTime ? (now.getTime() - lastAnalysisTime.getTime()) / 1000 : 60;

                // Reset counter if more than 60 seconds have passed
                if (timeDiff >= 60) {
                    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${workerId}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            analysis_count_this_minute: 1,
                            last_analysis_time: now.toISOString()
                        })
                    });
                } else {
                    // Check if limit exceeded based on subscription plan
                    const currentCount = profileData.analysis_count_this_minute || 0;
                    const isPremium = profileData.subscription_plan && profileData.subscription_plan !== null;
                    const maxLimit = isPremium ? 10 : 3; // Premium: 10 analyses/min, Free: 3 analyses/min
                    
                    if (currentCount >= maxLimit) {
                        const remainingTime = Math.ceil(60 - timeDiff);
                        throw new Error(`Rate limit exceeded. ${isPremium ? 'Premium users' : 'Free users'} can perform ${maxLimit} analyses per minute. Please wait ${remainingTime} seconds before analyzing another task.`);
                    }

                    // Increment counter
                    await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${workerId}`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                            'apikey': serviceRoleKey,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            analysis_count_this_minute: currentCount + 1,
                            last_analysis_time: now.toISOString()
                        })
                    });
                }
            }
        }

        // Fetch task details using user's auth token to respect RLS
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

        // Get Gemini API key from environment
        const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
        if (!geminiApiKey) {
            throw new Error('GEMINI_API_KEY not configured');
        }

        // OPTIMIZATION: Ultra-compact prompt for minimal token usage
        const prompt = buildOptimizedPrompt(profile, task);

        // Call Gemini API with optimized configuration
        let geminiData;
        const maxRetries = 3;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            const geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${geminiApiKey}`,
                {
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
                            temperature: 0.3, // Lower for more consistent responses
                            topK: 20, // More focused responses
                            topP: 0.8, // Reduced for efficiency
                            maxOutputTokens: 500, // Reduced from 1024 for bulletpoints
                        }
                    })
                }
            );

            if (geminiResponse.ok) {
                geminiData = await geminiResponse.json();
                break;
            }

            const errorText = await geminiResponse.text();
            
            // If it's a rate limit error and we have retries left, wait and retry
            if (geminiResponse.status === 429 && attempt < maxRetries) {
                const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff: 2s, 4s, 8s
                console.log(`Rate limit hit, retrying in ${waitTime}ms (attempt ${attempt}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                continue;
            }
            
            // Handle quota exhaustion specifically
            if (errorText.includes('Resource exhausted') || errorText.includes('RESOURCE_EXHAUSTED')) {
                throw new Error(`Gemini API quota exhausted. Please try again later. This might be due to high usage.`);
            }
            
            throw new Error(`Gemini API error (attempt ${attempt}/${maxRetries}): ${errorText}`);
        }
        
        if (!geminiData) {
            throw new Error('Failed to get response from Gemini API after multiple attempts');
        }
        
        // Extract the response text
        const responseText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!responseText) {
            throw new Error('No response from Gemini API');
        }

        // OPTIMIZATION: Parse bulletpoint response
        const analysisResult = parseBulletpointResponse(responseText);

        // OPTIMIZATION: Cache the result for future similar requests
        await cacheAnalysis(supabaseUrl, serviceRoleKey, cacheKey, analysisResult);

        // Check if analysis already exists and update it (for re-analysis)
        const existingAnalysisResponse = await fetch(
            `${supabaseUrl}/rest/v1/analyses?worker_id=eq.${workerId}&task_id=eq.${taskId}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        const existingAnalyses = await existingAnalysisResponse.json();
        
        // Store analysis result in database
        const analysisData = {
            worker_id: workerId,
            task_id: taskId,
            score: Math.round(analysisResult.score * 100), // Store as integer 0-100
            strengths: analysisResult.strengths,
            weaknesses: analysisResult.weaknesses,
            suggestions: analysisResult.suggestions,
            analysis_result: analysisResult, // Store full result as JSONB
            updated_at: new Date().toISOString()
        };

        let response;
        if (existingAnalyses && existingAnalyses.length > 0) {
            // Update existing analysis
            response = await fetch(
                `${supabaseUrl}/rest/v1/analyses?worker_id=eq.${workerId}&task_id=eq.${taskId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(analysisData)
                }
            );
        } else {
            // Insert new analysis
            response = await fetch(
                `${supabaseUrl}/rest/v1/analyses`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify(analysisData)
                }
            );
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to store analysis: ${errorText}`);
        }

        return new Response(JSON.stringify({
            data: analysisResult
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Analysis error:', error);

        // Provide user-friendly error messages
        let userMessage = error.message;
        let errorCode = 'ANALYSIS_FAILED';
        
        if (error.message.includes('Gemini API quota exhausted') || 
            error.message.includes('Resource exhausted') ||
            error.message.includes('RESOURCE_EXHAUSTED')) {
            userMessage = 'AI analysis service is temporarily unavailable due to high usage. Please try again in a few minutes.';
            errorCode = 'QUOTA_EXHAUSTED';
        } else if (error.message.includes('Authentication failed')) {
            userMessage = 'Please log in again to continue using the analysis feature.';
            errorCode = 'AUTHENTICATION_REQUIRED';
        } else if (error.message.includes('Rate limit exceeded')) {
            userMessage = 'You are analyzing tasks too quickly. Please wait before trying again.';
            errorCode = 'RATE_LIMIT_EXCEEDED';
        }

        const errorResponse = {
            error: {
                code: errorCode,
                message: userMessage
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

// OPTIMIZATION FUNCTIONS

function generateCacheKey(profile, taskId) {
    // Create a hash-like key based on profile skills/experience and task requirements
    const profileKey = `${profile.skills || ''}_${profile.experience || ''}_${profile.education || ''}`.toLowerCase().replace(/\s+/g, '');
    return `analysis_${taskId}_${profileKey.substring(0, 20)}`;
}

async function getCachedAnalysis(supabaseUrl, serviceRoleKey, cacheKey) {
    try {
        // Check if we have a cached analysis (valid for 24 hours)
        const response = await fetch(
            `${supabaseUrl}/rest/v1/analysis_cache?cache_key=eq.${cacheKey}&created_at=gte.${new Date(Date.now() - 24*60*60*1000).toISOString()}&select=analysis_result`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        if (response.ok) {
            const cached = await response.json();
            return cached?.[0]?.analysis_result || null;
        }
    } catch (error) {
        console.log('Cache check failed:', error.message);
    }
    return null;
}

async function cacheAnalysis(supabaseUrl, serviceRoleKey, cacheKey, analysisResult) {
    try {
        await fetch(
            `${supabaseUrl}/rest/v1/analysis_cache`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    cache_key: cacheKey,
                    analysis_result: analysisResult,
                    created_at: new Date().toISOString()
                })
            }
        );
    } catch (error) {
        console.log('Cache store failed:', error.message);
    }
}

function buildOptimizedPrompt(profile, task) {
    // ENHANCED: Strict data formatter and hiring analyst prompt
    return `You are a strict data formatter and hiring analyst. Your ONLY task is to analyze the worker-job fit from the DATA block and return the analysis in the exact format specified.

**RULES:**
1. Generate a 'Score' from 0.00 (no fit) to 1.00 (perfect fit).
2. Follow the 'STRICT OUTPUT FORMAT' precisely.
3. Do NOT add any text, explanations, or conversational elements before or after the formatted response.
4. The response MUST begin with 'Score:'.
5. Each main section (Strengths, Weaknesses, Suggestions) MUST be a bullet point.
6. Each item under a main section MUST be a sub-bullet point.

**DATA:**
WORKER: Skills: ${(profile.skills || '').substring(0, 50)} | Exp: ${(profile.experience || '').substring(0, 30)} | Edu: ${(profile.education || '').substring(0, 30)}
JOB: ${task.title} | Req: ${(task.required_skills || '').substring(0, 50)} | Level: ${task.experience_level || 'Any'}

**STRICT OUTPUT FORMAT:**
Score: 0.XX
• Strengths:
• [Item 1]
• [Item 2]
• [Item 3]
• Weaknesses:
• [Item 1]
• [Item 2] 
• [Item 3]
• Suggestions:
• [Item 1]
• [Item 2]
• [Item 3]`;
}

function parseBulletpointResponse(responseText) {
    try {
        // Extract score and bulletpoints from response
        const lines = responseText.split('\n').map(line => line.trim()).filter(line => line);
        
        let score = 0.5;
        let strengths = [];
        let weaknesses = [];
        let suggestions = [];
        
        // More robust parsing: find all sections and extract bulletpoints
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            // Extract score
            if (line.toLowerCase().includes('score:')) {
                const scoreMatch = line.match(/(\d+\.?\d*)/);
                if (scoreMatch) {
                    score = Math.max(0, Math.min(1, parseFloat(scoreMatch[1])));
                }
            }
            
            // Extract strengths section
            if (line.toLowerCase().includes('strength')) {
                // Look for bulletpoints after this line
                const bulletItems = [];
                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j];
                    if (nextLine.startsWith('•') || nextLine.startsWith('-')) {
                        bulletItems.push(nextLine.replace(/^[•-]\s*/, '').trim());
                    } else if (nextLine.toLowerCase().includes('weakness') || 
                              nextLine.toLowerCase().includes('suggestion') ||
                              nextLine.startsWith('•')) {
                        break;
                    }
                }
                if (bulletItems.length > 0) {
                    strengths = bulletItems.slice(0, 3);
                }
            }
            
            // Extract weaknesses section  
            if (line.toLowerCase().includes('weakness')) {
                const bulletItems = [];
                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j];
                    if (nextLine.startsWith('•') || nextLine.startsWith('-')) {
                        bulletItems.push(nextLine.replace(/^[•-]\s*/, '').trim());
                    } else if (nextLine.toLowerCase().includes('suggestion') ||
                              nextLine.startsWith('•')) {
                        break;
                    }
                }
                if (bulletItems.length > 0) {
                    weaknesses = bulletItems.slice(0, 3);
                }
            }
            
            // Extract suggestions section
            if (line.toLowerCase().includes('suggestion')) {
                const bulletItems = [];
                for (let j = i + 1; j < lines.length; j++) {
                    const nextLine = lines[j];
                    if (nextLine.startsWith('•') || nextLine.startsWith('-')) {
                        bulletItems.push(nextLine.replace(/^[•-]\s*/, '').trim());
                    } else {
                        break;
                    }
                }
                if (bulletItems.length > 0) {
                    suggestions = bulletItems.slice(0, 3);
                }
            }
        }
        
        // Fallback to default content if no bulletpoints found
        return {
            score,
            strengths: strengths.length > 0 ? strengths : ['Strong technical foundation', 'Relevant experience background'],
            weaknesses: weaknesses.length > 0 ? weaknesses : ['Some skill gaps to address', 'Could benefit from additional training'],
            suggestions: suggestions.length > 0 ? suggestions : ['Continue developing relevant skills', 'Build more experience in key areas']
        };
    } catch (error) {
        console.error('Parse error:', error);
        return {
            score: 0.5,
            strengths: ['Profile shows potential for this role'],
            weaknesses: ['Some areas for improvement identified'],
            suggestions: ['Focus on developing key job requirements']
        };
    }
}
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
        const { cvFile, filename } = await req.json();

        if (!cvFile || !filename) {
            throw new Error('CV file and filename are required');
        }

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

        // Check rate limiting (max 5 analyses per minute)
        const now = new Date();
        const oneMinuteAgo = new Date(now.getTime() - 60000);

        const rateCheckResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=analysis_count_this_minute,last_analysis_time`, {
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json'
            }
        });

        if (!rateCheckResponse.ok) {
            throw new Error('Failed to check rate limit');
        }

        const rateData = await rateCheckResponse.json();
        const profile = rateData[0];

        if (profile) {
            const lastAnalysis = new Date(profile.last_analysis_time);
            const countThisMinute = profile.analysis_count_this_minute || 0;

            if (lastAnalysis > oneMinuteAgo && countThisMinute >= 5) {
                throw new Error('Rate limit exceeded. Please wait before analyzing another CV.');
            }
        }

        // Convert base64 file to binary for processing
        let cvText = '';
        
        if (filename.toLowerCase().endsWith('.txt')) {
            // Direct text processing for .txt files
            const textData = atob(cvFile);
            cvText = textData;
        } else {
            // For PDF/DOCX files, we'll ask Gemini to handle the parsing
            cvText = `CV file: ${filename}`;
        }

        // Prepare Gemini AI prompt
        const prompt = `Analyze this CV/resume and extract the following information in JSON format:

        - first_name: person's first name
        - last_name: person's last name  
        - skills: main technical and soft skills (as a comma-separated string)
        - work_experience: professional experience summary (detailed text)
        - education: educational background (degree, institution, year)
        - phone_number: contact phone number if available

        CV content: ${cvText}

        Respond ONLY with a valid JSON object containing these fields. If any information is not available, set the field to null or empty string.`;

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
                    temperature: 0.1,
                    maxOutputTokens: 2048,
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
        let extractedData;
        try {
            // Clean the response to extract JSON
            const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
            const jsonString = jsonMatch ? jsonMatch[0] : generatedText;
            extractedData = JSON.parse(jsonString);
        } catch (parseError) {
            throw new Error(`Failed to parse Gemini response: ${parseError.message}`);
        }

        // Map the extracted data to our profile fields
        const profileData = {
            first_name: extractedData.first_name || '',
            last_name: extractedData.last_name || '',
            skills: extractedData.skills || '',
            experience: extractedData.work_experience || '',
            education: extractedData.education || '',
            phone: extractedData.phone_number || '',
            last_analysis_time: now.toISOString(),
            analysis_count_this_minute: (profile?.analysis_count_this_minute || 0) + 1
        };

        // Update profile with extracted data
        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            body: JSON.stringify(profileData)
        });

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`Failed to update profile: ${errorText}`);
        }

        const updatedProfile = await updateResponse.json();

        return new Response(JSON.stringify({
            data: {
                success: true,
                extracted_data: profileData,
                profile: updatedProfile[0],
                message: 'CV analyzed successfully and profile auto-filled'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('CV analysis error:', error);

        const errorResponse = {
            error: {
                code: 'CV_ANALYSIS_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
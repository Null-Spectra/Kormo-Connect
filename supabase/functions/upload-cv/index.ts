import { serve } from "https://deno.land/std@0.190.0/http/server.ts"

serve(async (req) => {
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
        const { cvData, filename } = await req.json();

        if (!cvData || !filename) {
            throw new Error('CV data and filename are required');
        }

        // Determine content type and validate file extension
        const lowerFilename = filename.toLowerCase();
        let contentType = 'application/octet-stream';
        
        if (lowerFilename.endsWith('.pdf')) {
            contentType = 'application/pdf';
        } else if (lowerFilename.endsWith('.doc')) {
            contentType = 'application/msword';
        } else if (lowerFilename.endsWith('.docx')) {
            contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } else if (lowerFilename.endsWith('.txt')) {
            contentType = 'text/plain';
        } else {
            throw new Error('Unsupported file type. Only PDF, DOC, DOCX, or TXT files are allowed.');
        }

        // Get Supabase credentials
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

        if (!serviceRoleKey || !supabaseUrl || !supabaseAnonKey) {
            throw new Error('Supabase configuration missing');
        }

        // Get worker ID from auth token
        const token = authHeader.replace('Bearer ', '');
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
            throw new Error('Invalid auth token format');
        }
        
        const payload = JSON.parse(atob(tokenParts[1]));
        const workerId = payload.sub;

        if (!workerId) {
            throw new Error('Could not extract user ID from token');
        }

        // Get existing CV info from profile
        const profileResponse = await fetch(
            `${supabaseUrl}/rest/v1/profiles?id=eq.${workerId}&select=cv_url,cv_filename`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (profileResponse.ok) {
            const profiles = await profileResponse.json();
            const profile = profiles?.[0];

            // Delete old CV if it exists
            if (profile?.cv_url) {
                // NOTE: This deletion logic assumes the storage path structure is consistent
                const oldPathMatch = profile.cv_url.match(/\/worker-cvs\/(.*)/);
                const oldPath = oldPathMatch ? oldPathMatch[1] : null;
                
                if (oldPath) {
                    // Use the service role key for storage deletion
                    await fetch(`${supabaseUrl}/storage/v1/object/worker-cvs/${oldPath}`, {
                        method: 'DELETE',
                        headers: {
                            'Authorization': `Bearer ${serviceRoleKey}`,
                        }
                    });
                }
            }
        }

        // Extract base64 data
        const base64Data = cvData.includes(',') ? cvData.split(',')[1] : cvData;
        
        // Convert base64 to binary
        const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

        // Validate file size (10MB limit)
        if (binaryData.length > 10485760) {
            throw new Error('File size exceeds 10MB limit');
        }

        // Generate storage path with timestamp
        const timestamp = Date.now();
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `${workerId}/${timestamp}-${sanitizedFilename}`;

        // Upload to Supabase Storage
        const uploadResponse = await fetch(`${supabaseUrl}/storage/v1/object/worker-cvs/${storagePath}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': contentType, // Use determined content type
                'x-upsert': 'true'
            },
            body: binaryData
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Upload failed: ${errorText}`);
        }

        // Get public URL
        const publicUrl = `${supabaseUrl}/storage/v1/object/public/worker-cvs/${storagePath}`;

        // Update profile with CV metadata
        const updateResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${workerId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'apikey': serviceRoleKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                cv_url: publicUrl,
                cv_filename: sanitizedFilename,
                cv_uploaded_at: new Date().toISOString()
            })
        });

        if (!updateResponse.ok) {
            const errorText = await updateResponse.text();
            throw new Error(`Failed to update profile: ${errorText}`);
        }

        return new Response(JSON.stringify({
            data: {
                cv_url: publicUrl,
                cv_filename: sanitizedFilename,
                cv_uploaded_at: new Date().toISOString()
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('CV upload error:', error);

        const errorResponse = {
            error: {
                code: 'CV_UPLOAD_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
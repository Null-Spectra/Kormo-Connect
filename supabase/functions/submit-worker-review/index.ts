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
        const { 
            taskId, 
            workerId, 
            qualityRating, 
            timelinessRating, 
            reliabilityRating, 
            overallRating, 
            feedbackText 
        } = await req.json();

        // Validate required fields
        if (!taskId || !workerId) {
            throw new Error('Task ID and Worker ID are required');
        }

        if (!overallRating || overallRating < 1 || overallRating > 5) {
            throw new Error('Overall rating must be between 1 and 5');
        }

        // Get user from auth header
        const authHeader = req.headers.get('authorization');
        if (!authHeader) {
            throw new Error('No authorization header');
        }

        const token = authHeader.replace('Bearer ', '');
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabaseUrl = Deno.env.get('SUPABASE_URL');

        if (!serviceRoleKey || !supabaseUrl) {
            throw new Error('Supabase configuration missing');
        }

        // Verify token and get user
        const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'apikey': serviceRoleKey
            }
        });

        if (!userResponse.ok) {
            throw new Error('Invalid authentication token');
        }

        const userData = await userResponse.json();
        const companyId = userData.id;

        // Check if review already exists
        const checkResponse = await fetch(
            `${supabaseUrl}/rest/v1/worker_reviews?task_id=eq.${taskId}&worker_id=eq.${workerId}&company_id=eq.${companyId}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        const existingReviews = await checkResponse.json();
        const reviewExists = existingReviews && existingReviews.length > 0;

        // Prepare review data
        const reviewData = {
            task_id: taskId,
            worker_id: workerId,
            company_id: companyId,
            quality_rating: qualityRating,
            timeliness_rating: timelinessRating,
            reliability_rating: reliabilityRating,
            overall_rating: overallRating,
            feedback_text: feedbackText || ''
        };

        let reviewResponse;

        if (reviewExists) {
            // Update existing review
            reviewResponse = await fetch(
                `${supabaseUrl}/rest/v1/worker_reviews?task_id=eq.${taskId}&worker_id=eq.${workerId}&company_id=eq.${companyId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=representation'
                    },
                    body: JSON.stringify(reviewData)
                }
            );
        } else {
            // Insert new review
            reviewResponse = await fetch(`${supabaseUrl}/rest/v1/worker_reviews`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify(reviewData)
            });
        }

        if (!reviewResponse.ok) {
            const errorText = await reviewResponse.text();
            throw new Error(`Database operation failed: ${errorText}`);
        }

        const reviewResult = await reviewResponse.json();

        // Also update the ratings table for compatibility with existing performance tracking
        const ratingData = {
            task_id: taskId,
            reviewer_id: companyId,
            reviewee_id: workerId,
            rating: overallRating,
            review_text: feedbackText || '',
            review_type: 'company_to_worker',
            categories: {
                quality: qualityRating,
                timeliness: timelinessRating,
                reliability: reliabilityRating
            }
        };

        // Check if rating exists in ratings table
        const checkRatingResponse = await fetch(
            `${supabaseUrl}/rest/v1/ratings?task_id=eq.${taskId}&reviewee_id=eq.${workerId}&reviewer_id=eq.${companyId}`,
            {
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                }
            }
        );

        const existingRatings = await checkRatingResponse.json();
        const ratingExists = existingRatings && existingRatings.length > 0;

        if (ratingExists) {
            // Update existing rating
            await fetch(
                `${supabaseUrl}/rest/v1/ratings?task_id=eq.${taskId}&reviewee_id=eq.${workerId}&reviewer_id=eq.${companyId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${serviceRoleKey}`,
                        'apikey': serviceRoleKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(ratingData)
                }
            );
        } else {
            // Insert new rating
            await fetch(`${supabaseUrl}/rest/v1/ratings`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${serviceRoleKey}`,
                    'apikey': serviceRoleKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(ratingData)
            });
        }

        return new Response(JSON.stringify({
            data: {
                review: reviewResult[0],
                message: reviewExists ? 'Review updated successfully' : 'Review submitted successfully'
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Review submission error:', error);

        const errorResponse = {
            error: {
                code: 'REVIEW_SUBMISSION_FAILED',
                message: error.message
            }
        };

        return new Response(JSON.stringify(errorResponse), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});

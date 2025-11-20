import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const traceId = crypto.randomUUID();
  console.log(`[${traceId}] Starting scheduled posts execution`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get posts that are scheduled and past their scheduled time
    const { data: scheduledPosts, error: fetchError } = await supabase
      .from('posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())
      .limit(50);

    if (fetchError) {
      console.error('Error fetching scheduled posts:', fetchError);
      throw fetchError;
    }

    if (!scheduledPosts || scheduledPosts.length === 0) {
      console.log(`[${traceId}] No scheduled posts to execute`);
      return new Response(
        JSON.stringify({
          success: true,
          executed: 0,
          succeeded: 0,
          failed: 0,
          message: 'No scheduled posts to execute',
          trace_id: traceId,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`[${traceId}] Found ${scheduledPosts.length} posts to execute`);

    let succeeded = 0;
    let failed = 0;
    const results = [];

    for (const post of scheduledPosts) {
      try {
        console.log(`[${traceId}] Processing post ${post.id}`);

        // Update status to processing
        await supabase
          .from('posts')
          .update({ status: 'processing' })
          .eq('id', post.id);

        // Get account token
        const { data: accountToken, error: tokenError } = await supabase
          .from('account_tokens')
          .select('x_user_id, access_token')
          .eq('account_id', post.account_id)
          .eq('is_active', true)
          .single();

        if (tokenError || !accountToken) {
          throw new Error('Account token not found');
        }

        // Post to Twitter via proxy
        const proxyResponse = await fetch(
          `${supabaseUrl}/functions/v1/twitter-api-proxy`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              endpoint: '/2/tweets',
              method: 'POST',
              body: { text: post.content },
              x_user_id: accountToken.x_user_id,
              account_id: post.account_id,
              user_id: post.user_id,
            }),
          }
        );

        if (!proxyResponse.ok) {
          const errorText = await proxyResponse.text();
          console.error(`[${traceId}] Proxy error for post ${post.id}:`, errorText);
          throw new Error(`Twitter API failed: ${errorText}`);
        }

        const proxyResult = await proxyResponse.json();

        if (!proxyResult.success) {
          throw new Error(proxyResult.error || 'Twitter API request failed');
        }

        const tweetId = proxyResult.data?.data?.id;

        if (!tweetId) {
          throw new Error('Tweet ID not returned from API');
        }

        // Update post with success
        const { error: updateError } = await supabase
          .from('posts')
          .update({
            status: 'posted',
            twitter_id: tweetId,
            posted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', post.id);

        if (updateError) {
          console.error(`[${traceId}] Update error for post ${post.id}:`, updateError);
        }

        console.log(`[${traceId}] Successfully posted ${post.id} as tweet ${tweetId}`);
        succeeded++;
        results.push({ post_id: post.id, tweet_id: tweetId, status: 'success' });
      } catch (error) {
        console.error(`[${traceId}] Error posting ${post.id}:`, error);

        // Update post with failure
        await supabase
          .from('posts')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', post.id);

        failed++;
        results.push({
          post_id: post.id,
          status: 'failed',
          error: error.message
        });
      }
    }

    console.log(`[${traceId}] Execution complete: ${succeeded} succeeded, ${failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        executed: scheduledPosts.length,
        succeeded,
        failed,
        results: results.slice(0, 10), // Return first 10 results
        trace_id: traceId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error(`[${traceId}] Fatal error:`, error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
        trace_id: traceId,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

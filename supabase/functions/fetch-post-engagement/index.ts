import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { post_id } = await req.json();

    // Get the post with its Twitter ID and account token
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select(`
        *,
        account:main_accounts(id, handle)
      `)
      .eq('id', post_id)
      .single();

    if (postError || !post) {
      throw new Error('Post not found');
    }

    if (!post.twitter_id) {
      throw new Error('Post has no Twitter ID');
    }

    // Get account token
    const { data: tokenData, error: tokenError } = await supabase
      .from('account_tokens')
      .select('access_token')
      .eq('account_id', post.account_id)
      .eq('account_type', 'main')
      .single();

    if (tokenError || !tokenData) {
      throw new Error('No token found for account');
    }

    // Fetch tweet metrics from Twitter API
    const tweetResponse = await fetch(
      `https://api.twitter.com/2/tweets/${post.twitter_id}?tweet.fields=public_metrics`,
      {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
        },
      }
    );

    if (!tweetResponse.ok) {
      const errorData = await tweetResponse.json();
      throw new Error(errorData.detail || 'Failed to fetch tweet metrics');
    }

    const tweetData = await tweetResponse.json();
    const metrics = tweetData.data?.public_metrics;

    if (!metrics) {
      throw new Error('No metrics available');
    }

    // Update post with new metrics
    const { error: updateError } = await supabase
      .from('posts')
      .update({
        like_count: metrics.like_count || 0,
        retweet_count: metrics.retweet_count || 0,
        reply_count: metrics.reply_count || 0,
        quote_count: metrics.quote_count || 0,
        impression_count: metrics.impression_count || 0,
        engagement_updated_at: new Date().toISOString(),
      })
      .eq('id', post_id);

    if (updateError) {
      throw updateError;
    }

    // Store in history
    await supabase
      .from('post_engagement_history')
      .insert({
        post_id,
        like_count: metrics.like_count || 0,
        retweet_count: metrics.retweet_count || 0,
        reply_count: metrics.reply_count || 0,
        quote_count: metrics.quote_count || 0,
        impression_count: metrics.impression_count || 0,
      });

    return new Response(
      JSON.stringify({
        success: true,
        metrics: {
          like_count: metrics.like_count || 0,
          retweet_count: metrics.retweet_count || 0,
          reply_count: metrics.reply_count || 0,
          quote_count: metrics.quote_count || 0,
          impression_count: metrics.impression_count || 0,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Fetch engagement error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

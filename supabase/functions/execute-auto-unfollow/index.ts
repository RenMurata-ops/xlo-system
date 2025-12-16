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

    // Get pending unfollows that are due
    const { data: pendingUnfollows, error: fetchError } = await supabase
      .from('follow_relationships')
      .select(`
        *,
        follower_account:spam_accounts(id, handle),
        follower_follow_account:follow_accounts(id, target_handle)
      `)
      .eq('status', 'pending')
      .lte('unfollow_at', new Date().toISOString())
      .limit(50);

    if (fetchError) {
      throw fetchError;
    }

    if (!pendingUnfollows || pendingUnfollows.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending unfollows', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      processed: 0,
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const unfollow of pendingUnfollows) {
      try {
        // Get account token for the follower account
        const { data: tokenData, error: tokenError } = await supabase
          .from('account_tokens')
          .select('access_token, refresh_token, expires_at')
          .eq('account_id', unfollow.follower_account_id)
          .single();

        if (tokenError || !tokenData) {
          throw new Error(`No token found for account ${unfollow.follower_account_id}`);
        }

        // Check if token is expired and refresh if needed
        let accessToken = tokenData.access_token;
        if (new Date(tokenData.expires_at) < new Date()) {
          // Token expired, need to refresh
          // This would require the twitter app credentials
          throw new Error('Token expired, refresh not implemented');
        }

        // Call Twitter API to unfollow
        const unfollowResponse = await fetch(
          `https://api.twitter.com/2/users/${unfollow.follower_account_id}/following/${unfollow.target_twitter_id}`,
          {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!unfollowResponse.ok) {
          const errorData = await unfollowResponse.json();
          throw new Error(errorData.detail || 'Unfollow API call failed');
        }

        // Mark as completed
        await supabase
          .from('follow_relationships')
          .update({
            status: 'completed',
            unfollowed_at: new Date().toISOString(),
          })
          .eq('id', unfollow.id);

        results.success++;

        // Add small delay between API calls
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error: any) {
        results.failed++;
        results.errors.push(`${unfollow.id}: ${error.message}`);

        // Mark as failed
        await supabase
          .from('follow_relationships')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', unfollow.id);
      }

      results.processed++;
    }

    return new Response(
      JSON.stringify({
        message: 'Auto-unfollow execution completed',
        ...results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Auto-unfollow error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

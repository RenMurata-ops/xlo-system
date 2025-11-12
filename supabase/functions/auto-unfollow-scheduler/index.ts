// auto-unfollow-scheduler - Automatic unfollow scheduler
// Purpose: Automatically unfollow users after specified days
// Execution: Cron (every hour recommended)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface UnfollowResult {
  follow_id: string;
  account_id: string;
  target_user_id: string;
  target_username: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

async function unfollowUser(
  supabase: any,
  followRecord: any
): Promise<UnfollowResult> {
  const result: UnfollowResult = {
    follow_id: followRecord.id,
    account_id: followRecord.account_id,
    target_user_id: followRecord.target_user_id,
    target_username: followRecord.target_username,
    status: 'failed',
  };

  try {
    // Get account token
    const { data: token, error: tokenError } = await supabase
      .from('account_tokens')
      .select('*')
      .eq('id', followRecord.account_id)
      .single();

    if (tokenError || !token) {
      result.error = 'Token not found';
      return result;
    }

    // Check if token is valid
    if (!token.is_active || token.is_suspended) {
      result.status = 'skipped';
      result.error = 'Account is inactive or suspended';
      return result;
    }

    // Check if user follows back (optional: don't unfollow followers)
    // This would require additional API call to check friendship
    // For now, we'll proceed with unfollow

    // Unfollow via Twitter API
    const unfollowResponse = await fetch(
      `https://api.twitter.com/2/users/${token.x_user_id}/following/${followRecord.target_user_id}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
        },
      }
    );

    if (!unfollowResponse.ok) {
      const errorData = await unfollowResponse.text();
      result.error = errorData;

      // Handle specific errors
      if (unfollowResponse.status === 403) {
        result.status = 'skipped';
        result.error = 'Account suspended or not following';
      }

      return result;
    }

    // Update follow history
    await supabase
      .from('follow_history')
      .update({
        status: 'unfollowed',
        unfollowed_at: new Date().toISOString(),
      })
      .eq('id', followRecord.id);

    console.log(`✅ Unfollowed ${followRecord.target_username} from ${token.x_username}`);

    result.status = 'success';
    return result;

  } catch (error) {
    result.error = error.message;
    return result;
  }
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get follow records scheduled for unfollow
    const { data: scheduledUnfollows, error: fetchError } = await supabase
      .from('follow_history')
      .select('*')
      .eq('status', 'following')
      .eq('auto_unfollow_enabled', true)
      .not('scheduled_unfollow_at', 'is', null)
      .lte('scheduled_unfollow_at', new Date().toISOString())
      .order('scheduled_unfollow_at', { ascending: true })
      .limit(100); // Process max 100 per run

    if (fetchError) {
      throw new Error(`Failed to fetch scheduled unfollows: ${fetchError.message}`);
    }

    if (!scheduledUnfollows || scheduledUnfollows.length === 0) {
      console.log('No scheduled unfollows found');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No scheduled unfollows',
          processed: 0,
          succeeded: 0,
          failed: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Found ${scheduledUnfollows.length} users to unfollow`);

    // Group by account to batch unfollows
    const accountGroups = new Map<string, any[]>();
    for (const follow of scheduledUnfollows) {
      if (!accountGroups.has(follow.account_id)) {
        accountGroups.set(follow.account_id, []);
      }
      accountGroups.get(follow.account_id)!.push(follow);
    }

    // Execute unfollows
    const results: UnfollowResult[] = [];

    for (const [accountId, follows] of accountGroups.entries()) {
      console.log(`Processing ${follows.length} unfollows for account ${accountId}`);

      for (const follow of follows) {
        const result = await unfollowUser(supabase, follow);
        results.push(result);

        // Wait 2 seconds between unfollows (rate limit protection)
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Wait 5 seconds between accounts
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // Count results
    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    console.log(`Unfollow complete: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`);

    // Send notifications if there are failures
    if (failedCount > 0) {
      const failedResults = results.filter(r => r.status === 'failed');

      // Group by user
      const userFollows = new Map<string, UnfollowResult[]>();
      for (const result of failedResults) {
        const follow = scheduledUnfollows.find(f => f.id === result.follow_id);
        if (follow) {
          if (!userFollows.has(follow.user_id)) {
            userFollows.set(follow.user_id, []);
          }
          userFollows.get(follow.user_id)!.push(result);
        }
      }

      // Create notifications
      for (const [userId, failures] of userFollows.entries()) {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: 'Auto-Unfollow Failed',
          message: `Failed to unfollow ${failures.length} user(s)`,
          type: 'warning',
          priority: 'medium',
          category: 'execution',
          metadata: { failures },
        });
      }
    }

    // Send success notification for large batches
    if (successCount >= 50) {
      const userGroups = new Map<string, number>();
      for (const result of results.filter(r => r.status === 'success')) {
        const follow = scheduledUnfollows.find(f => f.id === result.follow_id);
        if (follow) {
          userGroups.set(follow.user_id, (userGroups.get(follow.user_id) || 0) + 1);
        }
      }

      for (const [userId, count] of userGroups.entries()) {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: 'Auto-Unfollow Completed',
          message: `Successfully unfollowed ${count} user(s)`,
          type: 'success',
          priority: 'low',
          category: 'execution',
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${scheduledUnfollows.length} unfollows`,
        processed: scheduledUnfollows.length,
        succeeded: successCount,
        failed: failedCount,
        skipped: skippedCount,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in auto-unfollow-scheduler:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

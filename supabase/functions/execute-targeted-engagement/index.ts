// Execute Targeted Engagement
// Executes specific engagement actions on a targeted tweet

import { createClient } from 'npm:@supabase/supabase-js@2';
import { validateEnv, getRequiredEnv, fetchWithTimeout } from '../_shared/fetch-with-timeout.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const corsHeaders = getCorsHeaders();

// Helper function to call Twitter API via proxy
async function callTwitterApiProxy(
  supabaseUrl: string,
  serviceKey: string,
  accountTokenId: string,
  endpoint: string,
  method: string,
  body?: any
): Promise<any> {
  const response = await fetchWithTimeout(
    `${supabaseUrl}/functions/v1/twitter-api-proxy`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint,
        method,
        body,
        account_token_id: accountTokenId,
      }),
      timeout: 30000,
      maxRetries: 2,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || 'Twitter API call failed');
  }

  return await response.json();
}

interface TargetedEngagement {
  id: string;
  user_id: string;
  target_url: string;
  target_tweet_id: string;
  enable_like: boolean;
  enable_retweet: boolean;
  enable_reply: boolean;
  enable_follow: boolean;
  account_type: 'follow' | 'spam';
  use_all_accounts: boolean;
  selected_account_ids: string[] | null;
  max_actions_per_hour: number;
  max_total_actions: number;
  actions_completed: number;
  reply_template: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const traceId = crypto.randomUUID();
    console.log(`[${traceId}] Starting targeted engagement execution`);

    validateEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const serviceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const sb = createClient(supabaseUrl, serviceKey);

    // Get pending targeted engagements
    const { data: engagements, error: engagementsError } = await sb
      .from('targeted_engagements')
      .select('*')
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: true })
      .limit(10);

    if (engagementsError) {
      throw new Error(`Failed to fetch targeted engagements: ${engagementsError.message}`);
    }

    if (!engagements || engagements.length === 0) {
      console.log(`[${traceId}] No targeted engagements ready to execute`);
      return new Response(
        JSON.stringify({
          ok: true,
          count: 0,
          message: 'No targeted engagements ready to execute',
          trace_id: traceId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${traceId}] Found ${engagements.length} targeted engagements to execute`);
    const results = [];

    for (const engagement of engagements as TargetedEngagement[]) {
      console.log(`[${traceId}] Executing targeted engagement: ${engagement.id}`);

      // Update status to running
      await sb
        .from('targeted_engagements')
        .update({ status: 'running', started_at: new Date().toISOString() })
        .eq('id', engagement.id);

      const executionResult = await executeTargetedEngagement(sb, engagement, traceId, supabaseUrl, serviceKey);
      results.push(executionResult);

      // Update engagement status
      const isCompleted = engagement.actions_completed >= engagement.max_total_actions;
      await sb
        .from('targeted_engagements')
        .update({
          status: isCompleted ? 'completed' : executionResult.status === 'failed' ? 'failed' : 'running',
          actions_completed: engagement.actions_completed + executionResult.actions_succeeded,
          last_action_at: new Date().toISOString(),
          error_message: executionResult.error,
          completed_at: isCompleted ? new Date().toISOString() : null,
        })
        .eq('id', engagement.id);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        count: results.length,
        results,
        trace_id: traceId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Targeted engagement execution error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || 'Targeted engagement execution failed',
        trace_id: crypto.randomUUID(),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function executeTargetedEngagement(sb: any, engagement: TargetedEngagement, traceId: string, supabaseUrl: string, serviceKey: string) {
  const result = {
    engagement_id: engagement.id,
    ok: true,
    status: 'success' as 'success' | 'failed',
    actions_attempted: 0,
    actions_succeeded: 0,
    actions_failed: 0,
    used_account_ids: [] as string[],
    error: null as string | null,
  };

  try {
    // Get executor accounts
    const accounts = await getExecutorAccounts(sb, engagement);
    if (accounts.length === 0) {
      result.status = 'failed';
      result.error = 'No executor accounts available';
      return result;
    }

    console.log(`[${traceId}] Found ${accounts.length} executor accounts`);

    // Calculate how many actions to perform (respect max_total_actions limit)
    const remainingActions = engagement.max_total_actions - engagement.actions_completed;
    const accountsToUse = accounts.slice(0, Math.min(remainingActions, accounts.length, engagement.max_actions_per_hour));

    // Execute actions with each account
    for (const account of accountsToUse) {
      result.used_account_ids.push(account.id);

      // Execute enabled actions
      if (engagement.enable_like) {
        const likeResult = await executeLike(sb, account, engagement.target_tweet_id, traceId, supabaseUrl, serviceKey);
        result.actions_attempted++;
        if (likeResult.success) {
          result.actions_succeeded++;
        } else {
          result.actions_failed++;
        }
      }

      if (engagement.enable_retweet) {
        const retweetResult = await executeRetweet(sb, account, engagement.target_tweet_id, traceId, supabaseUrl, serviceKey);
        result.actions_attempted++;
        if (retweetResult.success) {
          result.actions_succeeded++;
        } else {
          result.actions_failed++;
        }
      }

      if (engagement.enable_reply && engagement.reply_template) {
        const replyResult = await executeReply(sb, account, engagement.target_tweet_id, engagement.reply_template, traceId, supabaseUrl, serviceKey);
        result.actions_attempted++;
        if (replyResult.success) {
          result.actions_succeeded++;
        } else {
          result.actions_failed++;
        }
      }

      if (engagement.enable_follow) {
        // Need to get the author of the tweet first
        const authorResult = await getTweetAuthor(sb, account, engagement.target_tweet_id, traceId, supabaseUrl, serviceKey);
        if (authorResult.success && authorResult.author_id) {
          const followResult = await executeFollow(sb, account, authorResult.author_id, traceId, supabaseUrl, serviceKey);
          result.actions_attempted++;
          if (followResult.success) {
            result.actions_succeeded++;
          } else {
            result.actions_failed++;
          }
        }
      }

      // Delay between accounts to avoid rate limits
      if (accountsToUse.indexOf(account) < accountsToUse.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    if (result.actions_failed > 0 && result.actions_succeeded === 0) {
      result.status = 'failed';
    }

    return result;
  } catch (error: any) {
    console.error(`[${traceId}] Targeted engagement execution error:`, error);
    result.status = 'failed';
    result.error = error.message;
    return result;
  }
}

async function getExecutorAccounts(sb: any, engagement: TargetedEngagement) {
  const accountTable = engagement.account_type === 'follow' ? 'follow_accounts' : 'spam_accounts';
  const handleColumn = engagement.account_type === 'follow' ? 'target_handle' : 'handle';

  // Build query
  let query = sb
    .from(accountTable)
    .select(`id, ${handleColumn} as handle`)
    .eq('is_active', true);

  // Filter by selected accounts if specified
  if (!engagement.use_all_accounts && engagement.selected_account_ids && engagement.selected_account_ids.length > 0) {
    query = query.in('id', engagement.selected_account_ids);
  }

  const { data: accounts, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch executor accounts: ${error.message}`);
  }

  // Get tokens for these accounts
  const accountsWithTokens = [];
  for (const account of accounts || []) {
    const { data: token } = await sb
      .from('account_tokens')
      .select('id, access_token, x_user_id, expires_at')
      .eq('account_id', account.id)
      .eq('is_active', true)
      .eq('token_type', 'oauth2')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (token && token.access_token) {
      accountsWithTokens.push({
        ...account,
        account_token_id: token.id,
        access_token: token.access_token,
        x_user_id: token.x_user_id,
      });
    }
  }

  return accountsWithTokens;
}

async function executeLike(sb: any, account: any, tweetId: string, traceId: string, supabaseUrl: string, serviceKey: string) {
  try {
    await callTwitterApiProxy(
      supabaseUrl,
      serviceKey,
      account.account_token_id,
      `/users/${account.x_user_id}/likes`,
      'POST',
      { tweet_id: tweetId }
    );

    console.log(`[${traceId}] Like succeeded for ${account.handle}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[${traceId}] Like error for ${account.handle}:`, error);
    return { success: false, error: error.message };
  }
}

async function executeRetweet(sb: any, account: any, tweetId: string, traceId: string, supabaseUrl: string, serviceKey: string) {
  try {
    await callTwitterApiProxy(
      supabaseUrl,
      serviceKey,
      account.account_token_id,
      `/users/${account.x_user_id}/retweets`,
      'POST',
      { tweet_id: tweetId }
    );

    console.log(`[${traceId}] Retweet succeeded for ${account.handle}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[${traceId}] Retweet error for ${account.handle}:`, error);
    return { success: false, error: error.message };
  }
}

async function executeReply(sb: any, account: any, tweetId: string, replyText: string, traceId: string, supabaseUrl: string, serviceKey: string) {
  try {
    await callTwitterApiProxy(
      supabaseUrl,
      serviceKey,
      account.account_token_id,
      '/tweets',
      'POST',
      {
        text: replyText,
        reply: { in_reply_to_tweet_id: tweetId },
      }
    );

    console.log(`[${traceId}] Reply succeeded for ${account.handle}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[${traceId}] Reply error for ${account.handle}:`, error);
    return { success: false, error: error.message };
  }
}

async function executeFollow(sb: any, account: any, targetUserId: string, traceId: string, supabaseUrl: string, serviceKey: string) {
  try {
    await callTwitterApiProxy(
      supabaseUrl,
      serviceKey,
      account.account_token_id,
      `/users/${account.x_user_id}/following`,
      'POST',
      { target_user_id: targetUserId }
    );

    console.log(`[${traceId}] Follow succeeded for ${account.handle}`);
    return { success: true };
  } catch (error: any) {
    console.error(`[${traceId}] Follow error for ${account.handle}:`, error);
    return { success: false, error: error.message };
  }
}

async function getTweetAuthor(sb: any, account: any, tweetId: string, traceId: string, supabaseUrl: string, serviceKey: string) {
  try {
    const data = await callTwitterApiProxy(
      supabaseUrl,
      serviceKey,
      account.account_token_id,
      `/tweets/${tweetId}?expansions=author_id`,
      'GET'
    );

    const authorId = data.data?.author_id || data.includes?.users?.[0]?.id;

    return { success: true, author_id: authorId };
  } catch (error: any) {
    console.error(`[${traceId}] Get tweet author error:`, error);
    return { success: false, author_id: null };
  }
}

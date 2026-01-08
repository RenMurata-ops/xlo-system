// Stage6: Loop Execution (Post and Reply loops)
// 投稿ループとリプライループの実行処理

import { createClient } from 'npm:@supabase/supabase-js@2';
import { validateEnv, getRequiredEnv, fetchWithTimeout } from '../_shared/fetch-with-timeout.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const corsHeaders = getCorsHeaders();

interface Loop {
  id: string;
  user_id: string;
  loop_name: string;
  loop_type: 'post' | 'reply';
  template_ids: string[];
  selection_mode: 'random' | 'sequential';
  last_used_template_index: number;
  min_accounts: number;
  max_accounts: number;
  executor_account_ids: string[] | null;
  allowed_account_tags: string[] | null;
  target_type: string | null;
  target_value: string | null;
  execution_count: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = crypto.randomUUID();
  console.log(`[${traceId}] Loop execution started`);

  try {
    // Validate required environment variables
    validateEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);

    const sb = createClient(
      getRequiredEnv('SUPABASE_URL'),
      getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    );

    // Get pending loops (post and reply types only)
    const { data: loops, error } = await sb.rpc('get_pending_loops', {
      p_user_id: null,
      p_loop_type: null,
      p_limit: 20
    });

    if (error) {
      console.error(`[${traceId}] Error fetching loops:`, error);
      throw error;
    }

    if (!loops || loops.length === 0) {
      console.log(`[${traceId}] No pending loops found`);
      return new Response(
        JSON.stringify({ ok: true, count: 0, trace_id: traceId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${traceId}] Found ${loops.length} pending loops`);

    const results = [];
    for (const loop of loops) {
      // Try to acquire lock for this loop
      const { data: lockAcquired, error: lockError } = await sb.rpc('acquire_loop_lock', {
        p_loop_id: loop.id,
        p_lock_duration_minutes: 10
      });

      if (lockError) {
        console.error(`[${traceId}] Error acquiring lock for loop ${loop.id}:`, lockError);
        results.push({
          loop_id: loop.id,
          error: 'Failed to acquire lock',
          posts_created: 0
        });
        continue;
      }

      if (!lockAcquired) {
        console.log(`[${traceId}] Loop ${loop.id} is already running, skipping`);
        results.push({
          loop_id: loop.id,
          skipped: true,
          reason: 'Already running',
          posts_created: 0
        });
        continue;
      }

      try {
        console.log(`[${traceId}] Executing loop ${loop.id} (${loop.loop_type})`);

        const result = loop.loop_type === 'post'
          ? await executePostLoop(sb, loop, traceId)
          : await executeReplyLoop(sb, loop, traceId);

        results.push(result);

        // Update loop stats
        await sb.rpc('update_loop_execution_stats', {
          p_loop_id: loop.id,
          p_post_count: result.posts_created || 0,
          p_next_template_index: result.next_template_index || 0
        });
      } catch (error: any) {
        console.error(`[${traceId}] Error executing loop ${loop.id}:`, error);
        results.push({
          loop_id: loop.id,
          error: error.message,
          posts_created: 0
        });
      } finally {
        // Always release lock
        await sb.rpc('release_loop_lock', { p_loop_id: loop.id });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        count: results.length,
        results,
        trace_id: traceId
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error(`[${traceId}] Loop execution error:`, error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message,
        trace_id: traceId
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function executePostLoop(sb: any, loop: Loop, traceId: string) {
  const result = {
    loop_id: loop.id,
    ok: true,
    posts_created: 0,
    next_template_index: loop.last_used_template_index,
    errors: [] as string[]
  };

  try {
    // Select accounts
    const accounts = await selectAccounts(sb, loop);
    if (accounts.length === 0) {
      throw new Error('No available accounts for posting');
    }

    // Determine how many accounts to use
    const numAccounts = Math.min(
      Math.floor(Math.random() * (loop.max_accounts - loop.min_accounts + 1)) + loop.min_accounts,
      accounts.length
    );

    console.log(`[${traceId}] Post loop ${loop.id}: using ${numAccounts} accounts`);

    let currentTemplateIndex = loop.last_used_template_index || 0;

    for (let i = 0; i < numAccounts; i++) {
      const account = accounts[i];

      // Select template with current index
      const { template, nextIndex } = selectTemplate(loop, currentTemplateIndex);
      currentTemplateIndex = nextIndex;
      result.next_template_index = nextIndex;

      if (!template) {
        console.warn(`[${traceId}] No template selected for loop ${loop.id}`);
        continue;
      }

      // Fetch template
      const { data: tmpl, error: tmplError } = await sb
        .from('templates')
        .select('content')
        .eq('id', template.id)
        .eq('is_active', true)
        .single();

      if (tmplError || !tmpl) {
        console.error(`[${traceId}] Template fetch error:`, tmplError);
        result.errors.push(`Template ${template.id} not found or inactive`);
        continue;
      }

      const content = tmpl.content;

      if (!content) {
        console.warn(`[${traceId}] No content in template ${template.id}`);
        result.errors.push(`Template ${template.id} has no content`);
        continue;
      }

      // Post tweet
      const postResult = await callTwitterApi(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        {
          endpoint: '/2/tweets',
          method: 'POST',
          body: { text: content },
          account_id: account.id,
          user_id: loop.user_id
        }
      );

      if (postResult.success) {
        // Save post record
        await sb.from('posts').insert({
          user_id: loop.user_id,
          account_id: account.id,
          content,
          tweet_id: postResult.data?.data?.id,
          posted_at: new Date().toISOString(),
          status: 'posted',
          tags: ['loop', 'post_loop', loop.loop_name]
        });

        result.posts_created++;
        console.log(`[${traceId}] Posted tweet for account ${account.handle}`);
      } else {
        result.errors.push(`Account ${account.handle}: ${postResult.error}`);
      }

      // Wait between posts
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

  } catch (error: any) {
    console.error(`[${traceId}] Post loop error:`, error);
    result.ok = false;
    result.errors.push(error.message);
  }

  return result;
}

async function executeReplyLoop(sb: any, loop: Loop, traceId: string) {
  const result = {
    loop_id: loop.id,
    ok: true,
    posts_created: 0,
    next_template_index: loop.last_used_template_index,
    errors: [] as string[]
  };

  try {
    // Select accounts
    const accounts = await selectAccounts(sb, loop);
    if (accounts.length === 0) {
      throw new Error('No available accounts for replies');
    }

    // Find target tweets
    const tweets = await findTargetTweets(sb, loop, traceId);
    if (tweets.length === 0) {
      console.log(`[${traceId}] No target tweets found for reply loop ${loop.id}`);
      return result;
    }

    console.log(`[${traceId}] Reply loop ${loop.id}: found ${tweets.length} target tweets`);

    // Execute specified number of replies
    const count = Math.min(loop.execution_count || 5, tweets.length);

    let currentTemplateIndex = loop.last_used_template_index || 0;

    for (let i = 0; i < count; i++) {
      // Random account selection for replies
      const account = accounts[Math.floor(Math.random() * accounts.length)];

      // Select template with current index
      const { template, nextIndex } = selectTemplate(loop, currentTemplateIndex);
      currentTemplateIndex = nextIndex;
      result.next_template_index = nextIndex;

      if (!template) {
        console.warn(`[${traceId}] No template selected for reply loop ${loop.id}`);
        continue;
      }

      // Fetch template
      const { data: tmpl, error: tmplError } = await sb
        .from('templates')
        .select('content')
        .eq('id', template.id)
        .eq('is_active', true)
        .single();

      if (tmplError || !tmpl) {
        console.error(`[${traceId}] Template fetch error:`, tmplError);
        result.errors.push(`Template ${template.id} not found or inactive`);
        continue;
      }

      const content = tmpl.content;

      if (!content) {
        console.warn(`[${traceId}] No content in template ${template.id}`);
        result.errors.push(`Template ${template.id} has no content`);
        continue;
      }

      // Post reply
      const replyResult = await callTwitterApi(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        {
          endpoint: '/2/tweets',
          method: 'POST',
          body: {
            text: content,
            reply: { in_reply_to_tweet_id: tweets[i].id }
          },
          account_id: account.id,
          user_id: loop.user_id
        }
      );

      if (replyResult.success) {
        // Save post record
        await sb.from('posts').insert({
          user_id: loop.user_id,
          account_id: account.id,
          content,
          tweet_id: replyResult.data?.data?.id,
          in_reply_to_tweet_id: tweets[i].id,
          posted_at: new Date().toISOString(),
          status: 'posted',
          tags: ['loop', 'reply_loop', loop.loop_name]
        });

        result.posts_created++;
        console.log(`[${traceId}] Posted reply for account ${account.handle}`);
      } else {
        result.errors.push(`Account ${account.handle}: ${replyResult.error}`);
      }

      // Wait between replies
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

  } catch (error: any) {
    console.error(`[${traceId}] Reply loop error:`, error);
    result.ok = false;
    result.errors.push(error.message);
  }

  return result;
}

async function selectAccounts(sb: any, loop: Loop) {
  let query = sb
    .from('main_accounts')
    .select('id, handle')
    .eq('is_active', true);

  if (loop.executor_account_ids?.length) {
    query = query.in('id', loop.executor_account_ids);
  }

  if (loop.allowed_account_tags?.length) {
    query = query.overlaps('tags', loop.allowed_account_tags);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to select accounts: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error('No active accounts found matching loop criteria');
  }

  // Verify each account has a valid token
  const accountsWithTokens = [];
  for (const account of data) {
    const { data: token } = await sb
      .from('account_tokens')
      .select('id, access_token')
      .eq('account_id', account.id)
      .eq('is_active', true)
      .eq('token_type', 'oauth2')
      .gt('expires_at', new Date().toISOString())
      .single();

    if (token) {
      accountsWithTokens.push(account);
    }
  }

  if (accountsWithTokens.length === 0) {
    throw new Error('No accounts with valid tokens found');
  }

  // Shuffle accounts randomly
  return accountsWithTokens.sort(() => Math.random() - 0.5);
}

function selectTemplate(loop: Loop, currentIndex: number = 0) {
  if (!loop.template_ids?.length) {
    return { template: null, nextIndex: 0 };
  }

  if (loop.selection_mode === 'sequential') {
    const idx = currentIndex % loop.template_ids.length;
    return {
      template: { id: loop.template_ids[idx] },
      nextIndex: (idx + 1) % loop.template_ids.length
    };
  }

  // Random selection - index doesn't change for random mode
  return {
    template: { id: loop.template_ids[Math.floor(Math.random() * loop.template_ids.length)] },
    nextIndex: currentIndex
  };
}

// Note: Weighted item selection removed - templates table doesn't support post_template_items
// If weighted selection is needed, implement it within the templates.content field using JSON structure

async function findTargetTweets(sb: any, loop: Loop, traceId: string) {
  try {
    if (loop.target_type === 'tweet_url') {
      // Extract tweet ID from URL
      const tweetId = loop.target_value?.match(/status\/(\d+)/)?.[1];
      if (tweetId) {
        return [{ id: tweetId }];
      }
      console.error(`[${traceId}] Invalid tweet URL format: ${loop.target_value}. Expected format: https://twitter.com/username/status/123456789`);
      return [];
    }

    let endpoint = '';
    let params: Record<string, any> = {};

    if (loop.target_type === 'search') {
      endpoint = '/2/tweets/search/recent';
      params = {
        query: loop.target_value,
        max_results: 100
      };
    } else if (loop.target_type === 'account_url') {
      // Extract username from account URL
      const username = loop.target_value?.match(/(?:twitter|x)\.com\/([^\/\?]+)/)?.[1];
      if (!username) {
        console.error(`[${traceId}] Could not extract username from ${loop.target_value}`);
        return [];
      }

      endpoint = `/2/users/by/username/${username}/tweets`;
      params = { max_results: 100 };
    }

    if (!endpoint) return [];

    // Call Twitter API via proxy
    const queryString = new URLSearchParams(params).toString();
    const { data: resp, error } = await sb.functions.invoke('twitter-api-proxy', {
      body: {
        endpoint: `${endpoint}?${queryString}`,
        method: 'GET',
        user_id: loop.user_id
      }
    });

    if (error) {
      console.error(`[${traceId}] Twitter API error:`, error);
      return [];
    }

    return (resp?.data?.data || []).map((tweet: any) => ({ id: tweet.id }));

  } catch (error: any) {
    console.error(`[${traceId}] Error finding target tweets:`, error);
    return [];
  }
}

async function callTwitterApi(url: string, key: string, opts: any) {
  try {
    const resp = await fetchWithTimeout(`${url}/functions/v1/twitter-api-proxy`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`
      },
      body: JSON.stringify(opts),
      timeout: 45000, // 45 seconds for API proxy calls
      maxRetries: 2
    });

    return await resp.json();
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

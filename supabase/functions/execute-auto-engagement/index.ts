// Stage6: Auto Engagement Execution
// Executes automatic engagement rules (like, reply, follow, etc.)
// Updated: 2025-12-23 - Includes URL and user search type support with auto-refresh

import { createClient } from 'npm:@supabase/supabase-js@2';
import { validateEnv, getRequiredEnv, fetchWithTimeout } from '../_shared/fetch-with-timeout.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const corsHeaders = getCorsHeaders();

// Timeouts / limits to avoid long-running requests
const RPC_TIMEOUT_MS = 8000;
const MAX_RULES_PER_INVOCATION = 5; // Process multiple rules for better throughput
const FETCH_TIMEOUT_MS = 8000;
const MAX_ACTION_RETRIES = 10;
const RATE_LIMIT_BACKOFF_MS = 2000;

interface EngagementRule {
  id: string;
  user_id: string;
  name: string;
  search_type: 'keyword' | 'url' | 'user' | 'hashtag';
  search_query: string;
  action_type: 'like' | 'reply' | 'retweet' | 'follow';
  reply_template_id: string | null;
  min_followers: number;
  max_followers: number | null;
  min_account_age_days: number;
  exclude_keywords: string[];
  exclude_verified: boolean;
  require_verified: boolean;
  executor_account_ids: string[] | null;
  allowed_account_tags: string[] | null;
  max_actions_per_execution: number;
  daily_limit: number;
  actions_today: number;
  // Advanced search filters
  search_since: string | null;
  search_until: string | null;
  min_retweets: number | null;
  max_retweets: number | null;
  min_faves: number | null;
  max_faves: number | null;
  min_replies: number | null;
  max_replies: number | null;
  has_engagement: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const traceId = crypto.randomUUID();
    console.log(`[${traceId}] Starting auto engagement execution`);

    validateEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
    const sb = createClient(
      getRequiredEnv('SUPABASE_URL'),
      getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    );

    // Get pending rules (limit + timeout to prevent long-running requests)
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
    const { data: rules, error: rulesError } = await sb.rpc(
      'get_pending_engagement_rules',
      { p_user_id: null, p_limit: MAX_RULES_PER_INVOCATION },
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (rulesError) {
      console.error(`[${traceId}] Error fetching rules:`, rulesError);
      throw new Error(`Failed to fetch engagement rules: ${rulesError.message}`);
    }

    if (!rules || rules.length === 0) {
      console.log(`[${traceId}] No engagement rules ready to execute`);
      return new Response(
        JSON.stringify({
          ok: true,
          count: 0,
          message: 'No engagement rules ready to execute',
          trace_id: traceId,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${traceId}] Found ${rules.length} rules to execute`);
    const results = [];
    const deadline = Date.now() + RPC_TIMEOUT_MS; // overall guard

    for (const rule of rules as EngagementRule[]) {
      if (Date.now() > deadline) {
        console.warn(`[${traceId}] Time budget exceeded, skipping remaining rules`);
        break;
      }
      console.log(`[${traceId}] Executing rule: ${rule.name} (${rule.id})`);

      const executionResult = await executeEngagementRule(sb, rule, traceId);
      results.push(executionResult);

      // Update rule stats
      await sb.rpc('update_engagement_rule_stats', {
        p_rule_id: rule.id,
        p_actions_count: executionResult.actions_attempted,
        p_success_count: executionResult.actions_succeeded,
        p_failure_count: executionResult.actions_failed,
      });

      // Log execution (match current schema: status, trace_id, counts, arrays)
      const { error: insertError } = await sb.from('auto_engagement_executions').insert({
        rule_id: rule.id,
        user_id: rule.user_id,
        status: executionResult.status,
        trace_id: traceId,
        searched_count: executionResult.searched_count,
        filtered_count: executionResult.filtered_count,
        actions_attempted: executionResult.actions_attempted,
        actions_succeeded: executionResult.actions_succeeded,
        actions_failed: executionResult.actions_failed,
        used_account_ids: executionResult.used_account_ids,
        target_tweet_ids: executionResult.target_tweet_ids,
        target_user_ids: executionResult.target_user_ids,
        exec_data: executionResult.exec_data,
        error_message: executionResult.error,
      });

      if (insertError) {
        console.error(`[${traceId}] Failed to insert execution record:`, insertError);
      }
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
    console.error('Auto engagement execution error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || 'Auto engagement execution failed',
        trace_id: crypto.randomUUID(),
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function executeEngagementRule(sb: any, rule: EngagementRule, traceId: string) {
  const result = {
    rule_id: rule.id,
    rule_name: rule.name,
    ok: true,
    status: 'success' as 'success' | 'partial' | 'failed',
    searched_count: 0,
    filtered_count: 0,
    actions_attempted: 0,
    actions_succeeded: 0,
    actions_failed: 0,
    used_account_ids: [] as string[],
    target_tweet_ids: [] as string[],
    target_user_ids: [] as string[],
    exec_data: {} as any,
    error: null as string | null,
  };

  try {
    // Step 1: Search for targets using Twitter API
    const searchResults = await searchTwitter(sb, rule, traceId);
    result.searched_count = searchResults.length;
    result.exec_data.search_results = searchResults.slice(0, 5); // Sample

    console.log(`[${traceId}] Found ${searchResults.length} search results for rule ${rule.name}`);

    // Step 2: Filter results based on rule criteria
    const filtered = await filterResults(searchResults, rule);
    result.filtered_count = filtered.length;

    console.log(`[${traceId}] ${filtered.length} results passed filters`);

    if (filtered.length === 0) {
      result.status = 'success';
      return result;
    }

    // Step 3: Select executor accounts
    const executorAccounts = await selectExecutorAccounts(sb, rule);
    if (executorAccounts.length === 0) {
      result.status = 'failed';
      result.error = 'No executor accounts available';
      return result;
    }

    result.used_account_ids = executorAccounts.map(acc => acc.id);

    // Step 4: Execute actions (limit to max_actions_per_execution)
    const targets = filtered.slice(0, rule.max_actions_per_execution);

    // Execute action for each target
    const actionType = rule.action_type;

    for (const target of targets) {
      // Prepare executor pool (shuffled) for distribution
      const executorPool = [...executorAccounts].sort(() => Math.random() - 0.5);

      // Execute the action for this target
      {
        let succeeded = false;
        let rateLimited = false;
        let attempts = 0;
        let poolIndex = 0;

        while (attempts < MAX_ACTION_RETRIES && executorPool.length > 0 && !succeeded) {
          attempts++;
          const executorAccount = executorPool[poolIndex % executorPool.length];
          try {
            const actionResult = await executeAction(sb, rule, target, executorAccount, traceId, actionType);

            if (actionResult.success) {
              succeeded = true;
              rateLimited = false;
              break;
            }

            if (actionResult.rateLimited) {
              rateLimited = true;
              console.warn(
                `[${traceId}] ${actionType} rate-limited (attempt ${attempts}/${MAX_ACTION_RETRIES})`,
                actionResult.data?.rateLimits
              );
              // このアカウントは当面使わない
              executorPool.splice(poolIndex, 1);
              if (executorPool.length === 0) {
                break;
              }
              // インデックス調整（削除後、配列が短くなるため）
              if (poolIndex >= executorPool.length && executorPool.length > 0) {
                poolIndex = 0;
              }
              await new Promise(res => setTimeout(res, RATE_LIMIT_BACKOFF_MS * Math.min(attempts, 5)));
              continue;
            }

            // non-rate-limit failure
            break;
          } catch (actionError: any) {
            console.error(`[${traceId}] Action ${actionType} failed:`, actionError);
            // 該当アカウントは外し、次のアカウントへ
            executorPool.splice(poolIndex, 1);
            if (executorPool.length === 0) break;
            // インデックス調整（削除後、配列が短くなるため）
            if (poolIndex >= executorPool.length && executorPool.length > 0) {
              poolIndex = 0;
            }
          }
          poolIndex++;
        }

        result.actions_attempted++;

        if (succeeded) {
          result.actions_succeeded++;
          if (target.id_str) {
            if (actionType === 'follow') {
              if (!result.target_user_ids.includes(target.id_str)) {
                result.target_user_ids.push(target.id_str);
              }
            } else {
              if (!result.target_tweet_ids.includes(target.id_str)) {
                result.target_tweet_ids.push(target.id_str);
              }
            }
          }
        } else {
          result.actions_failed++;
          if (rateLimited) {
            result.error = 'Rate limited after retries (all executor accounts exhausted)';
            result.status = result.status === 'success' ? 'partial' : result.status;
            console.warn(`[${traceId}] Rate limited after ${attempts} retries across accounts, skipping remaining actions`);
            return result;
          }
        }
      }

      // Delay between targets to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Determine overall status
    if (result.actions_failed === 0) {
      result.status = 'success';
    } else if (result.actions_succeeded > 0) {
      result.status = 'partial';
    } else {
      result.status = 'failed';
    }

  } catch (error: any) {
    console.error(`[${traceId}] Rule execution error:`, error);
    result.ok = false;
    result.status = 'failed';
    result.error = error.message;
  }

  return result;
}

async function searchTwitter(sb: any, rule: EngagementRule, traceId: string) {
  console.log(`[${traceId}] Searching Twitter for: ${rule.search_query}`);

  let endpoint = '';
  let params: any = {};

  // Build advanced search query modifiers
  const buildAdvancedQuery = (baseQuery: string): string => {
    let query = baseQuery;

    // Date range filters
    if (rule.search_since) {
      query += ` since:${rule.search_since}`;
    }
    if (rule.search_until) {
      query += ` until:${rule.search_until}`;
    }

    // Engagement filters
    if (rule.min_retweets && rule.min_retweets > 0) {
      query += ` min_retweets:${rule.min_retweets}`;
    }
    if (rule.min_faves && rule.min_faves > 0) {
      query += ` min_faves:${rule.min_faves}`;
    }
    if (rule.min_replies && rule.min_replies > 0) {
      query += ` min_replies:${rule.min_replies}`;
    }
    if (rule.has_engagement) {
      query += ` has:engagement`;
    }

    return query.trim();
  };

  // SECURITY: Use rule owner's token only - prevent multi-tenant leakage
  const { data: activeToken } = await sb
    .from('account_tokens')
    .select('user_id')
    .eq('user_id', rule.user_id)
    .eq('token_type', 'oauth2')
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (!activeToken) {
    throw new Error(`No active token found for user ${rule.user_id}. Cannot execute rule.`);
  }

  switch (rule.search_type) {
    case 'keyword':
      endpoint = '/2/tweets/search/recent';
      params = {
        query: buildAdvancedQuery(rule.search_query),
        max_results: 100,
        'tweet.fields': 'author_id,created_at,public_metrics',
        'user.fields': 'created_at,public_metrics,verified',
        expansions: 'author_id',
      };
      break;

    case 'hashtag':
      endpoint = '/2/tweets/search/recent';
      params = {
        query: buildAdvancedQuery(`#${rule.search_query}`),
        max_results: 100,
        'tweet.fields': 'author_id,created_at,public_metrics',
        'user.fields': 'created_at,public_metrics,verified',
        expansions: 'author_id',
      };
      break;

    case 'user':
      // First, get user ID from username
      const userLookupUrl = `${getRequiredEnv('SUPABASE_URL')}/functions/v1/twitter-api-proxy`;
      const userLookupResponse = await fetch(userLookupUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          endpoint: `/2/users/by/username/${rule.search_query}`,
          method: 'GET',
          user_id: rule.user_id, // SECURITY: Use rule owner's user_id only
        }),
      });

      const userLookupData = await userLookupResponse.json();
      if (!userLookupResponse.ok || !userLookupData?.success) {
        throw new Error(`Failed to lookup user ${rule.search_query}: ${userLookupData?.error || 'Unknown error'}`);
      }

      const userId = userLookupData.data?.data?.id;
      if (!userId) {
        throw new Error(`User ${rule.search_query} not found`);
      }

      // Then get their tweets
      endpoint = `/2/users/${userId}/tweets`;
      params = {
        max_results: 100,
        'tweet.fields': 'author_id,created_at,public_metrics',
        'user.fields': 'created_at,public_metrics,verified',
        expansions: 'author_id',
      };
      break;

    case 'url':
      // Extract tweet ID from URL (supports twitter.com, x.com, and mobile.twitter.com)
      // Examples: https://twitter.com/user/status/123, https://x.com/user/status/123
      const tweetIdMatch = rule.search_query.match(/(?:twitter\.com|x\.com)\/.*?\/status\/(\d+)/);
      if (!tweetIdMatch) {
        throw new Error(`Invalid Twitter URL: could not extract tweet ID from "${rule.search_query}". Expected format: https://twitter.com/user/status/123456 or https://x.com/user/status/123456`);
      }
      const tweetId = tweetIdMatch[1];
      endpoint = `/2/tweets/${tweetId}`;
      params = {
        'tweet.fields': 'author_id,created_at,public_metrics',
        'user.fields': 'created_at,public_metrics,verified',
        expansions: 'author_id',
      };
      break;

    default:
      throw new Error(`Unsupported search type: ${rule.search_type}`);
  }

  // Call twitter-api-proxy directly with service role key
  const queryString = new URLSearchParams(params).toString();
  const fullEndpoint = `${endpoint}?${queryString}`;

  const proxyUrl = `${getRequiredEnv('SUPABASE_URL')}/functions/v1/twitter-api-proxy`;
  const proxyFetchResponse = await fetch(proxyUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint: fullEndpoint,
      method: 'GET',
      user_id: rule.user_id, // SECURITY: Use rule owner's user_id only
    }),
  });

  const proxyResponse = await proxyFetchResponse.json();

  if (!proxyFetchResponse.ok || !proxyResponse?.success) {
    console.error('[DEBUG] Proxy response:', JSON.stringify(proxyResponse, null, 2));
    throw new Error(`Twitter search failed: ${proxyResponse?.error || JSON.stringify(proxyResponse)}`);
  }

  // Handle URL search (single tweet) vs other searches (array of tweets)
  let results = proxyResponse.data?.data || [];
  if (rule.search_type === 'url' && !Array.isArray(results)) {
    // URL search returns a single tweet object, wrap it in an array
    results = results ? [results] : [];
  }
  const users = proxyResponse.data?.includes?.users || [];

  // Attach user data to tweets
  return results.map((tweet: any) => ({
    ...tweet,
    author: users.find((u: any) => u.id === tweet.author_id),
  }));
}

async function filterResults(results: any[], rule: EngagementRule) {
  return results.filter(item => {
    const author = item.author;
    if (!author) return false;

    // Followers filter
    const followers = author.public_metrics?.followers_count || 0;
    if (followers < rule.min_followers) return false;
    if (rule.max_followers && followers > rule.max_followers) return false;

    // Verified filter
    if (rule.exclude_verified && author.verified) return false;
    if (rule.require_verified && !author.verified) return false;

    // Account age filter
    if (rule.min_account_age_days > 0) {
      const createdAt = new Date(author.created_at);
      const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
      if (ageInDays < rule.min_account_age_days) return false;
    }

    // Exclude keywords
    if (rule.exclude_keywords && rule.exclude_keywords.length > 0) {
      const text = (item.text || '').toLowerCase();
      for (const keyword of rule.exclude_keywords) {
        if (text.includes(keyword.toLowerCase())) return false;
      }
    }

    // Advanced engagement filters (max values - client-side filtering)
    const metrics = item.public_metrics;
    if (metrics) {
      if (rule.max_retweets && metrics.retweet_count > rule.max_retweets) return false;
      if (rule.max_faves && metrics.like_count > rule.max_faves) return false;
      if (rule.max_replies && metrics.reply_count > rule.max_replies) return false;
    }

    return true;
  });
}

async function selectExecutorAccounts(sb: any, rule: EngagementRule) {
  // CRITICAL: Filter by user_id to prevent multi-tenant leakage
  let query = sb.from('account_tokens')
    .select('id, user_id, account_id, x_user_id, x_username, access_token, expires_at')
    .eq('user_id', rule.user_id)  // SECURITY: Must filter by rule owner's user_id
    .eq('is_active', true)
    .eq('token_type', 'oauth2');

  if (rule.executor_account_ids && rule.executor_account_ids.length > 0) {
    query = query.in('id', rule.executor_account_ids);
  }

  // TODO: Implement allowed_account_tags filtering when tags column is added to account_tokens

  const { data: accounts, error } = await query;

  if (error) {
    console.error('Error fetching executor accounts:', error);
    return [];
  }

  // Filter out any accounts with invalid/deleted account_ids
  const validAccounts = (accounts || []).filter(acc => acc.account_id && acc.x_user_id);

  if (validAccounts.length < (accounts || []).length) {
    console.warn(`Filtered out ${(accounts || []).length - validAccounts.length} accounts with invalid IDs`);
  }

  return validAccounts;
}

async function executeAction(
  sb: any,
  rule: EngagementRule,
  target: any,
  executorAccount: any,
  traceId: string,
  actionType: 'like' | 'reply' | 'retweet' | 'follow'
) {
  console.log(`[${traceId}] Executing ${actionType} on tweet ${target.id} with account ${executorAccount.x_user_id}`);

  let endpoint = '';
  let method = 'POST';
  let body: any = {};

  switch (actionType) {
    case 'like':
      endpoint = `/2/users/${executorAccount.x_user_id}/likes`;
      body = { tweet_id: target.id };
      break;

    case 'retweet':
      endpoint = `/2/users/${executorAccount.x_user_id}/retweets`;
      body = { tweet_id: target.id };
      break;

    case 'follow':
      endpoint = `/2/users/${executorAccount.x_user_id}/following`;
      body = { target_user_id: target.author_id };
      break;

    case 'reply':
      // Get reply template
      if (!rule.reply_template_id) {
        throw new Error('Reply action requires reply_template_id');
      }

      const { data: template } = await sb
        .from('post_templates')
        .select('*, post_template_items(*)')
        .eq('id', rule.reply_template_id)
        .single();

      if (!template) {
        throw new Error('Reply template not found');
      }

      // Select random template item (weighted)
      const items = template.post_template_items || [];
      const replyText = selectWeightedItem(items)?.content || template.content;

      endpoint = '/2/tweets';
      body = {
        text: replyText,
        reply: { in_reply_to_tweet_id: target.id },
      };
      break;

    default:
      throw new Error(`Unsupported action type: ${actionType}`);
  }

  // Execute via twitter-api-proxy directly with service role key (with timeout)
  const proxyUrl = `${getRequiredEnv('SUPABASE_URL')}/functions/v1/twitter-api-proxy`;
  const proxyFetchResponse = await fetchWithTimeout(proxyUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      endpoint,
      method,
      body,
      x_user_id: executorAccount.x_user_id,
      // Don't pass user_id - use x_user_id to find the specific account's token
    }),
    timeout: FETCH_TIMEOUT_MS,
    maxRetries: 1,
  });

  const proxyResponse = await proxyFetchResponse.json();

  // Handle rate limit gracefully (avoid throwing to keep loop alive)
  const rateRemaining = proxyResponse?.rateLimits?.remaining;
  const rateStatus = proxyResponse?.data?.status;
  if (rateStatus === 429 || rateRemaining === '0') {
    console.warn(`[${traceId}] Action ${actionType} rate-limited`, proxyResponse?.rateLimits);
    return { success: false, rateLimited: true, data: proxyResponse };
  }

  if (!proxyFetchResponse.ok || !proxyResponse?.success) {
    const errorDetail = proxyResponse?.error || JSON.stringify(proxyResponse) || 'Unknown error';
    console.error(`[${traceId}] Action ${actionType} failed:`, errorDetail);
    throw new Error(`Action failed: ${errorDetail}`);
  }

  // Record in posts table if it's a reply action
  if (actionType === 'reply' && proxyResponse.data?.data?.id) {
    await sb.from('posts').insert({
      user_id: executorAccount.user_id,
      account_id: executorAccount.id,
      content: body.text,
      tweet_id: proxyResponse.data.data.id,
      posted_at: new Date().toISOString(),
      status: 'posted',
      tags: ['auto_engagement', actionType],
    });
  }

  return { success: true, rateLimited: false, data: proxyResponse.data };
}

function selectWeightedItem(items: any[]) {
  if (!items || items.length === 0) return null;

  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight || 1;
    if (random <= 0) return item;
  }

  return items[0];
}

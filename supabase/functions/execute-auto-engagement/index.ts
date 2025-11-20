// Stage6: Auto Engagement Execution
// Executes automatic engagement rules (like, reply, follow, etc.)

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EngagementRule {
  id: string;
  user_id: string;
  name: string;
  search_type: 'keyword' | 'url' | 'user' | 'hashtag';
  search_query: string;
  action_type: 'like' | 'reply' | 'retweet' | 'follow'; // Keep for backward compatibility
  action_types: ('like' | 'reply' | 'retweet' | 'follow')[] | null;
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

    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get pending rules
    const { data: rules, error: rulesError } = await sb.rpc('get_pending_engagement_rules', {
      p_user_id: null,
      p_limit: 20,
    });

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

    for (const rule of rules as EngagementRule[]) {
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

      // Log execution
      await sb.from('auto_engagement_executions').insert({
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

    // Get action types to execute (use new action_types or fall back to old action_type)
    const actionTypes = rule.action_types && rule.action_types.length > 0
      ? rule.action_types
      : [rule.action_type];

    for (const target of targets) {
      // Select random executor account
      const executorAccount = executorAccounts[Math.floor(Math.random() * executorAccounts.length)];

      // Execute all selected actions for this target
      for (const actionType of actionTypes) {
        try {
          const actionResult = await executeAction(sb, rule, target, executorAccount, traceId, actionType);

          if (actionResult.success) {
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
          }

          result.actions_attempted++;
        } catch (actionError: any) {
          console.error(`[${traceId}] Action ${actionType} failed:`, actionError);
          result.actions_failed++;
          result.actions_attempted++;
        }

        // Small delay between actions on same target
        await new Promise(resolve => setTimeout(resolve, 500));
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
      endpoint = `/2/users/by/username/${rule.search_query}/tweets`;
      params = {
        max_results: 100,
        'tweet.fields': 'created_at,public_metrics',
      };
      break;

    default:
      throw new Error(`Unsupported search type: ${rule.search_type}`);
  }

  // Call twitter-api-proxy
  const queryString = new URLSearchParams(params).toString();
  const fullEndpoint = `${endpoint}?${queryString}`;

  const { data: proxyResponse, error: proxyError } = await sb.functions.invoke('twitter-api-proxy', {
    body: {
      endpoint: fullEndpoint,
      method: 'GET',
      x_user_id: null, // Use first available token
      user_id: rule.user_id,
    },
  });

  if (proxyError || !proxyResponse?.success) {
    throw new Error(`Twitter search failed: ${proxyError?.message || 'Unknown error'}`);
  }

  const results = proxyResponse.data?.data || [];
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
  let query = sb.from('account_tokens').select('*').eq('is_active', true);

  if (rule.executor_account_ids && rule.executor_account_ids.length > 0) {
    query = query.in('id', rule.executor_account_ids);
  }

  if (rule.allowed_account_tags && rule.allowed_account_tags.length > 0) {
    query = query.overlaps('tags', rule.allowed_account_tags);
  }

  const { data: accounts, error } = await query;

  if (error) {
    console.error('Error fetching executor accounts:', error);
    return [];
  }

  return accounts || [];
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

  // Execute via twitter-api-proxy
  const { data: proxyResponse, error: proxyError } = await sb.functions.invoke('twitter-api-proxy', {
    body: {
      endpoint,
      method,
      body,
      x_user_id: executorAccount.x_user_id,
      user_id: rule.user_id,
    },
  });

  if (proxyError || !proxyResponse?.success) {
    throw new Error(`Action failed: ${proxyError?.message || 'Unknown error'}`);
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

  return { success: true, data: proxyResponse.data };
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

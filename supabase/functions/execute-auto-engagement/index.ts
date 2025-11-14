// execute-auto-engagement - Execute auto-engagement rules
// Purpose: Execute engagement rules (keyword/url/user based)
// Execution: Manual or scheduled

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface ExecutionRequest {
  rule_id?: string;           // Specific rule to execute
  user_id?: string;           // Execute all rules for user
}

interface ExecutionResult {
  rule_id: string;
  rule_name: string;
  actions_performed: number;
  successes: number;
  failures: number;
  error?: string;
}

async function executeRule(
  supabase: any,
  rule: any
): Promise<ExecutionResult> {
  const result: ExecutionResult = {
    rule_id: rule.id,
    rule_name: rule.rule_name,
    actions_performed: 0,
    successes: 0,
    failures: 0,
  };

  try {
    // Validate executor accounts
    if (!rule.executor_account_ids || rule.executor_account_ids.length === 0) {
      result.error = 'No executor accounts configured';
      return result;
    }

    // Validate tokens
    const validateResponse = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/validate-and-refresh-tokens`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_ids: rule.executor_account_ids,
          auto_refresh: true,
        }),
      }
    );

    const validateData = await validateResponse.json();
    const validAccountIds = validateData.valid_account_ids || [];

    if (validAccountIds.length === 0) {
      result.error = 'No valid executor accounts available';
      return result;
    }

    // Filter accounts by health and rate limits
    const healthyAccounts = [];
    for (const accountId of validAccountIds.slice(0, rule.max_accounts_per_run || 5)) {
      const { data: canMakeRequest } = await supabase.rpc('can_account_make_request', {
        p_account_id: accountId,
        p_account_type: 'main', // Assuming engagement is done with main accounts
        p_max_daily_requests: 4000, // Increased for 500-account operation (80% of 5000)
      });

      if (canMakeRequest) {
        healthyAccounts.push(accountId);
      }
    }

    if (healthyAccounts.length === 0) {
      result.error = 'No healthy accounts available (rate limit or health score too low)';
      return result;
    }

    // Get tokens for healthy accounts
    const { data: tokens } = await supabase
      .from('account_tokens')
      .select('*')
      .in('id', healthyAccounts);

    if (!tokens || tokens.length === 0) {
      result.error = 'Failed to fetch executor tokens';
      return result;
    }

    console.log(`Using ${tokens.length} healthy accounts for engagement`);

    // Execute based on rule type
    switch (rule.rule_type) {
      case 'keyword':
        await executeKeywordRule(supabase, rule, tokens, result);
        break;
      case 'url':
        await executeUrlRule(supabase, rule, tokens, result);
        break;
      case 'user':
        await executeUserRule(supabase, rule, tokens, result);
        break;
      default:
        result.error = `Unknown rule type: ${rule.rule_type}`;
    }

    // Update rule statistics
    await supabase
      .from('auto_engagement_rules')
      .update({
        last_execution_at: new Date().toISOString(),
        total_executions: (rule.total_executions || 0) + 1,
        success_count: (rule.success_count || 0) + result.successes,
        error_count: (rule.error_count || 0) + result.failures,
      })
      .eq('id', rule.id);

    return result;

  } catch (error) {
    result.error = error.message;
    return result;
  }
}

async function executeKeywordRule(
  supabase: any,
  rule: any,
  tokens: any[],
  result: ExecutionResult
) {
  // Search for tweets matching keywords
  for (const keyword of rule.search_keywords || []) {
    const token = tokens[0]; // Use first token for search

    const searchResponse = await fetch(
      `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(keyword)}&max_results=10`,
      {
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
        },
      }
    );

    if (!searchResponse.ok) {
      result.failures++;
      continue;
    }

    const searchData = await searchResponse.json();
    const tweets = searchData.data || [];

    // Filter by exclude keywords
    const filteredTweets = tweets.filter((tweet: any) => {
      if (!rule.exclude_keywords || rule.exclude_keywords.length === 0) {
        return true;
      }
      return !rule.exclude_keywords.some((kw: string) =>
        tweet.text.toLowerCase().includes(kw.toLowerCase())
      );
    });

    // Perform actions
    for (const tweet of filteredTweets) {
      for (const action of rule.action_types || ['like']) {
        for (const token of tokens) {
          const success = await performAction(
            supabase,
            token,
            tweet.id,
            tweet.author_id,
            action,
            rule
          );

          result.actions_performed++;
          if (success) {
            result.successes++;
          } else {
            result.failures++;
          }

          // Log execution
          await supabase.from('auto_engagement_executions').insert({
            user_id: rule.user_id,
            rule_id: rule.id,
            executor_account_id: token.id,
            action_type: action,
            target_tweet_id: tweet.id,
            target_user_id: tweet.author_id,
            status: success ? 'success' : 'failed',
          });

          // Respect rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  }
}

async function executeUrlRule(
  supabase: any,
  rule: any,
  tokens: any[],
  result: ExecutionResult
) {
  // Execute actions on specific tweet URLs
  for (const url of rule.target_urls || []) {
    // Extract tweet ID from URL
    const tweetIdMatch = url.match(/status\/(\d+)/);
    if (!tweetIdMatch) {
      result.failures++;
      continue;
    }

    const tweetId = tweetIdMatch[1];

    // Perform actions
    for (const action of rule.action_types || ['like']) {
      for (const token of tokens) {
        const success = await performAction(
          supabase,
          token,
          tweetId,
          null,
          action,
          rule
        );

        result.actions_performed++;
        if (success) {
          result.successes++;
        } else {
          result.failures++;
        }

        // Log execution
        await supabase.from('auto_engagement_executions').insert({
          user_id: rule.user_id,
          rule_id: rule.id,
          executor_account_id: token.id,
          action_type: action,
          target_tweet_id: tweetId,
          status: success ? 'success' : 'failed',
        });

        // Wait between actions
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
}

async function executeUserRule(
  supabase: any,
  rule: any,
  tokens: any[],
  result: ExecutionResult
) {
  // Execute actions on specific user's tweets
  for (const userId of rule.target_user_ids || []) {
    const token = tokens[0];

    // Get user's recent tweets
    const tweetsResponse = await fetch(
      `https://api.twitter.com/2/users/${userId}/tweets?max_results=10`,
      {
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
        },
      }
    );

    if (!tweetsResponse.ok) {
      result.failures++;
      continue;
    }

    const tweetsData = await tweetsResponse.json();
    const tweets = tweetsData.data || [];

    // Perform actions
    for (const tweet of tweets) {
      for (const action of rule.action_types || ['like']) {
        for (const execToken of tokens) {
          const success = await performAction(
            supabase,
            execToken,
            tweet.id,
            userId,
            action,
            rule
          );

          result.actions_performed++;
          if (success) {
            result.successes++;
          } else {
            result.failures++;
          }

          // Log execution
          await supabase.from('auto_engagement_executions').insert({
            user_id: rule.user_id,
            rule_id: rule.id,
            executor_account_id: execToken.id,
            action_type: action,
            target_tweet_id: tweet.id,
            target_user_id: userId,
            status: success ? 'success' : 'failed',
          });

          // Wait between actions
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }
  }
}

async function performAction(
  supabase: any,
  token: any,
  tweetId: string,
  userId: string | null,
  actionType: string,
  rule: any
): Promise<boolean> {
  try {
    switch (actionType) {
      case 'like': {
        const response = await fetch(
          `https://api.twitter.com/2/users/${token.x_user_id}/likes`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tweet_id: tweetId }),
          }
        );
        return response.ok;
      }

      case 'retweet': {
        const response = await fetch(
          `https://api.twitter.com/2/users/${token.x_user_id}/retweets`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ tweet_id: tweetId }),
          }
        );
        return response.ok;
      }

      case 'follow': {
        if (!userId) return false;

        const response = await fetch(
          `https://api.twitter.com/2/users/${token.x_user_id}/following`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ target_user_id: userId }),
          }
        );

        if (response.ok && rule.auto_unfollow_enabled) {
          // Record for auto-unfollow
          const scheduledUnfollowAt = new Date();
          scheduledUnfollowAt.setDate(
            scheduledUnfollowAt.getDate() + (rule.unfollow_after_days || 7)
          );

          await supabase.from('follow_history').insert({
            user_id: rule.user_id,
            account_id: token.id,
            target_user_id: userId,
            target_username: '', // Would need to fetch
            auto_unfollow_enabled: true,
            unfollow_after_days: rule.unfollow_after_days || 7,
            scheduled_unfollow_at: scheduledUnfollowAt.toISOString(),
            engagement_rule_id: rule.id,
          });
        }

        return response.ok;
      }

      case 'reply': {
        if (!rule.reply_template_id) return false;

        // Get reply template
        const { data: template } = await supabase
          .from('cta_templates')
          .select('content')
          .eq('id', rule.reply_template_id)
          .single();

        if (!template) return false;

        const response = await fetch(
          'https://api.twitter.com/2/tweets',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              text: template.content,
              reply: { in_reply_to_tweet_id: tweetId },
            }),
          }
        );
        return response.ok;
      }

      default:
        return false;
    }
  } catch (error) {
    console.error(`Action ${actionType} failed:`, error);
    return false;
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

    const body: ExecutionRequest = await req.json().catch(() => ({}));

    let rules: any[] = [];

    if (body.rule_id) {
      // Execute specific rule
      const { data } = await supabase
        .from('auto_engagement_rules')
        .select('*')
        .eq('id', body.rule_id)
        .eq('is_active', true)
        .single();

      if (data) rules = [data];
    } else if (body.user_id) {
      // Execute all active rules for user
      const { data } = await supabase
        .from('auto_engagement_rules')
        .select('*')
        .eq('user_id', body.user_id)
        .eq('is_active', true);

      rules = data || [];
    } else {
      // Execute all active rules (careful with this!)
      const { data } = await supabase
        .from('auto_engagement_rules')
        .select('*')
        .eq('is_active', true)
        .limit(10);

      rules = data || [];
    }

    if (rules.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No active rules to execute',
          results: [],
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Executing ${rules.length} rules...`);

    const results: ExecutionResult[] = [];

    for (const rule of rules) {
      const result = await executeRule(supabase, rule);
      results.push(result);

      // Wait between rules
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    const totalActions = results.reduce((sum, r) => sum + r.actions_performed, 0);
    const totalSuccesses = results.reduce((sum, r) => sum + r.successes, 0);
    const totalFailures = results.reduce((sum, r) => sum + r.failures, 0);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Executed ${rules.length} rules`,
        total_actions: totalActions,
        total_successes: totalSuccesses,
        total_failures: totalFailures,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in execute-auto-engagement:', error);
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

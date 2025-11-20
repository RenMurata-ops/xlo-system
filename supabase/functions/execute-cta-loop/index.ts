// Stage6: CTA Loop Execution
// CTAループの実行処理（イベント駆動型）
// 特定のアカウントの投稿を監視し、新しい投稿に自動的にリプライを送信

import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CTALoop {
  id: string;
  user_id: string;
  loop_name: string;
  template_ids: string[];
  monitor_account_handle: string;
  last_processed_tweet_id: string | null;
  executor_account_ids: string[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = crypto.randomUUID();
  console.log(`[${traceId}] CTA loop execution started`);

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all active CTA loops
    const { data: loops, error } = await sb.rpc('get_active_cta_loops', {
      p_account_handle: null
    });

    if (error) {
      console.error(`[${traceId}] Error fetching CTA loops:`, error);
      throw error;
    }

    if (!loops || loops.length === 0) {
      console.log(`[${traceId}] No active CTA loops found`);
      return new Response(
        JSON.stringify({ ok: true, count: 0, trace_id: traceId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[${traceId}] Found ${loops.length} active CTA loops`);

    const results = [];
    for (const loop of loops) {
      console.log(`[${traceId}] Processing CTA loop ${loop.id} monitoring @${loop.monitor_account_handle}`);

      const result = await executeCTALoop(sb, loop, traceId);
      results.push(result);
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
    console.error(`[${traceId}] CTA loop execution error:`, error);
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

async function executeCTALoop(sb: any, loop: CTALoop, traceId: string) {
  const result = {
    loop_id: loop.id,
    ok: true,
    replies_created: 0,
    errors: [] as string[]
  };

  try {
    // Get recent tweets from monitored account
    const tweets = await fetchRecentTweets(sb, loop, traceId);

    if (tweets.length === 0) {
      console.log(`[${traceId}] No new tweets from @${loop.monitor_account_handle}`);
      return result;
    }

    console.log(`[${traceId}] Found ${tweets.length} new tweets to process`);

    // Get executor account (CTA loops use single account)
    if (!loop.executor_account_ids?.length) {
      throw new Error('No executor account specified for CTA loop');
    }

    const { data: account, error: accountError } = await sb
      .from('main_accounts')
      .select('id, handle')
      .eq('id', loop.executor_account_ids[0])
      .eq('is_active', true)
      .single();

    if (accountError || !account) {
      throw new Error('Executor account not found or inactive');
    }

    // Process each new tweet
    for (const tweet of tweets) {
      try {
        // Select random template
        const templateId = loop.template_ids[Math.floor(Math.random() * loop.template_ids.length)];

        // Fetch template with items
        const { data: tmpl, error: tmplError } = await sb
          .from('post_templates')
          .select('*, post_template_items(*)')
          .eq('id', templateId)
          .single();

        if (tmplError || !tmpl) {
          console.error(`[${traceId}] Template fetch error:`, tmplError);
          continue;
        }

        // Select content from template
        const content = selectWeightedItem(tmpl.post_template_items)?.content || tmpl.content;

        if (!content) {
          console.warn(`[${traceId}] No content in template ${templateId}`);
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
              reply: { in_reply_to_tweet_id: tweet.id }
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
            in_reply_to_tweet_id: tweet.id,
            posted_at: new Date().toISOString(),
            status: 'posted',
            tags: ['loop', 'cta_loop', loop.loop_name]
          });

          result.replies_created++;
          console.log(`[${traceId}] Posted CTA reply to tweet ${tweet.id}`);
        } else {
          result.errors.push(`Tweet ${tweet.id}: ${replyResult.error}`);
        }

        // Update last processed tweet ID
        await sb.rpc('update_cta_loop_last_tweet', {
          p_loop_id: loop.id,
          p_tweet_id: tweet.id
        });

        // Wait between replies
        await new Promise(resolve => setTimeout(resolve, 3000));

      } catch (tweetError: any) {
        console.error(`[${traceId}] Error processing tweet ${tweet.id}:`, tweetError);
        result.errors.push(`Tweet ${tweet.id}: ${tweetError.message}`);
      }
    }

  } catch (error: any) {
    console.error(`[${traceId}] CTA loop error:`, error);
    result.ok = false;
    result.errors.push(error.message);
  }

  return result;
}

async function fetchRecentTweets(sb: any, loop: CTALoop, traceId: string) {
  try {
    // Get user ID from username
    const userResp = await callTwitterApi(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        endpoint: `/2/users/by/username/${loop.monitor_account_handle}`,
        method: 'GET',
        user_id: loop.user_id
      }
    );

    if (!userResp.success || !userResp.data?.data?.id) {
      console.error(`[${traceId}] Could not fetch user ID for @${loop.monitor_account_handle}`);
      return [];
    }

    const userId = userResp.data.data.id;

    // Fetch recent tweets
    const params: Record<string, string> = {
      max_results: '10',
      'tweet.fields': 'created_at'
    };

    // If we have a last processed tweet, only get newer tweets
    if (loop.last_processed_tweet_id) {
      params.since_id = loop.last_processed_tweet_id;
    }

    const queryString = new URLSearchParams(params).toString();
    const tweetsResp = await callTwitterApi(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      {
        endpoint: `/2/users/${userId}/tweets?${queryString}`,
        method: 'GET',
        user_id: loop.user_id
      }
    );

    if (!tweetsResp.success || !tweetsResp.data?.data) {
      console.log(`[${traceId}] No tweets found or API error`);
      return [];
    }

    // Return tweets in chronological order (oldest first)
    return (tweetsResp.data.data || []).reverse();

  } catch (error: any) {
    console.error(`[${traceId}] Error fetching tweets:`, error);
    return [];
  }
}

function selectWeightedItem(items: any[]) {
  if (!items?.length) return null;

  const totalWeight = items.reduce((sum, item) => sum + (item.weight || 1), 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight || 1;
    if (random <= 0) return item;
  }

  return items[0];
}

async function callTwitterApi(url: string, key: string, opts: any) {
  try {
    const resp = await fetch(`${url}/functions/v1/twitter-api-proxy`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${key}`
      },
      body: JSON.stringify(opts)
    });

    return await resp.json();
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

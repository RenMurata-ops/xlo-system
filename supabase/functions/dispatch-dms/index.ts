import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateEnv, getRequiredEnv, fetchWithTimeout } from '../_shared/fetch-with-timeout.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const corsHeaders = getCorsHeaders();

type QueueItem = {
  id: string;
  user_id: string;
  rule_id: string | null;
  account_token_id: string;
  account_type: 'main' | 'spam' | 'follow';
  target_user_id: string;
  target_username: string | null;
  template_id: string | null;
  scheduled_at: string;
  retry_count: number;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    validateEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseServiceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date().toISOString();
    const { data: queue, error: queueError } = await supabase
      .from('dm_send_queue')
      .select(
        `
          *,
          account_tokens ( access_token, x_user_id, x_username, expires_at ),
          dm_send_rules ( daily_limit ),
          templates ( content )
        `
      )
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .limit(50);

    if (queueError) throw queueError;

    if (!queue || queue.length === 0) {
      return new Response(JSON.stringify({ message: 'No pending DM jobs', processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const item of queue as any[]) {
      processed++;
      try {
        const token = item.account_tokens;
        if (!token?.access_token || !item.templates?.content) {
          throw new Error('Missing access token or template content');
        }

        // Check token expiry
        if (token.expires_at && new Date(token.expires_at) < new Date()) {
          throw new Error('Token expired - needs refresh');
        }

        // Check rate limits for DMs
        const { data: rateLimitData } = await supabase
          .from('rate_limits')
          .select('remaining, reset_at')
          .eq('user_id', item.user_id)
          .eq('account_token_id', item.account_token_id)
          .eq('endpoint', 'dm_conversations')
          .maybeSingle();

        if (rateLimitData) {
          if (rateLimitData.remaining <= 0) {
            const resetTime = new Date(rateLimitData.reset_at);
            if (resetTime > new Date()) {
              await markQueueStatus(supabase, item.id, 'skipped', 'Rate limit exceeded');
              continue;
            }
          }
        }

        // Daily limit check per rule (if set)
        if (item.dm_send_rules?.daily_limit) {
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);
          const { count, error: countError } = await supabase
            .from('dm_send_logs')
            .select('id', { count: 'exact', head: true })
            .eq('rule_id', item.rule_id)
            .gte('sent_at', today.toISOString());

          if (countError) throw countError;
          if (count !== null && count >= item.dm_send_rules.daily_limit) {
            await markQueueStatus(supabase, item.id, 'skipped', 'Daily limit reached');
            continue;
          }
        }

        const text = item.templates.content;

        // Use twitter-api-proxy for DM sending
        const proxyResponse = await fetchWithTimeout(
          `${supabaseUrl}/functions/v1/twitter-api-proxy`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              endpoint: `/dm_conversations/with/${item.target_user_id}/messages`,
              method: 'POST',
              body: { text },
              account_token_id: item.account_token_id,
            }),
            timeout: 30000,
            maxRetries: 1,
          }
        );

        if (!proxyResponse.ok) {
          const errText = await proxyResponse.text();
          throw new Error(errText || 'DM send failed');
        }

        const response = await proxyResponse.json();

        await supabase.from('dm_send_logs').insert({
          user_id: item.user_id,
          rule_id: item.rule_id,
          account_token_id: item.account_token_id,
          account_type: item.account_type,
          target_user_id: item.target_user_id,
          target_username: item.target_username,
          template_id: item.template_id,
          status: 'success',
          response_data: response,
          sent_at: new Date().toISOString(),
        });

        await supabase
          .from('dm_send_queue')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', item.id);

        sent++;
        await delay(500); // small pause to avoid bursts
      } catch (error: any) {
        failed++;
        const retryCount = (item.retry_count || 0) + 1;
        const shouldRetry = retryCount <= 3;

        await supabase
          .from('dm_send_queue')
          .update({
            status: shouldRetry ? 'pending' : 'failed',
            error_message: error.message,
            retry_count: retryCount,
            // simple backoff: +5 minutes per retry
            scheduled_at: shouldRetry
              ? new Date(Date.now() + retryCount * 5 * 60 * 1000).toISOString()
              : item.scheduled_at,
          })
          .eq('id', item.id);

        await supabase.from('dm_send_logs').insert({
          user_id: item.user_id,
          rule_id: item.rule_id,
          account_token_id: item.account_token_id,
          account_type: item.account_type,
          target_user_id: item.target_user_id,
          target_username: item.target_username,
          template_id: item.template_id,
          status: shouldRetry ? 'skipped' : 'failed',
          error_message: error.message,
          sent_at: new Date().toISOString(),
        });
      }
    }

    return new Response(JSON.stringify({ message: 'dispatch-dms completed', processed, sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('dispatch-dms error', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function markQueueStatus(
  supabase: ReturnType<typeof createClient>,
  queueId: string,
  status: 'skipped' | 'failed',
  error_message: string
) {
  await supabase
    .from('dm_send_queue')
    .update({ status, error_message })
    .eq('id', queueId);
}

async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

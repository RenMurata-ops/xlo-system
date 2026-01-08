import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    validateEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseServiceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active CTA triggers
    const { data: triggers, error: triggersError } = await supabase
      .from('cta_triggers')
      .select(`
        *,
        cta_template:post_templates(id, content)
      `)
      .eq('is_active', true);

    if (triggersError) {
      throw triggersError;
    }

    if (!triggers || triggers.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active CTA triggers', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      processed: 0,
      triggered: 0,
      errors: [] as string[],
    };

    for (const trigger of triggers) {
      try {
        // Get token for target account to check their posts
        const { data: targetToken } = await supabase
          .from('account_tokens')
          .select('id, access_token, expires_at')
          .eq('account_id', trigger.target_account_id)
          .eq('account_type', 'main')
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (!targetToken) {
          results.errors.push(`No valid token for target account ${trigger.target_account_id}`);
          continue;
        }

        // Get target account's Twitter user ID
        const { data: targetAccount } = await supabase
          .from('main_accounts')
          .select('handle')
          .eq('id', trigger.target_account_id)
          .single();

        if (!targetAccount) {
          continue;
        }

        // Fetch latest tweets from target account via proxy
        let userData;
        try {
          userData = await callTwitterApiProxy(
            supabaseUrl,
            supabaseServiceKey,
            targetToken.id,
            `/users/by/username/${targetAccount.handle}?user.fields=id`,
            'GET'
          );
        } catch (error: any) {
          results.errors.push(`Failed to fetch user data for ${targetAccount.handle}: ${error.message}`);
          continue;
        }

        if (!userData || !userData.data) {
          results.errors.push(`Invalid user data response for ${targetAccount.handle}`);
          continue;
        }

        const userId = userData.data.id;

        if (!userId) {
          results.errors.push(`Could not get user ID for ${targetAccount.handle}`);
          continue;
        }

        // Fetch user's tweets via proxy
        const tweetsData = await callTwitterApiProxy(
          supabaseUrl,
          supabaseServiceKey,
          targetToken.id,
          `/users/${userId}/tweets?max_results=5&exclude=retweets,replies`,
          'GET'
        );

        const tweets = tweetsData.data || [];

        // Check for new tweets
        for (const tweet of tweets) {
          // Skip if we've already processed this tweet
          if (trigger.last_checked_post_id === tweet.id) {
            break;
          }

          // Check if we already have an execution for this tweet
          const { data: existingExecution } = await supabase
            .from('cta_executions')
            .select('id')
            .eq('trigger_id', trigger.id)
            .eq('target_tweet_id', tweet.id)
            .single();

          if (existingExecution) {
            continue;
          }

          // Calculate random delay
          const delayMinutes = Math.floor(
            Math.random() * (trigger.max_delay_minutes - trigger.min_delay_minutes + 1)
          ) + trigger.min_delay_minutes;

          const scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000);

          // Create CTA execution
          await supabase
            .from('cta_executions')
            .insert({
              trigger_id: trigger.id,
              target_tweet_id: tweet.id,
              status: 'scheduled',
              scheduled_at: scheduledAt.toISOString(),
            });

          results.triggered++;

          // Update last checked post ID
          await supabase
            .from('cta_triggers')
            .update({ last_checked_post_id: tweet.id })
            .eq('id', trigger.id);

          break; // Only process the latest new tweet
        }

        results.processed++;

      } catch (error: any) {
        results.errors.push(`Trigger ${trigger.id}: ${error.message}`);
      }
    }

    // Now execute scheduled CTA replies that are due
    const { data: dueExecutions } = await supabase
      .from('cta_executions')
      .select(`
        *,
        trigger:cta_triggers(
          responder_account_id,
          cta_template:post_templates(content)
        )
      `)
      .eq('status', 'scheduled')
      .lte('scheduled_at', new Date().toISOString())
      .limit(10);

    for (const execution of dueExecutions || []) {
      try {
        // Get responder token
        const { data: responderToken } = await supabase
          .from('account_tokens')
          .select('id, access_token, expires_at')
          .eq('account_id', execution.trigger.responder_account_id)
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (!responderToken) {
          throw new Error('No valid responder token');
        }

        // Send reply via proxy
        const replyData = await callTwitterApiProxy(
          supabaseUrl,
          supabaseServiceKey,
          responderToken.id,
          '/tweets',
          'POST',
          {
            text: execution.trigger.cta_template.content,
            reply: {
              in_reply_to_tweet_id: execution.target_tweet_id,
            },
          }
        );

        // Update execution status
        await supabase
          .from('cta_executions')
          .update({
            status: 'sent',
            reply_tweet_id: replyData.data?.id,
            executed_at: new Date().toISOString(),
          })
          .eq('id', execution.id);

      } catch (error: any) {
        await supabase
          .from('cta_executions')
          .update({
            status: 'failed',
            error_message: error.message,
          })
          .eq('id', execution.id);
      }
    }

    return new Response(
      JSON.stringify({
        message: 'CTA trigger execution completed',
        ...results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('CTA trigger error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

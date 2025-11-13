// refresh-expired-tokens - Batch refresh already expired tokens
// Purpose: Refresh all tokens that have already expired
// Execution: Manual or Cron (daily recommended)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface RefreshResult {
  account_id: string;
  x_username: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

async function refreshToken(supabase: any, token: any): Promise<RefreshResult> {
  try {
    if (!token.refresh_token || token.token_type !== 'oauth2') {
      return {
        account_id: token.id,
        x_username: token.x_username,
        status: 'skipped',
        error: 'No refresh token or not OAuth2',
      };
    }

    // IMPORTANT: Get Twitter App credentials from database, not environment variables
    // This ensures multi-tenant support where each user has their own Twitter App
    if (!token.app_id) {
      return {
        account_id: token.id,
        x_username: token.x_username,
        status: 'failed',
        error: 'No app_id found in token',
      };
    }

    // Get Twitter App from database
    const { data: twitterApp, error: appError } = await supabase
      .from('twitter_apps')
      .select('api_key, api_secret')
      .eq('id', token.app_id)
      .single();

    if (appError || !twitterApp) {
      return {
        account_id: token.id,
        x_username: token.x_username,
        status: 'failed',
        error: 'Failed to fetch Twitter App credentials',
      };
    }

    const twitterClientId = twitterApp.api_key;
    const twitterClientSecret = twitterApp.api_secret;

    const tokenParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token.refresh_token,
      client_id: twitterClientId,
    });

    const basicAuth = btoa(`${twitterClientId}:${twitterClientSecret}`);

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: tokenParams.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();

      // Mark as inactive
      await supabase
        .from('account_tokens')
        .update({
          is_active: false,
          is_suspended: true,
          suspended_at: new Date().toISOString(),
          suspended_reason: 'Token refresh failed',
          error_message: errorText,
        })
        .eq('id', token.id);

      return {
        account_id: token.id,
        x_username: token.x_username,
        status: 'failed',
        error: errorText,
      };
    }

    const newTokenData = await response.json();
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + newTokenData.expires_in);

    await supabase
      .from('account_tokens')
      .update({
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token || token.refresh_token,
        expires_at: expiresAt.toISOString(),
        last_refreshed_at: new Date().toISOString(),
        refresh_count: (token.refresh_count || 0) + 1,
        is_active: true,
        is_suspended: false,
        error_message: null,
      })
      .eq('id', token.id);

    return {
      account_id: token.id,
      x_username: token.x_username,
      status: 'success',
    };

  } catch (error) {
    return {
      account_id: token.id,
      x_username: token.x_username,
      status: 'failed',
      error: error.message,
    };
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

    // Get all expired OAuth2 tokens
    const { data: expiredTokens, error: fetchError } = await supabase
      .from('account_tokens')
      .select('*')
      .eq('token_type', 'oauth2')
      .not('refresh_token', 'is', null)
      .lt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch expired tokens: ${fetchError.message}`);
    }

    if (!expiredTokens || expiredTokens.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No expired tokens found',
          refreshed: 0,
          failed: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Found ${expiredTokens.length} expired tokens`);

    // Refresh in batches of 5
    const batchSize = 5;
    const results: RefreshResult[] = [];

    for (let i = 0; i < expiredTokens.length; i += batchSize) {
      const batch = expiredTokens.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(token => refreshToken(supabase, token))
      );
      results.push(...batchResults);
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    // Send notifications for failures
    if (failedCount > 0) {
      const failedTokens = results.filter(r => r.status === 'failed');
      const userGroups = new Map<string, RefreshResult[]>();

      for (const result of failedTokens) {
        const token = expiredTokens.find(t => t.id === result.account_id);
        if (token) {
          if (!userGroups.has(token.user_id)) {
            userGroups.set(token.user_id, []);
          }
          userGroups.get(token.user_id)!.push(result);
        }
      }

      for (const [userId, failures] of userGroups.entries()) {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: 'Expired Tokens Could Not Be Refreshed',
          message: `${failures.length} expired token(s) failed to refresh. Accounts may be suspended: ${failures.map(f => f.x_username).join(', ')}`,
          type: 'error',
          priority: 'urgent',
          category: 'account',
          action_url: '/accounts/main',
          action_label: 'View Accounts',
          metadata: { failures },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${expiredTokens.length} expired tokens`,
        refreshed: successCount,
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
    console.error('Error in refresh-expired-tokens:', error);
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

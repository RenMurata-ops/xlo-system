// auto-token-refresh - Automatic token refresh for expiring tokens
// Purpose: Automatically refresh OAuth2 tokens that are expiring within 1 hour
// Execution: Cron (every hour recommended)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface TokenRefreshResult {
  account_id: string;
  x_username: string;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

async function refreshSingleToken(
  supabase: any,
  token: any
): Promise<TokenRefreshResult> {
  try {
    // Skip if no refresh token
    if (!token.refresh_token) {
      return {
        account_id: token.id,
        x_username: token.x_username,
        status: 'skipped',
        error: 'No refresh token available',
      };
    }

    // Skip OAuth 1.0a tokens (they don't expire)
    if (token.token_type === 'oauth1a') {
      return {
        account_id: token.id,
        x_username: token.x_username,
        status: 'skipped',
        error: 'OAuth 1.0a tokens do not expire',
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
      console.error(`Token refresh failed for ${token.x_username}:`, errorText);

      // Mark as invalid if refresh fails
      await supabase
        .from('account_tokens')
        .update({
          is_active: false,
          error_message: `Refresh failed: ${errorText}`,
          updated_at: new Date().toISOString(),
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

    // Calculate new expiry time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + newTokenData.expires_in);

    // Update token in database
    const { error: updateError } = await supabase
      .from('account_tokens')
      .update({
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token || token.refresh_token,
        expires_at: expiresAt.toISOString(),
        last_refreshed_at: new Date().toISOString(),
        refresh_count: (token.refresh_count || 0) + 1,
        is_active: true,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', token.id);

    if (updateError) {
      console.error(`Database update failed for ${token.x_username}:`, updateError);
      return {
        account_id: token.id,
        x_username: token.x_username,
        status: 'failed',
        error: updateError.message,
      };
    }

    console.log(`✅ Successfully refreshed token for ${token.x_username}`);
    return {
      account_id: token.id,
      x_username: token.x_username,
      status: 'success',
    };

  } catch (error) {
    console.error(`Error refreshing token for ${token.x_username}:`, error);
    return {
      account_id: token.id,
      x_username: token.x_username,
      status: 'failed',
      error: error.message || 'Unknown error',
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
    // Initialize Supabase with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get tokens expiring within 1 hour
    const oneHourFromNow = new Date();
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);

    const { data: expiringTokens, error: fetchError } = await supabase
      .from('account_tokens')
      .select('*')
      .eq('token_type', 'oauth2')
      .eq('is_active', true)
      .not('refresh_token', 'is', null)
      .lt('expires_at', oneHourFromNow.toISOString())
      .order('expires_at', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch tokens: ${fetchError.message}`);
    }

    if (!expiringTokens || expiringTokens.length === 0) {
      console.log('No tokens require refreshing');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No tokens require refreshing',
          refreshed: 0,
          failed: 0,
          skipped: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    console.log(`Found ${expiringTokens.length} tokens to refresh`);

    // Refresh tokens in parallel (max 5 at a time)
    const batchSize = 5;
    const results: TokenRefreshResult[] = [];

    for (let i = 0; i < expiringTokens.length; i += batchSize) {
      const batch = expiringTokens.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(token => refreshSingleToken(supabase, token))
      );
      results.push(...batchResults);
    }

    // Count results
    const successCount = results.filter(r => r.status === 'success').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    console.log(`Refresh complete: ${successCount} success, ${failedCount} failed, ${skippedCount} skipped`);

    // Send notification if there are failures
    if (failedCount > 0) {
      const failedUsers = results.filter(r => r.status === 'failed');

      // Group by user_id and send notifications
      const userTokens = new Map<string, TokenRefreshResult[]>();
      for (const result of failedUsers) {
        const token = expiringTokens.find(t => t.id === result.account_id);
        if (token) {
          if (!userTokens.has(token.user_id)) {
            userTokens.set(token.user_id, []);
          }
          userTokens.get(token.user_id)!.push(result);
        }
      }

      // Create notifications
      for (const [userId, failures] of userTokens.entries()) {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: 'Token Refresh Failed',
          message: `Failed to refresh ${failures.length} token(s): ${failures.map(f => f.x_username).join(', ')}`,
          type: 'error',
          priority: 'high',
          category: 'account',
          metadata: { failures },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Refreshed ${successCount} tokens`,
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
    console.error('Error in auto-token-refresh:', error);
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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateEnv, getRequiredEnv, fetchWithTimeout } from '../_shared/fetch-with-timeout.ts';

interface TokenRefreshResult {
  token_id: string;
  x_username: string;
  success: boolean;
  error?: string;
}

async function refreshSingleToken(
  supabase: any,
  tokenRecord: any,
  twitterApp: any
): Promise<TokenRefreshResult> {
  try {
    if (!tokenRecord.refresh_token) {
      return {
        token_id: tokenRecord.id,
        x_username: tokenRecord.x_username || 'unknown',
        success: false,
        error: 'No refresh token available',
      };
    }

    const refreshParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenRecord.refresh_token,
    });

    const basicAuth = btoa(`${twitterApp.client_id}:${twitterApp.client_secret}`);

    const response = await fetchWithTimeout('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: refreshParams.toString(),
      timeout: 30000,
      maxRetries: 2,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Token refresh failed for ${tokenRecord.x_username}:`, errorText);

      // Mark token as inactive if refresh completely fails
      if (response.status === 400 || response.status === 401) {
        await supabase
          .from('account_tokens')
          .update({
            is_active: false,
            error_message: `Refresh failed: ${errorText}`,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tokenRecord.id);
      }

      return {
        token_id: tokenRecord.id,
        x_username: tokenRecord.x_username || 'unknown',
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
      };
    }

    const tokenData = await response.json();

    // Calculate new expiry time
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    // Update token in database
    const { error: updateError } = await supabase
      .from('account_tokens')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || tokenRecord.refresh_token,
        expires_at: expiresAt.toISOString(),
        last_refreshed_at: new Date().toISOString(),
        refresh_count: (tokenRecord.refresh_count || 0) + 1,
        error_message: null,
        is_active: true,
      })
      .eq('id', tokenRecord.id);

    if (updateError) {
      console.error(`Failed to update token for ${tokenRecord.x_username}:`, updateError);
      return {
        token_id: tokenRecord.id,
        x_username: tokenRecord.x_username || 'unknown',
        success: false,
        error: `Database update failed: ${updateError.message}`,
      };
    }

    console.log(`Successfully refreshed token for ${tokenRecord.x_username}`);
    return {
      token_id: tokenRecord.id,
      x_username: tokenRecord.x_username || 'unknown',
      success: true,
    };
  } catch (error) {
    console.error(`Error refreshing token for ${tokenRecord.x_username}:`, error);
    return {
      token_id: tokenRecord.id,
      x_username: tokenRecord.x_username || 'unknown',
      success: false,
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
    validateEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
    const SUPABASE_URL = getRequiredEnv('SUPABASE_URL');
    const SERVICE_ROLE_KEY = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Calculate the time threshold (1 hour from now)
    const oneHourFromNow = new Date();
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);

    // Find all tokens expiring within 1 hour
    const { data: expiringTokens, error: tokensError } = await supabase
      .from('account_tokens')
      .select(`
        id,
        user_id,
        access_token,
        refresh_token,
        expires_at,
        x_username,
        account_type,
        refresh_count
      `)
      .eq('token_type', 'oauth2')
      .eq('is_active', true)
      .not('refresh_token', 'is', null)
      .lt('expires_at', oneHourFromNow.toISOString())
      .order('expires_at', { ascending: true });

    if (tokensError) {
      throw new Error(`Failed to fetch expiring tokens: ${tokensError.message}`);
    }

    if (!expiringTokens || expiringTokens.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          message: 'No tokens need refresh',
          refreshed: 0,
          failed: 0,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${expiringTokens.length} tokens to refresh`);

    // Get unique user IDs to fetch their Twitter Apps
    const userIds = [...new Set(expiringTokens.map(t => t.user_id))];

    // Fetch Twitter Apps for all users
    const { data: twitterApps, error: appsError } = await supabase
      .from('twitter_apps')
      .select('id, user_id, client_id, client_secret')
      .in('user_id', userIds)
      .eq('is_active', true);

    if (appsError) {
      throw new Error(`Failed to fetch Twitter Apps: ${appsError.message}`);
    }

    // Create a map of user_id to Twitter App
    const userAppsMap = new Map();
    for (const app of twitterApps || []) {
      if (!userAppsMap.has(app.user_id)) {
        userAppsMap.set(app.user_id, app);
      }
    }

    const results: TokenRefreshResult[] = [];

    // Refresh each token
    for (const token of expiringTokens) {
      const twitterApp = userAppsMap.get(token.user_id);

      if (!twitterApp || !twitterApp.client_id || !twitterApp.client_secret) {
        results.push({
          token_id: token.id,
          x_username: token.x_username || 'unknown',
          success: false,
          error: 'No Twitter App credentials found for user',
        });
        continue;
      }

      const result = await refreshSingleToken(supabase, token, twitterApp);
      results.push(result);

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    console.log(`Token refresh complete: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({
        ok: true,
        message: `Refreshed ${successful} tokens, ${failed} failed`,
        refreshed: successful,
        failed: failed,
        results: results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Token refresh error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

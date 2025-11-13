// validate-and-refresh-tokens - Pre-execution token validation
// Purpose: Validate and refresh tokens before execution (used by other functions)
// Execution: Called by other Edge Functions before performing actions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface ValidationRequest {
  account_ids: string[];      // Array of account_token IDs to validate
  auto_refresh?: boolean;     // Auto refresh if expired (default: true)
}

interface ValidationResult {
  account_id: string;
  x_username: string;
  is_valid: boolean;
  needs_refresh: boolean;
  refreshed: boolean;
  error?: string;
}

async function validateToken(
  supabase: any,
  accountId: string,
  autoRefresh: boolean = true
): Promise<ValidationResult> {
  try {
    // Fetch token
    const { data: token, error: fetchError } = await supabase
      .from('account_tokens')
      .select('*')
      .eq('id', accountId)
      .single();

    if (fetchError || !token) {
      return {
        account_id: accountId,
        x_username: 'unknown',
        is_valid: false,
        needs_refresh: false,
        refreshed: false,
        error: 'Token not found',
      };
    }

    const result: ValidationResult = {
      account_id: token.id,
      x_username: token.x_username,
      is_valid: true,
      needs_refresh: false,
      refreshed: false,
    };

    // Check if already marked as suspended
    if (token.is_suspended) {
      result.is_valid = false;
      result.error = 'Account is suspended';
      return result;
    }

    // Check if token is expired (OAuth2 only)
    if (token.token_type === 'oauth2' && token.expires_at) {
      const expiresAt = new Date(token.expires_at);
      const now = new Date();

      if (expiresAt <= now) {
        result.needs_refresh = true;

        if (autoRefresh && token.refresh_token) {
          // IMPORTANT: Get Twitter App credentials from database, not environment variables
          // This ensures multi-tenant support where each user has their own Twitter App
          if (!token.app_id) {
            result.is_valid = false;
            result.error = 'No app_id found in token';
            return result;
          }

          // Get Twitter App from database
          const { data: twitterApp, error: appError } = await supabase
            .from('twitter_apps')
            .select('api_key, api_secret')
            .eq('id', token.app_id)
            .single();

          if (appError || !twitterApp) {
            result.is_valid = false;
            result.error = 'Failed to fetch Twitter App credentials';
            return result;
          }

          const twitterClientId = twitterApp.api_key;
          const twitterClientSecret = twitterApp.api_secret;

          const tokenParams = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: token.refresh_token,
            client_id: twitterClientId,
          });

          const basicAuth = btoa(`${twitterClientId}:${twitterClientSecret}`);

          const refreshResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${basicAuth}`,
            },
            body: tokenParams.toString(),
          });

          if (refreshResponse.ok) {
            const newTokenData = await refreshResponse.json();
            const newExpiresAt = new Date();
            newExpiresAt.setSeconds(newExpiresAt.getSeconds() + newTokenData.expires_in);

            await supabase
              .from('account_tokens')
              .update({
                access_token: newTokenData.access_token,
                refresh_token: newTokenData.refresh_token || token.refresh_token,
                expires_at: newExpiresAt.toISOString(),
                last_refreshed_at: new Date().toISOString(),
                refresh_count: (token.refresh_count || 0) + 1,
                is_active: true,
                error_message: null,
              })
              .eq('id', token.id);

            result.refreshed = true;
            result.is_valid = true;
          } else {
            result.is_valid = false;
            result.error = 'Failed to refresh expired token';
          }
        } else {
          result.is_valid = false;
          result.error = 'Token expired and auto-refresh disabled';
        }
      }
    }

    // Test connection
    if (result.is_valid) {
      const testResponse = await fetch('https://api.twitter.com/2/users/me', {
        headers: {
          'Authorization': `Bearer ${token.access_token}`,
        },
      });

      if (!testResponse.ok) {
        result.is_valid = false;

        if (testResponse.status === 403) {
          result.error = 'Account suspended by Twitter';
          await supabase
            .from('account_tokens')
            .update({
              is_suspended: true,
              suspended_at: new Date().toISOString(),
              is_active: false,
            })
            .eq('id', token.id);
        } else {
          result.error = 'Connection test failed';
        }
      }
    }

    return result;

  } catch (error) {
    return {
      account_id: accountId,
      x_username: 'unknown',
      is_valid: false,
      needs_refresh: false,
      refreshed: false,
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
    // Parse request body
    const body: ValidationRequest = await req.json();

    if (!body.account_ids || !Array.isArray(body.account_ids)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing or invalid account_ids array',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const autoRefresh = body.auto_refresh !== false; // Default true

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate tokens in parallel (max 5 at a time)
    const batchSize = 5;
    const results: ValidationResult[] = [];

    for (let i = 0; i < body.account_ids.length; i += batchSize) {
      const batch = body.account_ids.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(id => validateToken(supabase, id, autoRefresh))
      );
      results.push(...batchResults);
    }

    // Aggregate stats
    const stats = {
      total: results.length,
      valid: results.filter(r => r.is_valid).length,
      invalid: results.filter(r => !r.is_valid).length,
      refreshed: results.filter(r => r.refreshed).length,
    };

    // Return valid account IDs for use by caller
    const validAccountIds = results
      .filter(r => r.is_valid)
      .map(r => r.account_id);

    return new Response(
      JSON.stringify({
        success: true,
        stats,
        valid_account_ids: validAccountIds,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in validate-and-refresh-tokens:', error);
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

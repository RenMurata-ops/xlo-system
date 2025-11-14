import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface ProxyRequest {
  user_id?: string;
  account_id?: string;
  x_user_id?: string;
  endpoint: string;
  method: string;
  params?: Record<string, any>;
  body?: any;
}

async function refreshAccessToken(
  supabase: any,
  tokenRecord: any
): Promise<string | null> {
  try {
    // IMPORTANT: Get Twitter App credentials from database, not environment variables
    // This ensures multi-tenant support where each user has their own Twitter App
    if (!tokenRecord.app_id) {
      console.error('No app_id found in token record');
      return null;
    }

    // Get Twitter App from database
    const { data: twitterApp, error: appError } = await supabase
      .from('twitter_apps')
      .select('api_key, api_secret')
      .eq('id', tokenRecord.app_id)
      .single();

    if (appError || !twitterApp) {
      console.error('Failed to fetch Twitter App:', appError);
      return null;
    }

    const twitterClientId = twitterApp.api_key;
    const twitterClientSecret = twitterApp.api_secret;

    const refreshParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenRecord.refresh_token,
    });

    const basicAuth = btoa(`${twitterClientId}:${twitterClientSecret}`);

    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: refreshParams.toString(),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text());
      return null;
    }

    const tokenData = await response.json();

    // Update token in database
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    await supabase
      .from('account_tokens')
      .update({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || tokenRecord.refresh_token,
        expires_at: expiresAt.toISOString(),
        last_refreshed_at: new Date().toISOString(),
        refresh_count: (tokenRecord.refresh_count || 0) + 1,
      })
      .eq('id', tokenRecord.id);

    return tokenData.access_token;
  } catch (error) {
    console.error('Refresh token error:', error);
    return null;
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

  const requestStartTime = Date.now();
  let accountDbId: string | null = null;
  let accountType: string | null = null;
  let proxyId: string | null = null;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Use anon key for auth
    const anonSupabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonSupabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const requestData: ProxyRequest = await req.json();
    const { endpoint, method, params, body, x_user_id, account_id } = requestData;

    if (!endpoint || !method) {
      throw new Error('Missing endpoint or method');
    }

    // Find valid access token
    let query = supabase
      .from('account_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('token_type', 'oauth2')
      .eq('is_active', true);

    if (x_user_id) {
      query = query.eq('x_user_id', x_user_id);
    } else if (account_id) {
      query = query.eq('account_id', account_id);
    }

    const { data: tokens, error: tokenError } = await query.limit(1);

    if (tokenError || !tokens || tokens.length === 0) {
      throw new Error('No valid access token found');
    }

    let tokenRecord = tokens[0];
    let accessToken = tokenRecord.access_token;
    accountDbId = tokenRecord.account_id;
    accountType = tokenRecord.account_type;

    // RATE LIMITING: Check if account can make request
    // Increased limits for 500-account operation: Main=5000/day, Spam=3000/day
    const { data: canRequest } = await supabase.rpc('can_account_make_request', {
      p_account_id: accountDbId,
      p_account_type: accountType,
      p_max_daily_requests: accountType === 'spam' ? 3000 : 5000,
    });

    if (!canRequest) {
      throw new Error('Account rate limit exceeded or health score too low');
    }

    // Get proxy info for both main and spam accounts
    const tableName = accountType === 'main' ? 'main_accounts' : 'spam_accounts';
    const { data: accountInfo } = await supabase
      .from(tableName)
      .select('proxy_id')
      .eq('id', accountDbId)
      .single();

    let proxyInfo: any = null;
    if (accountInfo?.proxy_id) {
      proxyId = accountInfo.proxy_id;

      // Get full proxy information including NordVPN config
      const { data: proxy } = await supabase
        .from('proxies')
        .select('*')
        .eq('id', proxyId)
        .single();

      if (proxy && proxy.is_active) {
        proxyInfo = proxy;
        console.log(`Using proxy: ${proxy.name} (${proxy.provider_type})`);
      }
    }

    // Check if token needs refresh (expires in less than 5 minutes)
    const expiresAt = new Date(tokenRecord.expires_at);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiresAt < fiveMinutesFromNow && tokenRecord.refresh_token) {
      console.log('Token expiring soon, refreshing...');
      const newToken = await refreshAccessToken(supabase, tokenRecord);
      if (newToken) {
        accessToken = newToken;
      }
    }

    // Build Twitter API URL
    const twitterUrl = new URL(`https://api.twitter.com${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        twitterUrl.searchParams.set(key, String(value));
      });
    }

    // Make request to Twitter API (with proxy support for NordVPN)
    const twitterHeaders: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    };

    let httpClient: Deno.HttpClient | undefined = undefined;

    // Create HTTP client with proxy if available
    if (proxyInfo) {
      try {
        if (proxyInfo.provider_type === 'nordvpn' && proxyInfo.nordvpn_server) {
          // NordVPN HTTP proxy format: username:password@server:89
          const proxyUrl = `http://${proxyInfo.nordvpn_server}:89`;

          httpClient = Deno.createHttpClient({
            proxy: {
              url: proxyUrl,
              basicAuth: {
                username: proxyInfo.nordvpn_username || '',
                password: proxyInfo.nordvpn_password || '',
              },
            },
          });
          console.log(`Created HTTP client with NordVPN proxy: ${proxyInfo.nordvpn_server}`);
        } else if (proxyInfo.provider_type === 'manual' && proxyInfo.host && proxyInfo.port) {
          // Manual proxy configuration
          const protocol = proxyInfo.protocol || 'http';
          const proxyUrl = `${protocol}://${proxyInfo.host}:${proxyInfo.port}`;

          const proxyConfig: any = { url: proxyUrl };

          if (proxyInfo.username && proxyInfo.password) {
            proxyConfig.basicAuth = {
              username: proxyInfo.username,
              password: proxyInfo.password,
            };
          }

          httpClient = Deno.createHttpClient({ proxy: proxyConfig });
          console.log(`Created HTTP client with manual proxy: ${proxyInfo.host}:${proxyInfo.port}`);
        }
      } catch (proxyError) {
        console.error('Failed to create proxy client, falling back to direct connection:', proxyError);
        // Continue without proxy
      }
    }

    const twitterResponse = await fetch(twitterUrl.toString(), {
      method: method.toUpperCase(),
      headers: twitterHeaders,
      body: body ? JSON.stringify(body) : undefined,
      client: httpClient,
    });

    // Close HTTP client after use
    if (httpClient) {
      httpClient.close();
    }

    const requestDuration = Date.now() - requestStartTime;
    const responseData = await twitterResponse.json();

    // Extract rate limit headers
    const rateLimitLimit = twitterResponse.headers.get('x-rate-limit-limit');
    const rateLimitRemaining = twitterResponse.headers.get('x-rate-limit-remaining');
    const rateLimitReset = twitterResponse.headers.get('x-rate-limit-reset');

    // Calculate rate limit warning
    const limit = parseInt(rateLimitLimit || '0');
    const remaining = parseInt(rateLimitRemaining || '0');
    const isLowRate = limit > 0 && (remaining / limit) < 0.2;
    const isRateLimited = twitterResponse.status === 429;

    // Record rate limit info
    if (rateLimitLimit && rateLimitRemaining && rateLimitReset) {
      const resetDate = new Date(parseInt(rateLimitReset) * 1000);

      await supabase
        .from('rate_limits')
        .upsert({
          user_id: user.id,
          endpoint,
          token_type: 'oauth2',
          limit_total: limit,
          remaining: remaining,
          reset_at: resetDate.toISOString(),
          used_requests: limit - remaining,
          window_started_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,endpoint,token_type,window_started_at',
        });
    }

    // Log request to account_request_log
    await supabase.from('account_request_log').insert({
      user_id: user.id,
      account_id: accountDbId,
      account_type: accountType,
      endpoint,
      method: method.toUpperCase(),
      status_code: twitterResponse.status,
      rate_limit_remaining: remaining || null,
      rate_limit_reset_at: rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toISOString() : null,
      request_duration_ms: requestDuration,
      error_message: twitterResponse.ok ? null : responseData.detail || responseData.title || 'Request failed',
      is_rate_limited: isRateLimited,
      is_error: !twitterResponse.ok,
      proxy_id: proxyId,
      proxy_used: httpClient !== undefined, // True if proxy was actually used
    });

    // Record success/failure for account health
    if (twitterResponse.ok) {
      await supabase.rpc('record_account_success', {
        p_account_id: accountDbId,
        p_account_type: accountType,
      });
    } else {
      await supabase.rpc('record_account_error', {
        p_account_id: accountDbId,
        p_account_type: accountType,
        p_error_message: `${twitterResponse.status}: ${responseData.detail || responseData.title || 'Request failed'}`,
      });
    }

    return new Response(
      JSON.stringify({
        success: twitterResponse.ok,
        status: twitterResponse.status,
        data: responseData,
        rateLimits: {
          limit: rateLimitLimit,
          remaining: rateLimitRemaining,
          reset: rateLimitReset,
          warning: isLowRate ? 'rate_limit_low' : null,
          remaining_percent: limit > 0 ? Math.round((remaining / limit) * 100) : 100,
        },
        health: {
          request_duration_ms: requestDuration,
          is_rate_limited: isRateLimited,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: twitterResponse.ok ? 200 : twitterResponse.status,
      }
    );
  } catch (error) {
    console.error('Proxy error:', error);

    // Log error if we have account info
    if (accountDbId && accountType) {
      const requestDuration = Date.now() - requestStartTime;

      try {
        await supabase.from('account_request_log').insert({
          user_id: user.id,
          account_id: accountDbId,
          account_type: accountType,
          endpoint: requestData?.endpoint || 'unknown',
          method: requestData?.method?.toUpperCase() || 'UNKNOWN',
          status_code: null,
          request_duration_ms: requestDuration,
          error_message: error.message || 'Internal error',
          is_error: true,
          proxy_id: proxyId,
        });

        await supabase.rpc('record_account_error', {
          p_account_id: accountDbId,
          p_account_type: accountType,
          p_error_message: error.message || 'Internal error',
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

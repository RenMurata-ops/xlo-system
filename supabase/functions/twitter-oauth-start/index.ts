import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

// PKCE helper functions
function generateRandomString(length: number): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const base64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Parse request body
    let accountType = 'main';
    let redirectTo = '/accounts/main?connected=1';
    try {
      const body = await req.json();
      if (body.account_type) accountType = body.account_type;
      if (body.redirect_to) redirectTo = body.redirect_to;
    } catch {
      // Use defaults if no body
    }

    // Get user's active Twitter app from database
    const { data: twitterApp, error: appError } = await supabase
      .from('twitter_apps')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    if (appError || !twitterApp) {
      throw new Error('No active Twitter app found. Please add a Twitter app in the Twitter Apps page.');
    }

    // Generate PKCE values
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Save session to database with account_type and app_id
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    const { error: sessionError } = await supabase
      .from('oauth_sessions')
      .upsert({
        user_id: user.id,
        state,
        code_verifier: codeVerifier,
        account_type: accountType,
        app_id: twitterApp.id,
        redirect_to: redirectTo,
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) {
      console.error('Session save error:', sessionError);
      throw new Error('Failed to save OAuth session');
    }

    // Use Twitter app credentials from database
    const twitterClientId = twitterApp.api_key; // Client ID
    const twitterRedirectUri = twitterApp.callback_url || `${supabaseUrl}/functions/v1/twitter-oauth-callback-v2`;
    const scope = 'tweet.read tweet.write users.read offline.access';

    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', twitterClientId);
    authUrl.searchParams.set('redirect_uri', twitterRedirectUri);
    authUrl.searchParams.set('scope', scope);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return new Response(
      JSON.stringify({
        authUrl: authUrl.toString(),
        state,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateEnv, getRequiredEnv } from '../_shared/fetch-with-timeout.ts';

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
    console.log('Auth header present:', !!authHeader);
    console.log('Auth header length:', authHeader?.length || 0);

    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Extract the token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');
    console.log('Token extracted, length:', token.length);

    // Parse request body
    const body = await req.json();
    const { account_id, account_type, twitter_app_id } = body;

    if (!account_id || !account_type || !twitter_app_id) {
      throw new Error('Missing account_id, account_type, or twitter_app_id');
    }

    if (!['main', 'spam', 'follow'].includes(account_type)) {
      throw new Error('Invalid account_type. Must be main, spam, or follow');
    }

    // Validate required environment variables
    validateEnv(['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY']);

    // Initialize Supabase client with anon key to verify the user
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY');
    const supabaseServiceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    // First, verify the user with the anon key
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);

    // Get current user by passing the JWT token directly
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);
    console.log('getUser result - user:', user?.id, 'error:', userError?.message);
    if (userError || !user) {
      console.error('Auth error details:', JSON.stringify(userError));
      throw new Error(`認証エラー: ${userError?.message || 'ユーザーが見つかりません'}。再ログインしてください。`);
    }

    // Create service role client for database operations (bypasses RLS)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch Twitter App credentials from database
    const { data: twitterApp, error: appError } = await supabase
      .from('twitter_apps')
      .select('client_id, client_secret, callback_url')
      .eq('id', twitter_app_id)
      .eq('user_id', user.id)
      .single();

    if (appError || !twitterApp) {
      console.error('Twitter App fetch error:', appError);
      throw new Error('X Appが見つかりません。X Apps管理ページでX Appを登録してください。');
    }

    if (!twitterApp.client_id) {
      throw new Error('X AppにClient IDが設定されていません。X Apps管理ページでClient IDを入力してください。');
    }

    if (!twitterApp.client_secret) {
      throw new Error('X AppにClient Secretが設定されていません。X Apps管理ページでClient Secretを入力してください。');
    }

    // Generate PKCE values
    const state = generateRandomString(32);
    const codeVerifier = generateRandomString(64);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Save session to database with account linking info
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 minutes expiry for better UX

    const { error: sessionError } = await supabase
      .from('oauth_sessions')
      .insert({
        user_id: user.id,
        state,
        code_verifier: codeVerifier,
        account_id: account_id,
        account_type: account_type,
        twitter_app_id: twitter_app_id,
        oauth_version: '2.0',
        created_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) {
      console.error('Session save error:', sessionError);
      console.error('Session error details:', JSON.stringify(sessionError));
      throw new Error(`Failed to save OAuth session: ${sessionError.message}`);
    }

    // Build Twitter authorization URL using credentials from database
    const redirectUri = twitterApp.callback_url ||
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/twitter-oauth-callback-v2`;
    // Full scope for all engagement features
    const scope = 'tweet.read tweet.write users.read like.read like.write follows.read follows.write bookmark.read bookmark.write offline.access';

    const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', twitterApp.client_id);
    authUrl.searchParams.set('redirect_uri', redirectUri);
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

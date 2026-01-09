import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateEnv, getRequiredEnv } from '../_shared/fetch-with-timeout.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { createLogger, getCorrelationId } from '../_shared/logger.ts';
import {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
  InternalError,
  handleError,
  assert,
} from '../_shared/errors.ts';

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
  const corsHeaders = getCorsHeaders();

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const correlationId = getCorrelationId(req);
  const logger = createLogger('twitter-oauth-start', correlationId);

  try {
    logger.info('OAuth start request received');

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    assert(authHeader, new UnauthorizedError('Missing authorization header'));

    // Extract the token from "Bearer <token>"
    const token = authHeader.replace('Bearer ', '');

    // Parse request body
    const body = await req.json();
    const { account_id, account_type, twitter_app_id } = body;

    assert(account_id, new BadRequestError('Missing account_id'));
    assert(account_type, new BadRequestError('Missing account_type'));
    assert(twitter_app_id, new BadRequestError('Missing twitter_app_id'));

    if (!['main', 'spam', 'follow'].includes(account_type)) {
      throw new BadRequestError('Invalid account_type. Must be main, spam, or follow', {
        account_type,
      });
    }

    logger.info('Request validated', { account_id, account_type, twitter_app_id });

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

    if (userError || !user) {
      logger.warn('User authentication failed', { error: userError?.message });
      throw new UnauthorizedError('Authentication failed. Please login again.', {
        reason: userError?.message,
      });
    }

    logger.info('User authenticated', { userId: user.id });

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
      logger.warn('Twitter App not found', { twitter_app_id, error: appError?.message });
      throw new NotFoundError('Twitter App not found. Please register an app in Twitter Apps management.', {
        twitter_app_id,
      });
    }

    assert(twitterApp.client_id, new BadRequestError('Twitter App missing Client ID. Please configure it.'));
    assert(twitterApp.client_secret, new BadRequestError('Twitter App missing Client Secret. Please configure it.'));

    logger.info('Twitter App credentials loaded', { twitter_app_id });

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
      logger.error('Failed to save OAuth session', { error: sessionError.message });
      throw new InternalError('Failed to save OAuth session', {
        error: sessionError.message,
      });
    }

    logger.info('OAuth session created', { state });

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

    logger.info('OAuth URL generated successfully');

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
    return handleError(error, logger);
  }
});

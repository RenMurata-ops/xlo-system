import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000';

    if (error) {
      return Response.redirect(`${appUrl}/twitter-apps?error=${error}`, 302);
    }

    if (!code || !state) {
      throw new Error('Missing code or state parameter');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: session, error: sessionError } = await supabase
      .from('oauth_sessions')
      .select('*')
      .eq('state', state)
      .single();

    if (sessionError || !session) {
      console.error('Session error:', sessionError);
      return Response.redirect(`${appUrl}/twitter-apps?error=invalid_state`, 302);
    }

    if (new Date(session.expires_at) < new Date()) {
      return Response.redirect(`${appUrl}/twitter-apps?error=session_expired`, 302);
    }

    const { data: twitterApp, error: appError } = await supabase
      .from('twitter_apps')
      .select('*')
      .eq('id', session.app_id)
      .single();

    if (appError || !twitterApp) {
      console.error('Twitter app not found:', appError);
      return Response.redirect(`${appUrl}/twitter-apps?error=app_not_found`, 302);
    }

    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: twitterApp.callback_url || `${supabaseUrl}/functions/v1/twitter-oauth-callback-v2`,
      code_verifier: session.code_verifier,
    });

    const basicAuth = btoa(`${twitterApp.api_key}:${twitterApp.api_secret}`);

    const tokenResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${basicAuth}`,
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('Token exchange error:', errorData);
      return Response.redirect(`${appUrl}/twitter-apps?error=token_exchange_failed`, 302);
    }

    const tokenData = await tokenResponse.json();

    const userResponse = await fetch('https://api.twitter.com/2/users/me?user.fields=verified,public_metrics,profile_image_url', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` },
    });

    if (!userResponse.ok) {
      console.error('User fetch error:', await userResponse.text());
      return Response.redirect(`${appUrl}/twitter-apps?error=user_fetch_failed`, 302);
    }

    const userData = await userResponse.json();
    const twitterUser = userData.data;

    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in);

    const { data: accountToken, error: upsertError } = await supabase
      .from('account_tokens')
      .upsert({
        user_id: session.user_id,
        account_type: session.account_type || 'main',
        account_id: null,
        app_id: twitterApp.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || null,
        token_type: 'oauth2',
        expires_at: expiresAt.toISOString(),
        scope: tokenData.scope || 'tweet.read tweet.write users.read offline.access',
        x_user_id: twitterUser.id,
        x_username: twitterUser.username,
        display_name: twitterUser.name || twitterUser.username,
        twitter_display_name: twitterUser.name || null,
        profile_image_url: twitterUser.profile_image_url || null,
        followers_count: twitterUser.public_metrics?.followers_count || 0,
        following_count: twitterUser.public_metrics?.following_count || 0,
        is_active: true,
        is_verified: twitterUser.verified || false,
        last_refreshed_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id,x_user_id,account_type',
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Token save error:', upsertError);
      return Response.redirect(`${appUrl}/twitter-apps?error=token_save_failed`, 302);
    }

    const accountType = session.account_type || 'main';
    let tableName = 'main_accounts';
    if (accountType === 'follow') tableName = 'follow_accounts';
    else if (accountType === 'spam') tableName = 'spam_accounts';

    const accountData: any = {
      user_id: session.user_id,
      handle: twitterUser.username,
      name: twitterUser.name || twitterUser.username,
      followers_count: twitterUser.public_metrics?.followers_count || 0,
      following_count: twitterUser.public_metrics?.following_count || 0,
      is_verified: twitterUser.verified || false,
      is_active: true,
      last_activity_at: new Date().toISOString(),
    };

    const { data: accountRecord, error: accountError } = await supabase
      .from(tableName)
      .upsert(accountData, {
        onConflict: 'user_id,handle',
      })
      .select()
      .single();

    if (accountError) {
      console.error(`Account creation error for ${tableName}:`, accountError);
    } else {
      await supabase
        .from('account_tokens')
        .update({ account_id: accountRecord.id })
        .eq('id', accountToken.id);
    }

    await supabase
      .from('oauth_sessions')
      .delete()
      .eq('id', session.id);

    const redirectUrl = session.redirect_to || '/accounts/main?connected=1';
    return Response.redirect(`${appUrl}${redirectUrl}`, 302);

  } catch (error) {
    console.error('Callback error:', error);
    const appUrl = Deno.env.get('APP_URL') || 'http://localhost:3000';
    return Response.redirect(`${appUrl}/twitter-apps?error=unexpected_error`, 302);
  }
});

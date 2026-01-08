import { createClient } from "npm:@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders();

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const {
      bearer_token,
      user_id,
      account_id,
      x_username,
      x_user_id,
      account_type = 'main'
    } = await req.json();

    if (!bearer_token) {
      throw new Error('bearer_token is required');
    }
    if (!user_id) {
      throw new Error('user_id is required');
    }
    if (!account_id) {
      throw new Error('account_id is required');
    }
    if (!x_username) {
      throw new Error('x_username is required');
    }
    if (!x_user_id) {
      throw new Error('x_user_id is required');
    }

    // Deactivate old oauth2 tokens for this user
    await sb
      .from('account_tokens')
      .update({ is_active: false })
      .eq('x_username', x_username)
      .eq('token_type', 'oauth2');

    // Insert new bearer token (use oauth2 type to satisfy check constraint)
    const { error: insertError } = await sb
      .from('account_tokens')
      .insert({
        user_id,
        account_id,
        x_username,
        x_user_id,
        account_type,
        access_token: bearer_token,
        token_type: 'oauth2',
        is_active: true,
        expires_at: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(), // 10 years
      });

    if (insertError) {
      throw insertError;
    }

    // Verify
    const { data: token } = await sb
      .from('account_tokens')
      .select('x_username, token_type, is_active')
      .eq('x_username', x_username)
      .eq('is_active', true)
      .maybeSingle();

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Bearer token inserted successfully',
        token,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

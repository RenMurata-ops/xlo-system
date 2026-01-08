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

    // Fix BelviaCard60876's token_type to oauth2 and activate
    const { error: updateError } = await sb
      .from('account_tokens')
      .update({
        token_type: 'oauth2',
        is_active: true
      })
      .eq('x_username', 'BelviaCard60876');

    if (updateError) {
      throw updateError;
    }

    // Verify the fix
    const { data: token, error: fetchError } = await sb
      .from('account_tokens')
      .select('x_username, token_type, is_active, x_user_id, expires_at')
      .eq('x_username', 'BelviaCard60876')
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Token type fixed successfully',
        token: token,
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

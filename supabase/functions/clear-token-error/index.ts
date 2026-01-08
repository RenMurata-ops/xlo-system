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

    // Clear error_message for BelviaCard60876's token
    const { error: updateError } = await sb
      .from('account_tokens')
      .update({
        error_message: null,
      })
      .eq('x_username', 'BelviaCard60876');

    if (updateError) {
      throw updateError;
    }

    // Verify
    const { data: token, error: fetchError } = await sb
      .from('account_tokens')
      .select('x_username, token_type, is_active, x_user_id, expires_at, error_message')
      .eq('x_username', 'BelviaCard60876')
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Error message cleared successfully',
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

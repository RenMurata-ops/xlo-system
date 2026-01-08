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

    const { token_id } = await req.json();

    if (!token_id) {
      throw new Error('token_id is required');
    }

    // Force activate the token
    const { error: updateError } = await sb
      .from('account_tokens')
      .update({ is_active: true })
      .eq('id', token_id);

    if (updateError) {
      throw updateError;
    }

    // Get updated token
    const { data: token, error: fetchError } = await sb
      .from('account_tokens')
      .select('x_username, is_active, expires_at')
      .eq('id', token_id)
      .maybeSingle();

    if (fetchError) {
      throw fetchError;
    }

    return new Response(
      JSON.stringify({ success: true, token }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

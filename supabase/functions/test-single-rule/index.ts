// Test a single engagement rule
import { createClient } from 'npm:@supabase/supabase-js@2';
import { validateEnv, getRequiredEnv } from '../_shared/fetch-with-timeout.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const corsHeaders = getCorsHeaders();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { rule_name } = await req.json();

    if (!rule_name) {
      throw new Error('rule_name is required');
    }

    validateEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
    const sb = createClient(
      getRequiredEnv('SUPABASE_URL'),
      getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    );

    // Get the specified rule
    const { data: rule, error: ruleError } = await sb
      .from('auto_engagement_rules')
      .select('*')
      .eq('name', rule_name)
      .eq('is_active', true)
      .single();

    if (ruleError || !rule) {
      throw new Error(`Rule "${rule_name}" not found or not active`);
    }

    // Call execute-auto-engagement logic (import from main function would be better, but for now we'll call via fetch)
    const executeUrl = `${getRequiredEnv('SUPABASE_URL')}/functions/v1/execute-auto-engagement`;
    const executeResponse = await fetch(executeUrl, {
      method: 'POST',
      headers: {
        'Authorization': req.headers.get('Authorization') || '',
        'Content-Type': 'application/json',
      },
    });

    const executeData = await executeResponse.json();

    // Filter results for the specific rule
    const ruleResult = executeData.results?.find((r: any) => r.rule_name === rule_name);

    return new Response(
      JSON.stringify({
        ok: true,
        rule_name: rule_name,
        result: ruleResult || { error: 'Rule not found in results' },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Test single rule error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || 'Test failed',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

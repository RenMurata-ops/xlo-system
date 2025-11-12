import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

interface LoopExecutionResult {
  loop_id: string;
  ok: boolean;
  posts_created: number;
  error?: string;
}

// Weighted random selection
function selectByWeight<T extends { weight: number }>(items: T[]): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of items) {
    random -= item.weight;
    if (random <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

async function pickAccounts(
  sb: any,
  loop: any
): Promise<string[]> {
  try {
    const minCount = loop.min_account_count || 1;
    const maxCount = loop.max_account_count || 5;
    const count = Math.floor(Math.random() * (maxCount - minCount + 1)) + minCount;

    // Use executor_account_ids if specified
    if (loop.executor_account_ids && loop.executor_account_ids.length > 0) {
      const shuffled = [...loop.executor_account_ids].sort(() => Math.random() - 0.5);
      return shuffled.slice(0, Math.min(count, shuffled.length));
    }

    // Otherwise, select from main_accounts
    let query = sb
      .from('main_accounts')
      .select('id')
      .eq('user_id', loop.user_id)
      .eq('is_active', true);

    // Filter by allowed_account_tags if specified
    if (loop.allowed_account_tags && loop.allowed_account_tags.length > 0) {
      query = query.contains('tags', loop.allowed_account_tags);
    }

    const { data, error } = await query.limit(count * 2);

    if (error || !data || data.length === 0) {
      console.error('No accounts found:', error);
      return [];
    }

    // Randomly select required count
    const shuffled = data.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((acc: any) => acc.id);
  } catch (error) {
    console.error('Error picking accounts:', error);
    return [];
  }
}

async function generateTextFromTemplates(
  sb: any,
  loop: any
): Promise<string> {
  try {
    // Get template from loop config or use reply_template_id
    const templateId = loop.reply_template_id;

    if (!templateId) {
      throw new Error('No template specified in loop');
    }

    // Get template
    const { data: template, error: templateError } = await sb
      .from('post_templates')
      .select('*')
      .eq('id', templateId)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      throw new Error('Template not found or inactive');
    }

    let content = '';

    // Get template items for weighted selection
    const { data: items, error: itemsError } = await sb
      .from('post_template_items')
      .select('*')
      .eq('template_id', templateId)
      .eq('is_active', true);

    if (!itemsError && items && items.length > 0) {
      // Select item by weight
      const selectedItem = selectByWeight(items);
      content = selectedItem.content;

      // Update usage count
      await sb
        .from('post_template_items')
        .update({ usage_count: selectedItem.usage_count + 1 })
        .eq('id', selectedItem.id);
    } else {
      content = template.content;
    }

    // Update template usage count
    await sb
      .from('post_templates')
      .update({ usage_count: template.usage_count + 1 })
      .eq('id', template.id);

    return content;
  } catch (error) {
    console.error('Error generating text:', error);
    throw error;
  }
}

async function callTwitterApi(
  supabaseUrl: string,
  anonKey: string,
  options: {
    endpoint: string;
    method: string;
    body?: any;
    params?: any;
    account_id?: string;
    x_user_id?: string;
  }
) {
  try {
    const url = `${supabaseUrl}/functions/v1/twitter-api-proxy`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${anonKey}`,
      },
      body: JSON.stringify(options),
    });

    return await resp.json();
  } catch (error) {
    console.error('Twitter API call error:', error);
    return { success: false, error: error.message };
  }
}

function calcNextRun(loop: any): string {
  const intervalHours = loop.execution_interval_hours || 24;
  const next = new Date();
  next.setHours(next.getHours() + intervalHours);
  return next.toISOString();
}

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const now = new Date().toISOString();

    // Get loops that are ready to execute
    const { data: loops, error: loopsErr } = await sb
      .from('loops')
      .select('*')
      .eq('is_active', true)
      .or(`next_execution_at.is.null,next_execution_at.lte.${now}`)
      .order('next_execution_at', { ascending: true, nullsFirst: true })
      .limit(20);

    if (loopsErr) {
      throw loopsErr;
    }

    if (!loops || loops.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, count: 0, message: 'No loops ready to execute' }),
        {
          headers: { ...corsHeaders, 'content-type': 'application/json' },
        }
      );
    }

    const results: LoopExecutionResult[] = [];

    for (const loop of loops) {
      let postsCreated = 0;
      const usedAccountIds: string[] = [];

      try {
        // Pick executor accounts
        const executorAccountIds = await pickAccounts(sb, loop);

        if (executorAccountIds.length === 0) {
          throw new Error('No executor accounts available');
        }

        usedAccountIds.push(...executorAccountIds);

        // Generate content
        const text = await generateTextFromTemplates(sb, loop);

        // Post for each executor account
        for (const accountId of executorAccountIds) {
          const postRes = await callTwitterApi(SUPABASE_URL, ANON_KEY, {
            endpoint: '/2/tweets',
            method: 'POST',
            body: { text },
            account_id: accountId,
          });

          if (postRes.success && postRes.data?.data?.id) {
            postsCreated++;

            // Create post record
            await sb.from('posts').insert({
              user_id: loop.user_id,
              account_id: accountId,
              content: text,
              tweet_id: postRes.data.data.id,
              posted_at: new Date().toISOString(),
              status: 'posted',
              tags: loop.tags || [],
            });
          }
        }

        // Log execution
        await sb.from('loop_executions').insert({
          user_id: loop.user_id,
          loop_id: loop.id,
          executor_account_id: usedAccountIds[0] || null,
          created_posts_count: postsCreated,
          sent_replies_count: 0,
          used_account_ids: usedAccountIds,
          status: postsCreated > 0 ? 'success' : 'failed',
          exec_data: { posts_created: postsCreated, accounts_used: usedAccountIds.length },
          executed_at: new Date().toISOString(),
        });

        // Update next execution time and post count
        const nextRun = calcNextRun(loop);
        await sb
          .from('loops')
          .update({
            next_execution_at: nextRun,
            last_execution_at: new Date().toISOString(),
            post_count: (loop.post_count || 0) + postsCreated,
          })
          .eq('id', loop.id);

        results.push({
          loop_id: loop.id,
          ok: true,
          posts_created: postsCreated,
        });
      } catch (error) {
        console.error(`Error executing loop ${loop.id}:`, error);

        // Log failed execution
        await sb.from('loop_executions').insert({
          user_id: loop.user_id,
          loop_id: loop.id,
          executor_account_id: usedAccountIds[0] || null,
          created_posts_count: postsCreated,
          sent_replies_count: 0,
          used_account_ids: usedAccountIds,
          status: 'failed',
          error_message: error.message,
          exec_data: { error: error.message },
          executed_at: new Date().toISOString(),
        });

        // Update next execution time even on failure
        const nextRun = calcNextRun(loop);
        await sb
          .from('loops')
          .update({
            next_execution_at: nextRun,
            last_execution_at: new Date().toISOString(),
          })
          .eq('id', loop.id);

        results.push({
          loop_id: loop.id,
          ok: false,
          posts_created: postsCreated,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        count: results.length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Execute loop error:', error);
    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'content-type': 'application/json' },
        status: 500,
      }
    );
  }
});

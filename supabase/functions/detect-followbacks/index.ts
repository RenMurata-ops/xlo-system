import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { validateEnv, getRequiredEnv, fetchWithTimeout } from '../_shared/fetch-with-timeout.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

const corsHeaders = getCorsHeaders();

type Snapshot = {
  id: string;
  recent_follower_ids: string[] | null;
  last_cursor: string | null;
};

type Rule = {
  id: string;
  user_id: string;
  account_token_id: string;
  account_type: 'main' | 'spam' | 'follow';
  template_id: string;
  delay_slot_hours: number;
  daily_limit: number | null;
  status: 'active' | 'paused';
  x_user_id: string;
  x_username: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    validateEnv(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']);
    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseServiceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch active rules with token info
    const { data: rules, error: rulesError } = await supabase
      .from('dm_send_rules')
      .select(`
        id,
        user_id,
        account_token_id,
        account_type,
        template_id,
        delay_slot_hours,
        daily_limit,
        status,
        account_tokens (
          x_user_id,
          x_username,
          access_token
        )
      `)
      .eq('status', 'active');

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ message: 'No active DM rules', enqueued: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let enqueued = 0;
    for (const rule of rules as any[]) {
      if (!rule.account_tokens?.access_token || !rule.account_tokens?.x_user_id) continue;
      const accessToken = rule.account_tokens.access_token as string;
      const xUserId = rule.account_tokens.x_user_id as string;

      // Load snapshot
      const { data: snapshot, error: snapshotError } = await supabase
        .from('follower_snapshots')
        .select('id, recent_follower_ids, last_cursor')
        .eq('account_token_id', rule.account_token_id)
        .eq('user_id', rule.user_id)
        .maybeSingle();

      if (snapshotError) throw snapshotError;
      const recentIds = (snapshot?.recent_follower_ids as string[] | null) || [];

      // Fetch latest followers (limit 100 for now)
      const response = await fetchWithTimeout(
        `https://api.twitter.com/2/users/${xUserId}/followers?max_results=100&user.fields=username`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 20000,
          maxRetries: 1,
        }
      );

      if (!response.ok) {
        console.error('Twitter followers API error', await response.text());
        continue;
      }

      const json = await response.json();
      const followers: any[] = json.data || [];
      const newFollowers = followers.filter(f => !recentIds.includes(f.id));

      if (newFollowers.length === 0) {
        // Update snapshot timestamp only
        await upsertSnapshot(supabase, rule.user_id, rule.account_token_id, followers, snapshot);
        continue;
      }

      const now = new Date();
      const scheduledAt = new Date(now.getTime() + rule.delay_slot_hours * 60 * 60 * 1000).toISOString();

      const queuePayload = newFollowers.map(f => ({
        user_id: rule.user_id,
        rule_id: rule.id,
        account_token_id: rule.account_token_id,
        account_type: rule.account_type,
        target_user_id: f.id,
        target_username: f.username || null,
        template_id: rule.template_id,
        scheduled_at: scheduledAt,
        status: 'pending',
      }));

      const { error: insertQueueError } = await supabase
        .from('dm_send_queue')
        .upsert(queuePayload, { ignoreDuplicates: true });

      if (insertQueueError) {
        console.error('Queue insert error', insertQueueError);
      } else {
        enqueued += queuePayload.length;
      }

      await upsertSnapshot(supabase, rule.user_id, rule.account_token_id, followers, snapshot);
    }

    return new Response(JSON.stringify({ message: 'detect-followbacks completed', enqueued }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('detect-followbacks error', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function upsertSnapshot(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  accountTokenId: string,
  followers: any[],
  snapshot: Snapshot | null
) {
  const followerIds = followers.map((f: any) => f.id);
  const recent = followerIds.slice(0, 500);

  if (snapshot) {
    await supabase
      .from('follower_snapshots')
      .update({
        recent_follower_ids: recent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', snapshot.id);
  } else {
    await supabase.from('follower_snapshots').insert({
      user_id: userId,
      account_token_id: accountTokenId,
      recent_follower_ids: recent,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }
}

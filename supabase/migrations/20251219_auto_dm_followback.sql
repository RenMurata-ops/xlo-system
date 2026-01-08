-- Auto DM on follow-back detection
-- Adds DM template type, DM rules/queue/log tables, and follower snapshot cache

-- Extend template_type to include dm
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_template_type_check;
ALTER TABLE templates
  ADD CONSTRAINT templates_template_type_check
  CHECK (template_type IN ('post', 'reply', 'cta', 'dm'));

COMMENT ON COLUMN templates.template_type IS 'Type of template: post, reply, cta, or dm';

-- dm_send_rules: per-account DM rule for follow-back events
CREATE TABLE IF NOT EXISTS dm_send_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_token_id UUID NOT NULL REFERENCES account_tokens(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('main', 'spam', 'follow')),
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
  delay_slot_hours INTEGER NOT NULL DEFAULT 0 CHECK (delay_slot_hours >= 0 AND delay_slot_hours <= 24),
  daily_limit INTEGER DEFAULT 50 CHECK (daily_limit >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  last_enqueued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, account_token_id, template_id)
);

CREATE INDEX IF NOT EXISTS idx_dm_send_rules_user_id ON dm_send_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_dm_send_rules_account_token ON dm_send_rules(account_token_id);
CREATE INDEX IF NOT EXISTS idx_dm_send_rules_status ON dm_send_rules(status);

-- follower_snapshots: cache recent followers to detect follow-back diff
CREATE TABLE IF NOT EXISTS follower_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_token_id UUID NOT NULL REFERENCES account_tokens(id) ON DELETE CASCADE,
  last_sync_at TIMESTAMPTZ,
  last_cursor TEXT,
  last_follower_count INTEGER,
  recent_follower_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, account_token_id)
);

CREATE INDEX IF NOT EXISTS idx_follower_snapshots_user_id ON follower_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_follower_snapshots_account_token ON follower_snapshots(account_token_id);

-- dm_send_queue: pending DM jobs (scheduled with delay slots)
CREATE TABLE IF NOT EXISTS dm_send_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES dm_send_rules(id) ON DELETE SET NULL,
  account_token_id UUID NOT NULL REFERENCES account_tokens(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('main', 'spam', 'follow')),
  target_user_id TEXT NOT NULL,
  target_username TEXT,
  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'skipped')),
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(rule_id, target_user_id, template_id, scheduled_at)
);

CREATE INDEX IF NOT EXISTS idx_dm_send_queue_status_schedule ON dm_send_queue(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_dm_send_queue_account_token ON dm_send_queue(account_token_id);
CREATE INDEX IF NOT EXISTS idx_dm_send_queue_rule_id ON dm_send_queue(rule_id);

-- dm_send_logs: history for sent/failed/skipped DMs
CREATE TABLE IF NOT EXISTS dm_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id UUID REFERENCES dm_send_rules(id) ON DELETE SET NULL,
  account_token_id UUID NOT NULL REFERENCES account_tokens(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('main', 'spam', 'follow')),
  target_user_id TEXT NOT NULL,
  target_username TEXT,
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
  error_message TEXT,
  response_data JSONB,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dm_send_logs_account_token ON dm_send_logs(account_token_id);
CREATE INDEX IF NOT EXISTS idx_dm_send_logs_rule ON dm_send_logs(rule_id);
CREATE INDEX IF NOT EXISTS idx_dm_send_logs_status ON dm_send_logs(status);

-- RLS
ALTER TABLE dm_send_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_send_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_send_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dm_send_rules_user_policy ON dm_send_rules;
CREATE POLICY dm_send_rules_user_policy
  ON dm_send_rules FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS follower_snapshots_user_policy ON follower_snapshots;
CREATE POLICY follower_snapshots_user_policy
  ON follower_snapshots FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS dm_send_queue_user_policy ON dm_send_queue;
CREATE POLICY dm_send_queue_user_policy
  ON dm_send_queue FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS dm_send_logs_user_policy ON dm_send_logs;
CREATE POLICY dm_send_logs_user_policy
  ON dm_send_logs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Triggers to maintain updated_at
DROP TRIGGER IF EXISTS update_dm_send_rules_updated_at ON dm_send_rules;
CREATE TRIGGER update_dm_send_rules_updated_at
  BEFORE UPDATE ON dm_send_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_follower_snapshots_updated_at ON follower_snapshots;
CREATE TRIGGER update_follower_snapshots_updated_at
  BEFORE UPDATE ON follower_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dm_send_queue_updated_at ON dm_send_queue;
CREATE TRIGGER update_dm_send_queue_updated_at
  BEFORE UPDATE ON dm_send_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

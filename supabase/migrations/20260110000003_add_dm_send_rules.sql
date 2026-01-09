-- Add DM Send Rules and Follower Snapshots
-- Created: 2026-01-10
-- Purpose: Enable auto-DM functionality for followback detection

-- ============================================================================
-- 1. Create dm_send_rules table
-- ============================================================================
CREATE TABLE IF NOT EXISTS dm_send_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_token_id UUID NOT NULL REFERENCES account_tokens(id) ON DELETE CASCADE,
  account_type TEXT NOT NULL CHECK (account_type IN ('main', 'spam', 'follow')),
  template_id UUID NOT NULL REFERENCES post_templates(id) ON DELETE RESTRICT,
  delay_slot_hours INTEGER NOT NULL DEFAULT 24 CHECK (delay_slot_hours > 0),
  daily_limit INTEGER CHECK (daily_limit IS NULL OR daily_limit > 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, account_token_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dm_send_rules_user_id ON dm_send_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_dm_send_rules_account_token_id ON dm_send_rules(account_token_id);
CREATE INDEX IF NOT EXISTS idx_dm_send_rules_status ON dm_send_rules(status);

-- RLS policies
ALTER TABLE dm_send_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own DM rules" ON dm_send_rules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own DM rules" ON dm_send_rules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own DM rules" ON dm_send_rules
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own DM rules" ON dm_send_rules
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_dm_send_rules_updated_at
  BEFORE UPDATE ON dm_send_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 2. Create follower_snapshots table
-- ============================================================================
CREATE TABLE IF NOT EXISTS follower_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_token_id UUID NOT NULL REFERENCES account_tokens(id) ON DELETE CASCADE,
  recent_follower_ids TEXT[] NOT NULL DEFAULT '{}',
  last_cursor TEXT,
  last_checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, account_token_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_follower_snapshots_user_id ON follower_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_follower_snapshots_account_token_id ON follower_snapshots(account_token_id);
CREATE INDEX IF NOT EXISTS idx_follower_snapshots_last_checked_at ON follower_snapshots(last_checked_at);

-- RLS policies
ALTER TABLE follower_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own follower snapshots" ON follower_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own follower snapshots" ON follower_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own follower snapshots" ON follower_snapshots
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own follower snapshots" ON follower_snapshots
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can manage all snapshots (for Cron jobs)
CREATE POLICY "Service role can manage follower snapshots" ON follower_snapshots
  FOR ALL USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_follower_snapshots_updated_at
  BEFORE UPDATE ON follower_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 3. Create dm_queue table
-- ============================================================================
CREATE TABLE IF NOT EXISTS dm_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES dm_send_rules(id) ON DELETE CASCADE,
  account_token_id UUID NOT NULL REFERENCES account_tokens(id) ON DELETE CASCADE,
  target_user_id TEXT NOT NULL,
  target_username TEXT NOT NULL,
  message_content TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_dm_queue_user_id ON dm_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_dm_queue_rule_id ON dm_queue(rule_id);
CREATE INDEX IF NOT EXISTS idx_dm_queue_account_token_id ON dm_queue(account_token_id);
CREATE INDEX IF NOT EXISTS idx_dm_queue_status ON dm_queue(status);
CREATE INDEX IF NOT EXISTS idx_dm_queue_scheduled_at ON dm_queue(scheduled_at) WHERE status = 'pending';

-- RLS policies
ALTER TABLE dm_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own DM queue" ON dm_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own DM queue items" ON dm_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own DM queue items" ON dm_queue
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own DM queue items" ON dm_queue
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can manage all queue items (for dispatch)
CREATE POLICY "Service role can manage dm queue" ON dm_queue
  FOR ALL USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_dm_queue_updated_at
  BEFORE UPDATE ON dm_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. Comments
-- ============================================================================
COMMENT ON TABLE dm_send_rules IS 'Auto-DM rules for sending messages to new followers';
COMMENT ON TABLE follower_snapshots IS 'Snapshots of follower lists for detecting new followers';
COMMENT ON TABLE dm_queue IS 'Queue for scheduled DM dispatch';

COMMENT ON COLUMN dm_send_rules.delay_slot_hours IS 'Hours to wait after followback before sending DM';
COMMENT ON COLUMN dm_send_rules.daily_limit IS 'Maximum DMs to send per day per rule (NULL = unlimited)';
COMMENT ON COLUMN follower_snapshots.recent_follower_ids IS 'Array of recent follower IDs for diff detection';
COMMENT ON COLUMN dm_queue.scheduled_at IS 'When to send the DM (follows delay_slot_hours)';

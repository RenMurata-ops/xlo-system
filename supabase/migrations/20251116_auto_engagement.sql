-- Stage6: Auto Engagement Rules
-- Migration for automatic engagement functionality

-- =====================================================
-- Table: auto_engagement_rules
-- =====================================================
-- Drop existing table to ensure clean slate
DROP TABLE IF EXISTS auto_engagement_rules CASCADE;

CREATE TABLE auto_engagement_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,

  -- Basic Info
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Search Configuration
  search_type TEXT NOT NULL CHECK (search_type IN ('keyword', 'url', 'user', 'hashtag')),
  search_query TEXT NOT NULL,

  -- Action Configuration
  action_type TEXT NOT NULL CHECK (action_type IN ('like', 'reply', 'retweet', 'follow', 'quote')),
  reply_template_id UUID REFERENCES post_templates(id) ON DELETE SET NULL,

  -- Filters
  min_followers INTEGER DEFAULT 0,
  max_followers INTEGER,
  min_account_age_days INTEGER DEFAULT 0,
  exclude_keywords TEXT[], -- Array of keywords to exclude
  exclude_verified BOOLEAN DEFAULT false,
  require_verified BOOLEAN DEFAULT false,

  -- Execution Settings
  executor_account_ids UUID[], -- Specific accounts to use for actions
  allowed_account_tags TEXT[], -- Or filter by tags
  max_actions_per_execution INTEGER DEFAULT 10,
  execution_interval_hours INTEGER DEFAULT 1,

  -- Limits & Throttling
  daily_limit INTEGER DEFAULT 100,
  actions_today INTEGER DEFAULT 0,
  last_daily_reset TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  -- Scheduling
  next_execution_at TIMESTAMPTZ,
  last_execution_at TIMESTAMPTZ,

  -- Stats
  total_actions_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_auto_engagement_rules_user_id ON auto_engagement_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_engagement_rules_active ON auto_engagement_rules(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_auto_engagement_rules_next_execution ON auto_engagement_rules(next_execution_at)
  WHERE is_active = true AND next_execution_at IS NOT NULL;

-- =====================================================
-- Table: auto_engagement_executions
-- =====================================================
-- Drop existing table to ensure clean slate
DROP TABLE IF EXISTS auto_engagement_executions CASCADE;

CREATE TABLE auto_engagement_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_id UUID NOT NULL REFERENCES auto_engagement_rules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  -- Execution Details
  executed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),
  trace_id UUID DEFAULT uuid_generate_v4(),

  -- Results
  searched_count INTEGER DEFAULT 0,
  filtered_count INTEGER DEFAULT 0,
  actions_attempted INTEGER DEFAULT 0,
  actions_succeeded INTEGER DEFAULT 0,
  actions_failed INTEGER DEFAULT 0,

  -- Account & Target Info
  used_account_ids UUID[],
  target_tweet_ids TEXT[],
  target_user_ids TEXT[],

  -- Data
  exec_data JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  error_json JSONB,

  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_auto_engagement_executions_rule_id ON auto_engagement_executions(rule_id);
CREATE INDEX IF NOT EXISTS idx_auto_engagement_executions_user_id ON auto_engagement_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_engagement_executions_executed_at ON auto_engagement_executions(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_auto_engagement_executions_trace_id ON auto_engagement_executions(trace_id);

-- =====================================================
-- Helper Functions
-- =====================================================

-- Reset daily action counts (called by cron or before execution)
CREATE OR REPLACE FUNCTION reset_daily_engagement_limits()
RETURNS INTEGER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE auto_engagement_rules
  SET
    actions_today = 0,
    last_daily_reset = CURRENT_TIMESTAMP
  WHERE last_daily_reset < CURRENT_DATE;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

-- Get rules ready for execution
CREATE OR REPLACE FUNCTION get_pending_engagement_rules(p_user_id UUID DEFAULT NULL, p_limit INTEGER DEFAULT 20)
RETURNS SETOF auto_engagement_rules AS $$
BEGIN
  -- Reset daily limits if needed
  PERFORM reset_daily_engagement_limits();

  RETURN QUERY
  SELECT *
  FROM auto_engagement_rules
  WHERE is_active = true
    AND (p_user_id IS NULL OR user_id = p_user_id)
    AND (next_execution_at IS NULL OR next_execution_at <= NOW())
    AND (daily_limit IS NULL OR actions_today < daily_limit)
  ORDER BY
    COALESCE(next_execution_at, '1970-01-01'::TIMESTAMPTZ) ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Update rule stats after execution
CREATE OR REPLACE FUNCTION update_engagement_rule_stats(
  p_rule_id UUID,
  p_actions_count INTEGER,
  p_success_count INTEGER,
  p_failure_count INTEGER
)
RETURNS VOID AS $$
BEGIN
  UPDATE auto_engagement_rules
  SET
    actions_today = actions_today + p_actions_count,
    total_actions_count = total_actions_count + p_actions_count,
    success_count = success_count + p_success_count,
    failure_count = failure_count + p_failure_count,
    last_execution_at = NOW(),
    next_execution_at = NOW() + (execution_interval_hours || ' hours')::INTERVAL,
    updated_at = NOW()
  WHERE id = p_rule_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Views
-- =====================================================

-- Active engagement rules with stats
CREATE OR REPLACE VIEW v_active_engagement_rules AS
SELECT
  r.id,
  r.user_id,
  r.name,
  r.search_type,
  r.search_query,
  r.action_type,
  r.is_active,
  r.actions_today,
  r.daily_limit,
  r.total_actions_count,
  r.success_count,
  r.failure_count,
  r.next_execution_at,
  r.last_execution_at,
  CASE
    WHEN r.daily_limit IS NOT NULL THEN
      ROUND((r.actions_today::NUMERIC / NULLIF(r.daily_limit, 0)) * 100, 1)
    ELSE NULL
  END as daily_usage_percent,
  CASE
    WHEN r.total_actions_count > 0 THEN
      ROUND((r.success_count::NUMERIC / NULLIF(r.total_actions_count, 0)) * 100, 1)
    ELSE NULL
  END as success_rate_percent
FROM auto_engagement_rules r
WHERE r.is_active = true
ORDER BY r.next_execution_at ASC NULLS FIRST;

-- Recent engagement executions with rule info
CREATE OR REPLACE VIEW v_recent_engagement_executions AS
SELECT
  e.id,
  e.rule_id,
  r.name as rule_name,
  r.action_type,
  e.executed_at,
  e.status,
  e.actions_attempted,
  e.actions_succeeded,
  e.actions_failed,
  e.trace_id,
  e.error_message
FROM auto_engagement_executions e
JOIN auto_engagement_rules r ON r.id = e.rule_id
ORDER BY e.executed_at DESC
LIMIT 100;

-- Daily engagement stats by rule
CREATE OR REPLACE VIEW v_engagement_daily_stats AS
SELECT
  r.id as rule_id,
  r.name as rule_name,
  DATE(e.executed_at) as execution_date,
  COUNT(*) as execution_count,
  SUM(e.actions_attempted) as total_attempted,
  SUM(e.actions_succeeded) as total_succeeded,
  SUM(e.actions_failed) as total_failed,
  ROUND(AVG(CASE
    WHEN e.actions_attempted > 0 THEN
      (e.actions_succeeded::NUMERIC / NULLIF(e.actions_attempted, 0)) * 100
    ELSE NULL
  END), 1) as avg_success_rate
FROM auto_engagement_rules r
LEFT JOIN auto_engagement_executions e ON e.rule_id = r.id
WHERE e.executed_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY r.id, r.name, DATE(e.executed_at)
ORDER BY execution_date DESC, r.name;

-- =====================================================
-- RLS Policies (if using RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE auto_engagement_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_engagement_executions ENABLE ROW LEVEL SECURITY;

-- Policies for auto_engagement_rules
CREATE POLICY "Users can view their own engagement rules"
  ON auto_engagement_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own engagement rules"
  ON auto_engagement_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own engagement rules"
  ON auto_engagement_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own engagement rules"
  ON auto_engagement_rules FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for auto_engagement_executions
CREATE POLICY "Users can view their own engagement executions"
  ON auto_engagement_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert engagement executions"
  ON auto_engagement_executions FOR INSERT
  WITH CHECK (true);

-- =====================================================
-- Updated At Trigger
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_engagement_rules_updated_at
  BEFORE UPDATE ON auto_engagement_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

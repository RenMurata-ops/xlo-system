-- Modify auto_engagement_rules to support multiple action types
-- Change action_type from single value to array

-- First, drop the old CHECK constraint
ALTER TABLE auto_engagement_rules DROP CONSTRAINT IF EXISTS auto_engagement_rules_action_type_check;

-- Add new column for action_types array
ALTER TABLE auto_engagement_rules ADD COLUMN IF NOT EXISTS action_types TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Migrate existing data from action_type to action_types
UPDATE auto_engagement_rules
SET action_types = ARRAY[action_type]::TEXT[]
WHERE action_types = ARRAY[]::TEXT[] OR action_types IS NULL;

-- Add CHECK constraint for valid action types
ALTER TABLE auto_engagement_rules ADD CONSTRAINT auto_engagement_rules_action_types_check
  CHECK (
    action_types <@ ARRAY['like', 'reply', 'retweet', 'follow']::TEXT[] AND
    array_length(action_types, 1) > 0
  );

-- Keep old action_type column for backward compatibility temporarily
-- We'll remove it in a future migration after confirming everything works

-- Update the get_pending_engagement_rules function to handle array
CREATE OR REPLACE FUNCTION get_pending_engagement_rules(
  p_user_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  name TEXT,
  search_type TEXT,
  search_query TEXT,
  action_type TEXT,
  action_types TEXT[],
  reply_template_id UUID,
  min_followers INT,
  max_followers INT,
  min_account_age_days INT,
  exclude_keywords TEXT[],
  exclude_verified BOOLEAN,
  require_verified BOOLEAN,
  executor_account_ids UUID[],
  allowed_account_tags TEXT[],
  max_actions_per_execution INT,
  daily_limit INT,
  actions_today INT,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.user_id,
    r.name,
    r.search_type,
    r.search_query,
    r.action_type, -- Keep for backward compatibility
    COALESCE(r.action_types, ARRAY[r.action_type]::TEXT[]) as action_types,
    r.reply_template_id,
    r.min_followers,
    r.max_followers,
    r.min_account_age_days,
    r.exclude_keywords,
    r.exclude_verified,
    r.require_verified,
    r.executor_account_ids,
    r.allowed_account_tags,
    r.max_actions_per_execution,
    r.daily_limit,
    COALESCE(r.actions_today, 0) as actions_today,
    r.is_active
  FROM auto_engagement_rules r
  WHERE
    r.is_active = true
    AND (p_user_id IS NULL OR r.user_id = p_user_id)
    AND (r.next_execution_at IS NULL OR r.next_execution_at <= NOW())
    AND COALESCE(r.actions_today, 0) < r.daily_limit
  ORDER BY r.last_executed_at ASC NULLS FIRST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Comment
COMMENT ON COLUMN auto_engagement_rules.action_types IS 'Array of action types to perform: like, reply, retweet, follow';

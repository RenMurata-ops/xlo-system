-- ============================================================================
-- Fix auto_engagement_rules execution tracking columns
-- Problem: Missing last_executed_at and next_execution_at columns
-- ============================================================================

-- Add missing execution tracking columns
ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS last_executed_at TIMESTAMPTZ;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS next_execution_at TIMESTAMPTZ;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS total_actions INTEGER DEFAULT 0;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS total_successes INTEGER DEFAULT 0;

ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS total_failures INTEGER DEFAULT 0;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_engagement_rules_next_execution
ON auto_engagement_rules(next_execution_at)
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_engagement_rules_last_execution
ON auto_engagement_rules(last_executed_at)
WHERE is_active = true;

-- Verification
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'auto_engagement_rules'
  AND column_name IN ('last_executed_at', 'next_execution_at', 'total_actions', 'total_successes', 'total_failures')
ORDER BY column_name;

SELECT '✅ Engagement execution tracking columns added!' as result;

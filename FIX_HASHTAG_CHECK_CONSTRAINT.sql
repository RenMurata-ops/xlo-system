-- ============================================================================
-- Fix auto_engagement_rules CHECK constraint to allow 'hashtag' search type
-- Problem: CHECK constraint only allows ('keyword', 'url', 'user'), missing 'hashtag'
-- Solution: Drop old constraints and add new ones that include 'hashtag'
-- ============================================================================

-- Step 1: Drop existing CHECK constraints on rule_type and search_type
-- Find and drop the constraints by name
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Drop all check constraints on rule_type column
    FOR constraint_record IN
        SELECT constraint_name
        FROM information_schema.constraint_column_usage
        WHERE table_name = 'auto_engagement_rules'
          AND column_name = 'rule_type'
    LOOP
        EXECUTE 'ALTER TABLE auto_engagement_rules DROP CONSTRAINT IF EXISTS ' || constraint_record.constraint_name || ' CASCADE';
    END LOOP;

    -- Drop all check constraints on search_type column
    FOR constraint_record IN
        SELECT constraint_name
        FROM information_schema.constraint_column_usage
        WHERE table_name = 'auto_engagement_rules'
          AND column_name = 'search_type'
    LOOP
        EXECUTE 'ALTER TABLE auto_engagement_rules DROP CONSTRAINT IF EXISTS ' || constraint_record.constraint_name || ' CASCADE';
    END LOOP;
END $$;

-- Step 2: Add new CHECK constraints that include 'hashtag'
ALTER TABLE auto_engagement_rules
ADD CONSTRAINT auto_engagement_rules_rule_type_check
CHECK (rule_type IS NULL OR rule_type IN ('keyword', 'url', 'user', 'hashtag'));

ALTER TABLE auto_engagement_rules
ADD CONSTRAINT auto_engagement_rules_search_type_check
CHECK (search_type IS NULL OR search_type IN ('keyword', 'url', 'user', 'hashtag'));

-- ============================================================================
-- Verification
-- ============================================================================

-- Check the new constraints
SELECT
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conrelid = 'auto_engagement_rules'::regclass
  AND contype = 'c'
  AND conname LIKE '%type%'
ORDER BY conname;

SELECT '✅ CHECK constraints updated to allow hashtag search type!' as result;

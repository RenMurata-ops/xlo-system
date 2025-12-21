-- ============================================================================
-- Fix auto_engagement_rules rule_type constraint issue
-- Problem: Frontend sends 'search_type' but database expects 'rule_type' (NOT NULL)
-- Solution: Make rule_type optional and sync it with search_type column
-- ============================================================================

-- Step 1: Copy any existing rule_type values to search_type column if search_type is NULL
UPDATE auto_engagement_rules
SET search_type = rule_type
WHERE search_type IS NULL AND rule_type IS NOT NULL;

-- Step 2: Copy search_type to rule_type where rule_type is NULL (for existing rules)
UPDATE auto_engagement_rules
SET rule_type = search_type
WHERE rule_type IS NULL AND search_type IS NOT NULL;

-- Step 3: Make rule_type nullable (remove NOT NULL constraint)
ALTER TABLE auto_engagement_rules ALTER COLUMN rule_type DROP NOT NULL;

-- Step 4: Update the trigger to also sync search_type ↔ rule_type
CREATE OR REPLACE FUNCTION sync_engagement_rule_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync name ↔ rule_name
  IF NEW.name IS NOT NULL THEN
    NEW.rule_name := NEW.name;
  END IF;

  IF NEW.rule_name IS NOT NULL AND NEW.name IS NULL THEN
    NEW.name := NEW.rule_name;
  END IF;

  -- Sync search_type ↔ rule_type
  IF NEW.search_type IS NOT NULL THEN
    NEW.rule_type := NEW.search_type;
  END IF;

  IF NEW.rule_type IS NOT NULL AND NEW.search_type IS NULL THEN
    NEW.search_type := NEW.rule_type;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_sync_engagement_rule_name ON auto_engagement_rules;
DROP TRIGGER IF EXISTS trigger_sync_engagement_rule_fields ON auto_engagement_rules;

-- Create the updated trigger
CREATE TRIGGER trigger_sync_engagement_rule_fields
  BEFORE INSERT OR UPDATE ON auto_engagement_rules
  FOR EACH ROW
  EXECUTE FUNCTION sync_engagement_rule_fields();

-- ============================================================================
-- Verification
-- ============================================================================

-- Check that both rule_type and rule_name are now nullable
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'auto_engagement_rules'
  AND column_name IN ('name', 'rule_name', 'search_type', 'rule_type')
ORDER BY column_name;

-- Check the trigger exists
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'auto_engagement_rules'
  AND trigger_name = 'trigger_sync_engagement_rule_fields';

SELECT '✅ auto_engagement_rules field sync fixed!' as result;
SELECT '✅ Both name↔rule_name and search_type↔rule_type are now synced automatically' as result;

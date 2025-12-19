-- ============================================================================
-- Fix auto_engagement_rules rule_name constraint issue
-- Problem: Frontend sends 'name' but database expects 'rule_name' (NOT NULL)
-- Solution: Make rule_name optional and sync it with name column
-- ============================================================================

-- Step 1: Copy any existing rule_name values to name column if name is NULL
UPDATE auto_engagement_rules
SET name = rule_name
WHERE name IS NULL AND rule_name IS NOT NULL;

-- Step 2: Copy name to rule_name where rule_name is NULL (for existing rules)
UPDATE auto_engagement_rules
SET rule_name = name
WHERE rule_name IS NULL AND name IS NOT NULL;

-- Step 3: Make rule_name nullable (remove NOT NULL constraint)
ALTER TABLE auto_engagement_rules ALTER COLUMN rule_name DROP NOT NULL;

-- Step 4: Create a trigger to automatically sync name → rule_name on INSERT/UPDATE
CREATE OR REPLACE FUNCTION sync_engagement_rule_name()
RETURNS TRIGGER AS $$
BEGIN
  -- If name is provided, copy it to rule_name
  IF NEW.name IS NOT NULL THEN
    NEW.rule_name := NEW.name;
  END IF;

  -- If rule_name is provided but name is not, copy rule_name to name
  IF NEW.rule_name IS NOT NULL AND NEW.name IS NULL THEN
    NEW.name := NEW.rule_name;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_sync_engagement_rule_name ON auto_engagement_rules;

-- Create the trigger
CREATE TRIGGER trigger_sync_engagement_rule_name
  BEFORE INSERT OR UPDATE ON auto_engagement_rules
  FOR EACH ROW
  EXECUTE FUNCTION sync_engagement_rule_name();

-- ============================================================================
-- Verification
-- ============================================================================

-- Check that rule_name is now nullable
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'auto_engagement_rules'
  AND column_name IN ('name', 'rule_name')
ORDER BY column_name;

-- Check the trigger exists
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'auto_engagement_rules'
  AND trigger_name = 'trigger_sync_engagement_rule_name';

SELECT '✅ auto_engagement_rules rule_name constraint fixed!' as result;
SELECT '✅ Trigger created to sync name ↔ rule_name automatically' as result;

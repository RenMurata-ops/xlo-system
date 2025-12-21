-- ============================================================================
-- Fix auto_engagement_rules action_type constraint issue
-- Problem: Frontend sends 'action_types' (array) but database expects 'action_type' (single value, NOT NULL)
-- Solution: Make action_type optional and sync it with action_types array
-- ============================================================================

-- Step 1: Copy any existing action_type values to action_types array if action_types is NULL
UPDATE auto_engagement_rules
SET action_types = ARRAY[action_type]::TEXT[]
WHERE action_types IS NULL AND action_type IS NOT NULL;

-- Step 2: Copy first element of action_types to action_type where action_type is NULL
UPDATE auto_engagement_rules
SET action_type = action_types[1]
WHERE action_type IS NULL AND action_types IS NOT NULL AND array_length(action_types, 1) > 0;

-- Step 3: Make action_type nullable (remove NOT NULL constraint)
ALTER TABLE auto_engagement_rules ALTER COLUMN action_type DROP NOT NULL;

-- Step 4: Update the trigger to also sync action_types ↔ action_type
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

  -- Sync action_types (array) ↔ action_type (single)
  IF NEW.action_types IS NOT NULL AND array_length(NEW.action_types, 1) > 0 THEN
    -- Set action_type to first element of action_types array
    NEW.action_type := NEW.action_types[1];
  END IF;

  IF NEW.action_type IS NOT NULL AND (NEW.action_types IS NULL OR array_length(NEW.action_types, 1) = 0) THEN
    -- Set action_types to single-element array containing action_type
    NEW.action_types := ARRAY[NEW.action_type]::TEXT[];
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_sync_engagement_rule_fields ON auto_engagement_rules;

-- Create the updated trigger
CREATE TRIGGER trigger_sync_engagement_rule_fields
  BEFORE INSERT OR UPDATE ON auto_engagement_rules
  FOR EACH ROW
  EXECUTE FUNCTION sync_engagement_rule_fields();

-- ============================================================================
-- Verification
-- ============================================================================

-- Check that action_type is now nullable
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'auto_engagement_rules'
  AND column_name IN ('action_type', 'action_types')
ORDER BY column_name;

-- Check the trigger exists
SELECT
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'auto_engagement_rules'
  AND trigger_name = 'trigger_sync_engagement_rule_fields';

SELECT '✅ auto_engagement_rules action_type sync fixed!' as result;
SELECT '✅ All fields synced: name↔rule_name, search_type↔rule_type, action_types↔action_type' as result;

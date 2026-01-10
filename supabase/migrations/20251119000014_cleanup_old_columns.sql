-- Clean up old account_handle/account_name columns
-- The database now uses handle/name instead

-- First drop any views that might depend on these columns
DROP VIEW IF EXISTS v_proxy_assignment_status CASCADE;
DROP VIEW IF EXISTS v_account_overview CASCADE;
DROP VIEW IF EXISTS v_post_performance CASCADE;

-- For main_accounts: drop old columns if they exist
ALTER TABLE main_accounts DROP COLUMN IF EXISTS account_handle;
ALTER TABLE main_accounts DROP COLUMN IF EXISTS account_name;

-- Note: spam_accounts already uses 'handle' and 'name' columns from the initial schema
-- No old columns to drop for spam_accounts
-- ALTER TABLE spam_accounts DROP COLUMN IF EXISTS account_handle;
-- ALTER TABLE spam_accounts DROP COLUMN IF EXISTS account_name;

-- Update unique constraints to use new column names
-- First drop old constraints if they exist
DO $$
BEGIN
  -- Drop old unique constraint for main_accounts if exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'main_accounts_user_id_account_handle_key'
  ) THEN
    ALTER TABLE main_accounts DROP CONSTRAINT main_accounts_user_id_account_handle_key;
  END IF;

  -- Note: spam_accounts never had account_handle column, so no old constraint to drop
  -- IF EXISTS (
  --   SELECT 1 FROM pg_constraint
  --   WHERE conname = 'spam_accounts_user_id_account_handle_key'
  -- ) THEN
  --   ALTER TABLE spam_accounts DROP CONSTRAINT spam_accounts_user_id_account_handle_key;
  -- END IF;
END $$;

-- Ensure the new unique constraints exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'main_accounts_user_id_handle_key'
  ) THEN
    ALTER TABLE main_accounts ADD CONSTRAINT main_accounts_user_id_handle_key UNIQUE (user_id, handle);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'spam_accounts_user_id_handle_key'
  ) THEN
    ALTER TABLE spam_accounts ADD CONSTRAINT spam_accounts_user_id_handle_key UNIQUE (user_id, handle);
  END IF;
END $$;

-- Add comments
COMMENT ON COLUMN main_accounts.handle IS 'Twitter handle/screen name (e.g., username without @)';
COMMENT ON COLUMN main_accounts.name IS 'Display name on Twitter';
COMMENT ON COLUMN spam_accounts.handle IS 'Twitter handle/screen name (e.g., username without @)';
COMMENT ON COLUMN spam_accounts.name IS 'Display name on Twitter';

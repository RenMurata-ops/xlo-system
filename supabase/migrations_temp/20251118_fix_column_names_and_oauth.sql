-- ============================================================================
-- Fix Column Names to Match UI Expectations and Complete OAuth Setup
-- ============================================================================

-- 1. Fix main_accounts table column names (safely)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'main_accounts' AND column_name = 'handle') THEN
    ALTER TABLE main_accounts RENAME COLUMN handle TO account_handle;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'main_accounts' AND column_name = 'name') THEN
    ALTER TABLE main_accounts RENAME COLUMN name TO account_name;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'main_accounts' AND column_name = 'followers_count') THEN
    ALTER TABLE main_accounts RENAME COLUMN followers_count TO follower_count;
  END IF;
END $$;

-- 2. Fix spam_accounts table column names (safely)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'spam_accounts' AND column_name = 'handle') THEN
    ALTER TABLE spam_accounts RENAME COLUMN handle TO account_handle;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'spam_accounts' AND column_name = 'name') THEN
    ALTER TABLE spam_accounts RENAME COLUMN name TO account_name;
  END IF;
END $$;

-- 3. Update unique constraints for main_accounts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'main_accounts' AND constraint_name = 'main_accounts_user_id_handle_key') THEN
    ALTER TABLE main_accounts DROP CONSTRAINT main_accounts_user_id_handle_key;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'main_accounts' AND constraint_name = 'main_accounts_user_id_account_handle_key') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'main_accounts' AND column_name = 'account_handle') THEN
      ALTER TABLE main_accounts ADD CONSTRAINT main_accounts_user_id_account_handle_key UNIQUE(user_id, account_handle);
    END IF;
  END IF;
END $$;

-- 4. Update unique constraints for spam_accounts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'spam_accounts' AND constraint_name = 'spam_accounts_user_id_handle_key') THEN
    ALTER TABLE spam_accounts DROP CONSTRAINT spam_accounts_user_id_handle_key;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE table_name = 'spam_accounts' AND constraint_name = 'spam_accounts_user_id_account_handle_key') THEN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'spam_accounts' AND column_name = 'account_handle') THEN
      ALTER TABLE spam_accounts ADD CONSTRAINT spam_accounts_user_id_account_handle_key UNIQUE(user_id, account_handle);
    END IF;
  END IF;
END $$;

-- 5. Ensure twitter_apps has callback_url column
ALTER TABLE twitter_apps ADD COLUMN IF NOT EXISTS callback_url TEXT;
COMMENT ON COLUMN twitter_apps.callback_url IS 'OAuth callback URL for this app';

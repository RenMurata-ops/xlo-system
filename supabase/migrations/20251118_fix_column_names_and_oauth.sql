-- ============================================================================
-- Fix Column Names to Match UI Expectations and Complete OAuth Setup
-- ============================================================================

-- 1. Fix main_accounts table column names
ALTER TABLE main_accounts RENAME COLUMN handle TO account_handle;
ALTER TABLE main_accounts RENAME COLUMN name TO account_name;
ALTER TABLE main_accounts RENAME COLUMN followers_count TO follower_count;

-- 2. Fix spam_accounts table column names
ALTER TABLE spam_accounts RENAME COLUMN handle TO account_handle;
ALTER TABLE spam_accounts RENAME COLUMN name TO account_name;

-- 3. Update unique constraints for main_accounts
ALTER TABLE main_accounts DROP CONSTRAINT IF EXISTS main_accounts_user_id_handle_key;
ALTER TABLE main_accounts ADD CONSTRAINT main_accounts_user_id_account_handle_key UNIQUE(user_id, account_handle);

-- 4. Update unique constraints for spam_accounts
ALTER TABLE spam_accounts DROP CONSTRAINT IF EXISTS spam_accounts_user_id_handle_key;
ALTER TABLE spam_accounts ADD CONSTRAINT spam_accounts_user_id_account_handle_key UNIQUE(user_id, account_handle);

-- 5. Ensure twitter_apps has callback_url column
ALTER TABLE twitter_apps ADD COLUMN IF NOT EXISTS callback_url TEXT;
COMMENT ON COLUMN twitter_apps.callback_url IS 'OAuth callback URL for this app';

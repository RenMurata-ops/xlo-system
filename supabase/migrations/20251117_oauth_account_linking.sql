-- ============================================================================
-- OAuth Account Linking Enhancement
-- Add columns to oauth_sessions to track which account is being authenticated
-- ============================================================================

-- Add account_id and account_type to oauth_sessions
ALTER TABLE oauth_sessions ADD COLUMN IF NOT EXISTS account_id UUID;
ALTER TABLE oauth_sessions ADD COLUMN IF NOT EXISTS account_type TEXT CHECK (account_type IN ('main', 'spam', 'follow'));
ALTER TABLE oauth_sessions ADD COLUMN IF NOT EXISTS twitter_app_id UUID REFERENCES twitter_apps(id) ON DELETE CASCADE;

-- Add indexes for lookups
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_account ON oauth_sessions(account_id, account_type);
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_twitter_app ON oauth_sessions(twitter_app_id);

-- Comments
COMMENT ON COLUMN oauth_sessions.account_id IS 'ID of the account being authenticated (main_accounts, spam_accounts, or follow_accounts)';
COMMENT ON COLUMN oauth_sessions.account_type IS 'Type of account: main, spam, or follow';
COMMENT ON COLUMN oauth_sessions.twitter_app_id IS 'ID of the X App being used for this OAuth flow';

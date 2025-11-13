-- Add account_type, app_id, and redirect_to columns to oauth_sessions
-- This allows OAuth flow to properly link accounts to Twitter Apps

ALTER TABLE oauth_sessions
ADD COLUMN IF NOT EXISTS account_type TEXT DEFAULT 'main' CHECK (account_type IN ('main', 'follow', 'spam'));

ALTER TABLE oauth_sessions
ADD COLUMN IF NOT EXISTS app_id UUID REFERENCES twitter_apps(id) ON DELETE CASCADE;

ALTER TABLE oauth_sessions
ADD COLUMN IF NOT EXISTS redirect_to TEXT DEFAULT '/accounts/main?connected=1';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_oauth_sessions_app_id ON oauth_sessions(app_id);

-- Add comments
COMMENT ON COLUMN oauth_sessions.account_type IS 'Type of account being connected (main, follow, spam)';
COMMENT ON COLUMN oauth_sessions.app_id IS 'Twitter App used for this OAuth flow';
COMMENT ON COLUMN oauth_sessions.redirect_to IS 'URL to redirect to after successful OAuth';

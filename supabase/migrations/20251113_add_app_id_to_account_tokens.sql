-- Add app_id column to account_tokens for Twitter App linkage
-- This links each account token to the Twitter App used for OAuth authentication

ALTER TABLE account_tokens
ADD COLUMN IF NOT EXISTS app_id UUID REFERENCES twitter_apps(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_account_tokens_app_id ON account_tokens(app_id);

-- Add comment
COMMENT ON COLUMN account_tokens.app_id IS 'Links to the Twitter App used for OAuth authentication';

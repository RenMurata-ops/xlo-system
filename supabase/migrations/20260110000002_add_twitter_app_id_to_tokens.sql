-- Add twitter_app_id to account_tokens for multi-app support
-- 複数Twitter App対応：どのAppで認証されたかを記録

-- Step 1: Add twitter_app_id column
ALTER TABLE account_tokens
ADD COLUMN twitter_app_id uuid REFERENCES twitter_apps(id) ON DELETE SET NULL;

-- Step 2: Create index for faster lookups
CREATE INDEX idx_account_tokens_twitter_app_id ON account_tokens(twitter_app_id);

-- Step 3: Migrate existing tokens
-- Try to associate existing tokens with the most recently used twitter_app
-- まず、oauth_sessionsから最新のtwitter_app_idを取得して紐付け
UPDATE account_tokens t
SET twitter_app_id = (
  SELECT o.twitter_app_id
  FROM oauth_sessions o
  WHERE o.user_id = t.user_id
    AND o.twitter_app_id IS NOT NULL
  ORDER BY o.created_at DESC
  LIMIT 1
)
WHERE t.twitter_app_id IS NULL
  AND t.token_type = 'oauth2';

-- Step 4: For tokens that still don't have a twitter_app_id,
-- use the first active twitter_app for that user
UPDATE account_tokens t
SET twitter_app_id = (
  SELECT ta.id
  FROM twitter_apps ta
  WHERE ta.user_id = t.user_id
    AND ta.is_active = true
  ORDER BY ta.created_at DESC
  LIMIT 1
)
WHERE t.twitter_app_id IS NULL
  AND t.token_type = 'oauth2';

-- Step 5: Add comment for documentation
COMMENT ON COLUMN account_tokens.twitter_app_id IS 'The Twitter App used to authenticate this token. Enables multi-app support for scaling account limits.';

-- Step 6: Verify migration
SELECT
  t.x_username,
  t.token_type,
  ta.app_name,
  ta.api_key,
  CASE WHEN t.twitter_app_id IS NOT NULL THEN 'Assigned' ELSE 'Missing' END as status
FROM account_tokens t
LEFT JOIN twitter_apps ta ON ta.id = t.twitter_app_id
WHERE t.token_type = 'oauth2'
ORDER BY t.created_at DESC
LIMIT 10;

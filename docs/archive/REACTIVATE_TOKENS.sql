-- ============================================================================
-- Reactivate all OAuth2 tokens with valid refresh tokens
-- ============================================================================

-- Check current status
SELECT
  'BEFORE' as status,
  COUNT(*) as total_tokens,
  COUNT(*) FILTER (WHERE is_active = true) as active_tokens,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_tokens,
  COUNT(*) FILTER (WHERE refresh_token IS NOT NULL) as has_refresh_token
FROM account_tokens
WHERE token_type = 'oauth2';

-- Reactivate all tokens that have refresh_token
UPDATE account_tokens
SET
  is_active = true,
  error_message = NULL,
  updated_at = NOW()
WHERE token_type = 'oauth2'
  AND refresh_token IS NOT NULL
  AND is_active = false;

-- Check after update
SELECT
  'AFTER' as status,
  COUNT(*) as total_tokens,
  COUNT(*) FILTER (WHERE is_active = true) as active_tokens,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_tokens
FROM account_tokens
WHERE token_type = 'oauth2';

-- Show tokens that will be refreshed
SELECT
  x_username,
  expires_at,
  is_active,
  refresh_count,
  CASE
    WHEN expires_at < NOW() THEN '❌ Expired'
    WHEN expires_at < NOW() + INTERVAL '1 hour' THEN '⚠️ Expiring soon'
    ELSE '✅ Valid'
  END as token_status
FROM account_tokens
WHERE token_type = 'oauth2'
  AND refresh_token IS NOT NULL
ORDER BY expires_at ASC;

-- Check Twitter Apps configuration
SELECT
  app_name,
  oauth_version,
  is_active,
  is_default,
  CASE
    WHEN client_id IS NOT NULL AND client_id != '' THEN '✅ Has client_id'
    ELSE '❌ Missing client_id'
  END as client_id_status,
  CASE
    WHEN client_secret IS NOT NULL AND client_secret != '' THEN '✅ Has client_secret'
    ELSE '❌ Missing client_secret'
  END as client_secret_status,
  LEFT(client_id, 10) || '...' as client_id_preview,
  created_at
FROM twitter_apps
WHERE is_active = true
ORDER BY is_default DESC, created_at DESC;

-- Count accounts per app
SELECT
  ta.app_name,
  COUNT(DISTINCT at.id) as token_count,
  COUNT(DISTINCT at.user_id) as user_count
FROM twitter_apps ta
LEFT JOIN account_tokens at ON at.user_id = ta.user_id
WHERE ta.is_active = true
GROUP BY ta.app_name;

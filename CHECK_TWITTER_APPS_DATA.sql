-- X Appsが本当に消えたか確認
SELECT
  app_name,
  is_active,
  created_at,
  updated_at
FROM twitter_apps
ORDER BY created_at DESC;

-- 削除されたレコードがあるか確認（論理削除の場合）
SELECT COUNT(*) as total_apps FROM twitter_apps;
SELECT COUNT(*) as active_apps FROM twitter_apps WHERE is_active = true;
SELECT COUNT(*) as inactive_apps FROM twitter_apps WHERE is_active = false;

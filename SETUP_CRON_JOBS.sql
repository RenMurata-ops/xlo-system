-- ============================================================================
-- XLO System - Cron Jobs Setup (自動実行タスク設定)
-- ============================================================================
-- 実行方法:
-- 1. Supabase Dashboard → SQL Editor を開く
-- 2. このファイルの内容を全てコピー&ペースト
-- 3. 「Run」ボタンをクリック
-- ============================================================================

-- 必要な拡張機能を有効化
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 既存のジョブを削除（再実行時のため）
DO $$
BEGIN
  PERFORM cron.unschedule('refresh-tokens-hourly');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('execute-scheduled-posts');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('sync-follower-counts-daily');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- ジョブ 1: トークン自動更新（毎時0分）
-- ============================================================================
SELECT cron.schedule(
  'refresh-tokens-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/refresh-tokens',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjczMjg2NiwiZXhwIjoyMDc4MzA4ODY2fQ.mxLpbEnuIcErBwypW8fZtufWsyDPlYII0gnnZWY3THo',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================================
-- ジョブ 2: スケジュール投稿実行（5分ごと）
-- ============================================================================
SELECT cron.schedule(
  'execute-scheduled-posts',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/execute-scheduled-posts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjczMjg2NiwiZXhwIjoyMDc4MzA4ODY2fQ.mxLpbEnuIcErBwypW8fZtufWsyDPlYII0gnnZWY3THo',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================================
-- ジョブ 3: フォロワー数同期（毎日0時）
-- ============================================================================
SELECT cron.schedule(
  'sync-follower-counts-daily',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := 'https://swyiwqzlmozlqircyyzr.supabase.co/functions/v1/sync-follower-counts',
    headers := jsonb_build_object(
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3eWl3cXpsbW96bHFpcmN5eXpyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MjczMjg2NiwiZXhwIjoyMDc4MzA4ODY2fQ.mxLpbEnuIcErBwypW8fZtufWsyDPlYII0gnnZWY3THo',
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- ============================================================================
-- 確認: 設定されたジョブを表示
-- ============================================================================
SELECT
  jobid,
  jobname,
  schedule,
  active
FROM cron.job
WHERE jobname IN (
  'refresh-tokens-hourly',
  'execute-scheduled-posts',
  'sync-follower-counts-daily'
)
ORDER BY jobname;

-- ============================================================================
-- 期待される結果:
-- 3つのジョブが active = true で表示されればOK
--
-- 例:
-- jobid | jobname                        | schedule      | active
-- ------|--------------------------------|---------------|--------
-- 1     | execute-scheduled-posts        | */5 * * * *   | t
-- 2     | refresh-tokens-hourly          | 0 * * * *     | t
-- 3     | sync-follower-counts-daily     | 0 0 * * *     | t
-- ============================================================================

-- ============================================================================
-- XLO System - Hardening Deployment (Dashboard用)
-- 既存テーブルがある場合でも安全に実行可能
-- ============================================================================

-- 1. posts.text_hash 追加（重複防止）
ALTER TABLE posts ADD COLUMN IF NOT EXISTS text_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_posts_text_hash_created_at ON posts(text_hash, created_at DESC);

-- 2. posts.error_json 追加（エラー追跡）
ALTER TABLE posts ADD COLUMN IF NOT EXISTS error_json JSONB;
CREATE INDEX IF NOT EXISTS idx_posts_error_json ON posts USING GIN(error_json) WHERE error_json IS NOT NULL;

-- 3. 重複防止トリガー
CREATE OR REPLACE FUNCTION prevent_duplicate_posts_24h()
RETURNS TRIGGER AS $$
BEGIN
  NEW.text_hash := COALESCE(NEW.text_hash, encode(digest(NEW.content, 'sha256'), 'hex'));
  IF EXISTS (
    SELECT 1 FROM posts
    WHERE text_hash = NEW.text_hash
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND user_id = NEW.user_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Duplicate post within 24h blocked: %', NEW.content
      USING ERRCODE = 'unique_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_posts_24h ON posts;
CREATE TRIGGER trg_prevent_duplicate_posts_24h
  BEFORE INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_posts_24h();

-- 4. loops.locked_until 追加（二重実行防止）
ALTER TABLE loops ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_loops_locked_until ON loops(locked_until);

-- 5. ループロック関数
CREATE OR REPLACE FUNCTION acquire_loop_lock(
  p_loop_id UUID,
  p_lock_duration_minutes INTEGER DEFAULT 5
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE loops
  SET locked_until = NOW() + (p_lock_duration_minutes || ' minutes')::INTERVAL
  WHERE id = p_loop_id
    AND (locked_until IS NULL OR locked_until < NOW());
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION release_loop_lock(p_loop_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE loops SET locked_until = NULL WHERE id = p_loop_id;
END;
$$ LANGUAGE plpgsql;

-- 6. loop_executions.trace_id 追加（トレース）
ALTER TABLE loop_executions ADD COLUMN IF NOT EXISTS trace_id UUID DEFAULT gen_random_uuid();
CREATE INDEX IF NOT EXISTS idx_loop_executions_trace_id ON loop_executions(trace_id);

-- 7. rate_limitsテーブル確認・作成（存在しない場合）
CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  token_type TEXT NOT NULL CHECK (token_type IN ('oauth1a', 'oauth2')),
  limit_total INTEGER NOT NULL DEFAULT 0,
  remaining INTEGER NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL,
  used_requests INTEGER DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint, token_type, window_started_at)
);

-- 8. rate_limits.warning_threshold 追加（警告閾値）
ALTER TABLE rate_limits ADD COLUMN IF NOT EXISTS warning_threshold NUMERIC DEFAULT 0.2;

-- 9. rate_limits.is_warning 追加（計算カラム）
-- 既存カラムがある場合はスキップ
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rate_limits' AND column_name = 'is_warning'
  ) THEN
    ALTER TABLE rate_limits
      ADD COLUMN is_warning BOOLEAN GENERATED ALWAYS AS (
        CASE
          WHEN limit_total > 0 AND remaining::numeric / limit_total < warning_threshold
          THEN true
          ELSE false
        END
      ) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rate_limits_is_warning ON rate_limits(is_warning) WHERE is_warning = true;

-- 10. bulk_post_queueテーブル確認・作成
CREATE TABLE IF NOT EXISTS bulk_post_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID REFERENCES post_templates(id) ON DELETE SET NULL,
  cta_template_id UUID REFERENCES cta_templates(id) ON DELETE SET NULL,
  target_account_id UUID,
  target_x_user_id TEXT,
  use_template_items BOOLEAN DEFAULT true,
  use_cta BOOLEAN DEFAULT false,
  generated_content TEXT,
  tweet_id TEXT,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('pending', 'processing', 'success', 'failed')) DEFAULT 'pending',
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT,
  error_json JSONB,
  tags TEXT[],
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bulk_post_queue_status ON bulk_post_queue(status, priority DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_bulk_post_queue_user_status ON bulk_post_queue(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bulk_post_queue_next_retry ON bulk_post_queue(next_retry_at) WHERE status = 'failed';

-- 11. bulk_post_queue用の関数
CREATE OR REPLACE FUNCTION get_pending_bulk_posts(
  p_user_id UUID,
  p_batch_size INTEGER DEFAULT 10
)
RETURNS SETOF bulk_post_queue AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM bulk_post_queue
  WHERE user_id = p_user_id
    AND status = 'pending'
  ORDER BY priority DESC, created_at ASC
  LIMIT p_batch_size
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

-- 12. メンテナンス関数
CREATE OR REPLACE FUNCTION cleanup_stale_loop_locks()
RETURNS INTEGER AS $$
DECLARE
  v_cleaned INTEGER;
BEGIN
  UPDATE loops
  SET locked_until = NULL
  WHERE locked_until < NOW() - INTERVAL '10 minutes';
  GET DIAGNOSTICS v_cleaned = ROW_COUNT;
  RETURN v_cleaned;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reset_failed_bulk_posts(
  p_user_id UUID DEFAULT NULL,
  p_hours_ago INTEGER DEFAULT 24
)
RETURNS INTEGER AS $$
DECLARE
  v_reset INTEGER;
BEGIN
  UPDATE bulk_post_queue
  SET status = 'pending', retry_count = 0, next_retry_at = NULL, error_message = NULL, error_json = NULL
  WHERE status = 'failed'
    AND created_at >= NOW() - (p_hours_ago || ' hours')::INTERVAL
    AND (p_user_id IS NULL OR user_id = p_user_id);
  GET DIAGNOSTICS v_reset = ROW_COUNT;
  RETURN v_reset;
END;
$$ LANGUAGE plpgsql;

-- 13. ビュー作成
CREATE OR REPLACE VIEW v_active_loop_locks AS
SELECT
  id,
  loop_name,
  locked_until,
  (locked_until - NOW()) as time_remaining
FROM loops
WHERE locked_until IS NOT NULL AND locked_until > NOW()
ORDER BY locked_until ASC;

CREATE OR REPLACE VIEW v_rate_limit_warnings AS
SELECT
  endpoint,
  token_type,
  remaining,
  limit_total,
  (remaining::numeric / NULLIF(limit_total, 0) * 100)::numeric(5,2) as remaining_percent,
  reset_at,
  updated_at
FROM rate_limits
WHERE is_warning = true
ORDER BY remaining_percent ASC;

CREATE OR REPLACE VIEW v_recent_duplicate_attempts AS
SELECT
  created_at,
  user_id,
  text_hash,
  content,
  error_message
FROM posts
WHERE error_json::text LIKE '%Duplicate post within 24h%'
ORDER BY created_at DESC
LIMIT 50;

-- 完了
SELECT 'Hardening migration applied successfully!' as status;

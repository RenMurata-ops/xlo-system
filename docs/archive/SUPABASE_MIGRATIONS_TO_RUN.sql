-- ============================================================================
-- XLO System - Manual Migrations to Execute
-- Date: 2025-12-17
--
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard: https://supabase.com/dashboard/project/swyiwqzlmozlqircyyzr
-- 2. Go to: SQL Editor
-- 3. Copy and paste this entire file
-- 4. Click "Run" button
-- ============================================================================

-- ============================================================================
-- Migration 1: Add in_reply_to_tweet_id column to posts table
-- Purpose: Enable reply loops to track which tweet is being replied to
-- ============================================================================

-- Add missing column
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS in_reply_to_tweet_id TEXT;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_posts_in_reply_to_tweet_id
ON posts(in_reply_to_tweet_id)
WHERE in_reply_to_tweet_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN posts.in_reply_to_tweet_id IS 'Twitter/X tweet ID that this post is replying to (for reply loops)';

-- ============================================================================
-- Migration 2: Fix duplicate post prevention to include account_id
-- Purpose: Allow same content to be posted from different accounts
-- ============================================================================

CREATE OR REPLACE FUNCTION prevent_duplicate_posts_24h()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate text_hash if not provided
  NEW.text_hash := COALESCE(NEW.text_hash, encode(digest(NEW.content, 'sha256'), 'hex'));

  -- Check for duplicates within 24 hours (same user + same account + same content)
  IF EXISTS (
    SELECT 1 FROM posts
    WHERE text_hash = NEW.text_hash
      AND created_at >= NOW() - INTERVAL '24 hours'
      AND user_id = NEW.user_id
      AND account_id = NEW.account_id  -- ✅ Added: Check same account
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RAISE EXCEPTION 'Duplicate post within 24h blocked: %', NEW.content
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prevent_duplicate_posts_24h() IS 'Prevents duplicate posts within 24 hours based on text_hash, user_id, and account_id';

-- ============================================================================
-- Verification Queries (Optional - Run after migrations)
-- ============================================================================

-- Verify in_reply_to_tweet_id column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'posts'
  AND column_name = 'in_reply_to_tweet_id';

-- Verify index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'posts'
  AND indexname = 'idx_posts_in_reply_to_tweet_id';

-- Verify function was updated
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_name = 'prevent_duplicate_posts_24h';

-- ============================================================================
-- Expected Results:
-- 1. Column 'in_reply_to_tweet_id' should be created in posts table
-- 2. Index 'idx_posts_in_reply_to_tweet_id' should exist
-- 3. Function 'prevent_duplicate_posts_24h' should include account_id check
-- ============================================================================

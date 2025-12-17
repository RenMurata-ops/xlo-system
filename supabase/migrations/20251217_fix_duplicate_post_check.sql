-- Fix duplicate post prevention to include account_id
-- This allows the same content to be posted from different accounts
-- which is a valid use case for managing multiple accounts

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

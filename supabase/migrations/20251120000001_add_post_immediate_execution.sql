-- Add 'processing' status to posts table and twitter_id column for immediate post execution
-- This allows posts to be executed immediately from the UI

-- Add twitter_id column if it doesn't exist
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS twitter_id TEXT;

-- Update the status CHECK constraint to include 'processing'
ALTER TABLE posts
DROP CONSTRAINT IF EXISTS posts_status_check;

ALTER TABLE posts
ADD CONSTRAINT posts_status_check
CHECK (status IN ('draft', 'scheduled', 'posted', 'failed', 'processing'));

-- Create index on twitter_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_posts_twitter_id ON posts(twitter_id);

-- Add comment for documentation
COMMENT ON COLUMN posts.twitter_id IS 'Twitter/X post ID returned from API after successful posting';
COMMENT ON COLUMN posts.status IS 'Post status: draft, scheduled, posted, failed, or processing';

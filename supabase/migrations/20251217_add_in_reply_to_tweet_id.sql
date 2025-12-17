-- Add missing in_reply_to_tweet_id column to posts table
-- This column is used by reply loops to track which tweet is being replied to

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS in_reply_to_tweet_id TEXT;

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_posts_in_reply_to_tweet_id
ON posts(in_reply_to_tweet_id)
WHERE in_reply_to_tweet_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN posts.in_reply_to_tweet_id IS 'Twitter/X tweet ID that this post is replying to (for reply loops)';

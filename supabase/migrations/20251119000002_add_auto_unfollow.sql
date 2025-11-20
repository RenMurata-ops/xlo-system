-- Table to track follow relationships for auto-unfollow
CREATE TABLE IF NOT EXISTS follow_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  follower_account_id UUID NOT NULL, -- The account that performed the follow
  target_twitter_id TEXT NOT NULL, -- Twitter ID of the followed account
  target_handle TEXT, -- Twitter handle of the followed account
  followed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  unfollow_at TIMESTAMP WITH TIME ZONE NOT NULL, -- When to auto-unfollow
  unfollowed_at TIMESTAMP WITH TIME ZONE, -- When actually unfollowed
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Index for efficient querying of pending unfollows
CREATE INDEX idx_follow_relationships_pending ON follow_relationships (unfollow_at)
WHERE status = 'pending';

CREATE INDEX idx_follow_relationships_user ON follow_relationships (user_id);

-- RLS policies
ALTER TABLE follow_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own follow relationships"
ON follow_relationships FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own follow relationships"
ON follow_relationships FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own follow relationships"
ON follow_relationships FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own follow relationships"
ON follow_relationships FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Add unfollow_delay_weeks to engagement settings
ALTER TABLE auto_engagement_rules
ADD COLUMN IF NOT EXISTS auto_unfollow_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS unfollow_delay_weeks INTEGER DEFAULT 2 CHECK (unfollow_delay_weeks >= 1 AND unfollow_delay_weeks <= 12);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_follow_relationships_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_follow_relationships_timestamp
BEFORE UPDATE ON follow_relationships
FOR EACH ROW
EXECUTE FUNCTION update_follow_relationships_updated_at();

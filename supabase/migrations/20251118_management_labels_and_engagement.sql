-- ============================================================================
-- Management Labels and Enhanced Engagement Features
-- ============================================================================

-- 1. Management Labels (Notion-style selectable labels)
-- ============================================================================
CREATE TABLE IF NOT EXISTS management_labels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6', -- Default blue color
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Enable RLS
ALTER TABLE management_labels ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own management labels"
  ON management_labels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own management labels"
  ON management_labels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own management labels"
  ON management_labels FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own management labels"
  ON management_labels FOR DELETE
  USING (auth.uid() = user_id);

-- Index for label lookups
CREATE INDEX IF NOT EXISTS idx_management_labels_user ON management_labels(user_id);

-- 2. Add management_label_id to account tables
-- ============================================================================
ALTER TABLE main_accounts ADD COLUMN IF NOT EXISTS management_label_id UUID REFERENCES management_labels(id) ON DELETE SET NULL;
ALTER TABLE spam_accounts ADD COLUMN IF NOT EXISTS management_label_id UUID REFERENCES management_labels(id) ON DELETE SET NULL;
ALTER TABLE follow_accounts ADD COLUMN IF NOT EXISTS management_label_id UUID REFERENCES management_labels(id) ON DELETE SET NULL;

-- Indexes for label lookups on accounts
CREATE INDEX IF NOT EXISTS idx_main_accounts_label ON main_accounts(management_label_id);
CREATE INDEX IF NOT EXISTS idx_spam_accounts_label ON spam_accounts(management_label_id);
CREATE INDEX IF NOT EXISTS idx_follow_accounts_label ON follow_accounts(management_label_id);

-- 3. Enhanced Engagement Settings with Follower Filter
-- ============================================================================
ALTER TABLE engagement_settings ADD COLUMN IF NOT EXISTS max_target_follower_count INTEGER;
ALTER TABLE engagement_settings ADD COLUMN IF NOT EXISTS min_target_follower_count INTEGER;

COMMENT ON COLUMN engagement_settings.max_target_follower_count IS 'Maximum follower count for target accounts (e.g., only target accounts with <= X followers)';
COMMENT ON COLUMN engagement_settings.min_target_follower_count IS 'Minimum follower count for target accounts';

-- 4. Targeted URL Engagement Feature (Separate from Auto Engagement)
-- ============================================================================
CREATE TABLE IF NOT EXISTS targeted_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Target configuration
  target_url TEXT NOT NULL, -- X post URL to target
  target_tweet_id TEXT, -- Extracted tweet ID

  -- Engagement actions to perform
  enable_like BOOLEAN DEFAULT false,
  enable_retweet BOOLEAN DEFAULT false,
  enable_reply BOOLEAN DEFAULT false,
  enable_quote BOOLEAN DEFAULT false,
  enable_follow BOOLEAN DEFAULT false, -- Follow the author

  -- Reply/Quote content
  reply_template TEXT,
  quote_template TEXT,

  -- Account selection
  account_type TEXT NOT NULL CHECK (account_type IN ('follow', 'spam')),
  selected_account_ids UUID[], -- Specific accounts to use
  use_all_accounts BOOLEAN DEFAULT false, -- Use all accounts of the type

  -- Rate limiting
  max_actions_per_hour INTEGER DEFAULT 10,
  max_total_actions INTEGER DEFAULT 100,
  delay_between_actions_ms INTEGER DEFAULT 5000,

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed')),
  actions_completed INTEGER DEFAULT 0,
  last_action_at TIMESTAMPTZ,
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE targeted_engagements ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own targeted engagements"
  ON targeted_engagements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own targeted engagements"
  ON targeted_engagements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own targeted engagements"
  ON targeted_engagements FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own targeted engagements"
  ON targeted_engagements FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_targeted_engagements_user ON targeted_engagements(user_id);
CREATE INDEX IF NOT EXISTS idx_targeted_engagements_status ON targeted_engagements(status);
CREATE INDEX IF NOT EXISTS idx_targeted_engagements_account_type ON targeted_engagements(account_type);

-- 5. Targeted Engagement Action Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS targeted_engagement_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  targeted_engagement_id UUID NOT NULL REFERENCES targeted_engagements(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  account_type TEXT NOT NULL,

  -- Action details
  action_type TEXT NOT NULL CHECK (action_type IN ('like', 'retweet', 'reply', 'quote', 'follow')),
  success BOOLEAN NOT NULL,
  error_message TEXT,

  -- Twitter response
  twitter_response JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE targeted_engagement_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies (join through parent)
CREATE POLICY "Users can view own targeted engagement actions"
  ON targeted_engagement_actions FOR SELECT
  USING (
    targeted_engagement_id IN (
      SELECT id FROM targeted_engagements WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create own targeted engagement actions"
  ON targeted_engagement_actions FOR INSERT
  WITH CHECK (
    targeted_engagement_id IN (
      SELECT id FROM targeted_engagements WHERE user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_targeted_actions_engagement ON targeted_engagement_actions(targeted_engagement_id);
CREATE INDEX IF NOT EXISTS idx_targeted_actions_account ON targeted_engagement_actions(account_id, account_type);

-- 6. Comments
-- ============================================================================
COMMENT ON TABLE management_labels IS 'User-defined labels for organizing accounts by project (e.g., 物販, 副業)';
COMMENT ON TABLE targeted_engagements IS 'Targeted engagement campaigns for specific X post URLs';
COMMENT ON TABLE targeted_engagement_actions IS 'Log of individual actions performed for targeted engagements';

-- Add Row Level Security Policies for all tables
-- This ensures users can only access their own data

-- ============================================================================
-- Profiles
-- ============================================================================
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Twitter Apps
-- ============================================================================
CREATE POLICY "Users can view own Twitter apps"
  ON twitter_apps FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Twitter apps"
  ON twitter_apps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Twitter apps"
  ON twitter_apps FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own Twitter apps"
  ON twitter_apps FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Account Tokens
-- ============================================================================
CREATE POLICY "Users can view own account tokens"
  ON account_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own account tokens"
  ON account_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own account tokens"
  ON account_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own account tokens"
  ON account_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Main Accounts
-- ============================================================================
CREATE POLICY "Users can view own main accounts"
  ON main_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own main accounts"
  ON main_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own main accounts"
  ON main_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own main accounts"
  ON main_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Follow Accounts
-- ============================================================================
CREATE POLICY "Users can view own follow accounts"
  ON follow_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own follow accounts"
  ON follow_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own follow accounts"
  ON follow_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own follow accounts"
  ON follow_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Spam Accounts
-- ============================================================================
CREATE POLICY "Users can view own spam accounts"
  ON spam_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own spam accounts"
  ON spam_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own spam accounts"
  ON spam_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own spam accounts"
  ON spam_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Posts
-- ============================================================================
CREATE POLICY "Users can view own posts"
  ON posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own posts"
  ON posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Loops
-- ============================================================================
CREATE POLICY "Users can view own loops"
  ON loops FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own loops"
  ON loops FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own loops"
  ON loops FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own loops"
  ON loops FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Loop Executions
-- ============================================================================
CREATE POLICY "Users can view own loop executions"
  ON loop_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own loop executions"
  ON loop_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Auto Engagement Rules
-- ============================================================================
CREATE POLICY "Users can view own engagement rules"
  ON auto_engagement_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own engagement rules"
  ON auto_engagement_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own engagement rules"
  ON auto_engagement_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own engagement rules"
  ON auto_engagement_rules FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Auto Engagement Executions
-- ============================================================================
CREATE POLICY "Users can view own engagement executions"
  ON auto_engagement_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own engagement executions"
  ON auto_engagement_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Templates (Post, CTA)
-- ============================================================================
CREATE POLICY "Users can view own post templates"
  ON post_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own post templates"
  ON post_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own post templates"
  ON post_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own post templates"
  ON post_templates FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own post template items"
  ON post_template_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own post template items"
  ON post_template_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own post template items"
  ON post_template_items FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own post template items"
  ON post_template_items FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own cta templates"
  ON cta_templates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cta templates"
  ON cta_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cta templates"
  ON cta_templates FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cta templates"
  ON cta_templates FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Proxies
-- ============================================================================
CREATE POLICY "Users can view own proxies"
  ON proxies FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own proxies"
  ON proxies FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own proxies"
  ON proxies FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own proxies"
  ON proxies FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Notifications
-- ============================================================================
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- OAuth Sessions
-- ============================================================================
CREATE POLICY "Users can view own oauth sessions"
  ON oauth_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own oauth sessions"
  ON oauth_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own oauth sessions"
  ON oauth_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own oauth sessions"
  ON oauth_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Rate Limits
-- ============================================================================
CREATE POLICY "Users can view own rate limits"
  ON rate_limits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rate limits"
  ON rate_limits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rate limits"
  ON rate_limits FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Bulk Post Queue
-- ============================================================================
CREATE POLICY "Users can view own bulk post queue"
  ON bulk_post_queue FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bulk post queue"
  ON bulk_post_queue FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bulk post queue"
  ON bulk_post_queue FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own bulk post queue"
  ON bulk_post_queue FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Follow History
-- ============================================================================
CREATE POLICY "Users can view own follow history"
  ON follow_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own follow history"
  ON follow_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own follow history"
  ON follow_history FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- Blacklist
-- ============================================================================
CREATE POLICY "Users can view own blacklist"
  ON blacklist FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own blacklist"
  ON blacklist FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own blacklist"
  ON blacklist FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own blacklist"
  ON blacklist FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- NordVPN Accounts (if table exists)
-- ============================================================================
CREATE POLICY "Users can view own nordvpn accounts"
  ON nordvpn_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own nordvpn accounts"
  ON nordvpn_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own nordvpn accounts"
  ON nordvpn_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own nordvpn accounts"
  ON nordvpn_accounts FOR DELETE
  USING (auth.uid() = user_id);

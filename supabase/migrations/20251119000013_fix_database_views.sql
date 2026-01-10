-- XLO System - Fix Database Views
-- Created: 2026-01-09
-- Purpose: Fix column name mismatches in database views after schema changes

-- ============================================================================
-- 1. Fix v_account_overview - column name mismatch
-- ============================================================================

DROP VIEW IF EXISTS v_account_overview;

CREATE VIEW v_account_overview AS
-- Main accounts
SELECT
  ma.id,
  ma.user_id,
  'main' as account_type,
  ma.handle,
  ma.name,
  ma.followers_count as follower_count,
  ma.following_count,
  at.access_token IS NOT NULL as is_connected,
  at.expires_at,
  at.is_active as token_is_active,
  ma.created_at,
  ma.updated_at
FROM main_accounts ma
LEFT JOIN account_tokens at ON at.account_id = ma.id AND at.account_type = 'main'

UNION ALL

-- Follow accounts
SELECT
  fa.id,
  fa.user_id,
  'follow' as account_type,
  fa.target_handle as handle,  -- Fixed: follow_accounts uses target_handle
  fa.target_name as name,      -- Fixed: follow_accounts uses target_name
  fa.followers_count as follower_count,  -- Fixed: follow_accounts uses followers_count
  NULL::INTEGER as following_count,
  false as is_connected,       -- Follow accounts don't have tokens
  NULL::timestamptz as expires_at,
  false as token_is_active,
  fa.created_at,
  fa.updated_at
FROM follow_accounts fa

UNION ALL

-- Spam accounts
SELECT
  sa.id,
  sa.user_id,
  'spam' as account_type,
  sa.handle,           -- Fixed: was account_handle
  sa.name,             -- Fixed: was account_name
  NULL::INTEGER as follower_count,
  NULL::INTEGER as following_count,
  at.access_token IS NOT NULL as is_connected,
  at.expires_at,
  at.is_active as token_is_active,
  sa.created_at,
  sa.updated_at
FROM spam_accounts sa
LEFT JOIN account_tokens at ON at.account_id = sa.id AND at.account_type = 'spam';

-- ============================================================================
-- 2. Drop v_post_performance - references non-existent columns
-- ============================================================================

-- The posts table only has engagement_count, not individual metrics
-- This view will be dropped and can be recreated later if needed
DROP VIEW IF EXISTS v_post_performance;

-- If you want a simplified version:
-- CREATE VIEW v_post_performance AS
-- SELECT
--   p.id,
--   p.user_id,
--   p.content,
--   p.status,
--   p.posted_at,
--   p.engagement_count,
--   p.created_at,
--   p.updated_at,
--   ma.handle as account_handle
-- FROM posts p
-- LEFT JOIN main_accounts ma ON ma.id = p.account_id
-- WHERE p.status = 'posted';

-- ============================================================================
-- 3. Fix v_dashboard_summary - references non-existent tables
-- ============================================================================

DROP VIEW IF EXISTS v_dashboard_summary;

CREATE VIEW v_dashboard_summary AS
SELECT
  u.id as user_id,
  -- Scheduled posts count
  (SELECT COUNT(*) FROM posts WHERE user_id = u.id AND status = 'scheduled') as scheduled_posts,
  -- Active tokens count
  (SELECT COUNT(*) FROM account_tokens WHERE user_id = u.id AND is_active = true) as active_accounts,
  -- Active loops count
  (SELECT COUNT(*) FROM loops WHERE user_id = u.id AND is_active = true) as active_loops,
  -- Posted count (last 30 days)
  (SELECT COUNT(*) FROM posts WHERE user_id = u.id AND status = 'posted' AND posted_at > NOW() - INTERVAL '30 days') as recent_posts,
  -- Active engagement rules
  (SELECT COUNT(*) FROM auto_engagement_rules WHERE user_id = u.id AND is_active = true) as active_engagement_rules
FROM auth.users u;

-- ============================================================================
-- 4. Drop v_rule_performance - incompatible with new schema
-- ============================================================================

-- The new auto_engagement_rules schema uses executor_account_ids (array) instead of main_account_id
-- This view would need significant restructuring to work with the new schema
DROP VIEW IF EXISTS v_rule_performance;

-- ============================================================================
-- 5. Comments
-- ============================================================================

COMMENT ON VIEW v_account_overview IS 'Unified view of all account types with connection status';
COMMENT ON VIEW v_dashboard_summary IS 'Dashboard summary statistics per user';

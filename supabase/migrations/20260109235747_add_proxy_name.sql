-- XLO System - Add proxy_name Column
-- Created: 2026-01-09
-- Purpose: Add proxy_name column to proxies table for better UX

-- ============================================================================
-- 1. Add proxy_name column
-- ============================================================================

ALTER TABLE proxies ADD COLUMN IF NOT EXISTS proxy_name TEXT;

-- ============================================================================
-- 2. Populate existing records with proxy_url as default name
-- ============================================================================

UPDATE proxies
SET proxy_name = proxy_url
WHERE proxy_name IS NULL;

-- ============================================================================
-- 3. Add comment
-- ============================================================================

COMMENT ON COLUMN proxies.proxy_name IS 'User-friendly name for the proxy';

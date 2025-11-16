-- XLO System - Bulk Post Queue Table
-- Created: 2025-11-12
-- Purpose: Add bulk_post_queue table for Stage3 implementation

-- ============================================================================
-- bulk_post_queue - 一括投稿キュー
-- ============================================================================
CREATE TABLE bulk_post_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Template Reference
  template_id UUID REFERENCES post_templates(id) ON DELETE SET NULL,

  -- Content Configuration
  use_template_items BOOLEAN DEFAULT true,
  use_cta BOOLEAN DEFAULT false,
  cta_template_id UUID REFERENCES cta_templates(id) ON DELETE SET NULL,

  -- Generated Content (after generation)
  generated_content TEXT,

  -- Execution Target
  target_account_id UUID,
  target_x_user_id TEXT,

  -- Status Management
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed')),

  -- Scheduling
  scheduled_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,

  -- Error Handling
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  error_message TEXT,
  error_json JSONB,

  -- Twitter Response
  tweet_id TEXT,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,

  -- Metadata
  tags TEXT[] DEFAULT '{}',
  priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bulk_post_queue_user_id ON bulk_post_queue(user_id);
CREATE INDEX idx_bulk_post_queue_status ON bulk_post_queue(status);
CREATE INDEX idx_bulk_post_queue_scheduled_at ON bulk_post_queue(scheduled_at);
CREATE INDEX idx_bulk_post_queue_next_retry_at ON bulk_post_queue(next_retry_at);
CREATE INDEX idx_bulk_post_queue_template_id ON bulk_post_queue(template_id);
CREATE INDEX idx_bulk_post_queue_priority ON bulk_post_queue(priority DESC);

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE bulk_post_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own bulk post queue"
  ON bulk_post_queue FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- Updated_at Trigger
-- ============================================================================

CREATE TRIGGER update_bulk_post_queue_updated_at BEFORE UPDATE ON bulk_post_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Helper Function: Get next pending posts with lock
-- ============================================================================

CREATE OR REPLACE FUNCTION get_pending_bulk_posts(
  p_user_id UUID,
  p_batch_size INTEGER DEFAULT 10
)
RETURNS SETOF bulk_post_queue AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM bulk_post_queue
  WHERE user_id = p_user_id
    AND status = 'pending'
    AND (scheduled_at IS NULL OR scheduled_at <= NOW())
    AND (next_retry_at IS NULL OR next_retry_at <= NOW())
  ORDER BY priority DESC, created_at ASC
  LIMIT p_batch_size
  FOR UPDATE SKIP LOCKED;
END;
$$ LANGUAGE plpgsql;

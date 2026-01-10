-- XLO System - Templates Table
-- Created: 2025-11-17
-- Purpose: Formalize templates table for post/reply/CTA templates

-- ============================================================================
-- templates - General purpose templates (post, reply, CTA)
-- ============================================================================
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('post', 'reply', 'cta')),
  content TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, template_name)
);

CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_template_type ON templates(template_type);
CREATE INDEX IF NOT EXISTS idx_templates_is_active ON templates(is_active);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON templates USING GIN(tags);

-- ============================================================================
-- Row Level Security
-- ============================================================================
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own templates
DROP POLICY IF EXISTS templates_user_policy ON templates;
CREATE POLICY templates_user_policy
  ON templates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Triggers
-- ============================================================================

-- Auto-update updated_at timestamp
DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE templates IS 'General purpose templates for posts, replies, and CTAs';
COMMENT ON COLUMN templates.template_type IS 'Type of template: post, reply, or cta';
COMMENT ON COLUMN templates.variables IS 'Variables used in template content (e.g., {{user_name}})';
COMMENT ON COLUMN templates.usage_count IS 'Number of times this template has been used';

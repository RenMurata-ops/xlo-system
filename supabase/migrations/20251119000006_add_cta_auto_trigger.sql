-- CTA Auto-trigger configuration table
CREATE TABLE IF NOT EXISTS cta_triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,

  -- Target: which main account posts to monitor
  target_account_id UUID NOT NULL,

  -- Responder: which account sends the CTA reply
  responder_account_id UUID NOT NULL,

  -- CTA template to use
  cta_template_id UUID NOT NULL REFERENCES post_templates(id) ON DELETE CASCADE,

  -- Delay settings (in minutes)
  min_delay_minutes INTEGER DEFAULT 1 CHECK (min_delay_minutes >= 0),
  max_delay_minutes INTEGER DEFAULT 5 CHECK (max_delay_minutes >= 1),

  -- Last checked post ID to avoid duplicate triggers
  last_checked_post_id TEXT,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cta_triggers_user ON cta_triggers(user_id);
CREATE INDEX idx_cta_triggers_active ON cta_triggers(is_active) WHERE is_active = true;

ALTER TABLE cta_triggers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own CTA triggers"
ON cta_triggers FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- CTA execution log
CREATE TABLE IF NOT EXISTS cta_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID NOT NULL REFERENCES cta_triggers(id) ON DELETE CASCADE,
  target_tweet_id TEXT NOT NULL,
  reply_tweet_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'sent', 'failed')),
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cta_executions_trigger ON cta_executions(trigger_id);
CREATE INDEX idx_cta_executions_status ON cta_executions(status);
CREATE INDEX idx_cta_executions_scheduled ON cta_executions(scheduled_at) WHERE status = 'scheduled';

ALTER TABLE cta_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own CTA executions"
ON cta_executions FOR SELECT
TO authenticated
USING (
  trigger_id IN (SELECT id FROM cta_triggers WHERE user_id = auth.uid())
);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_cta_triggers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cta_triggers_timestamp
BEFORE UPDATE ON cta_triggers
FOR EACH ROW
EXECUTE FUNCTION update_cta_triggers_updated_at();

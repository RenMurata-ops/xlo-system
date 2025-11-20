-- Create settings table for proxy auto-assignment configuration
CREATE TABLE IF NOT EXISTS proxy_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_assign_enabled BOOLEAN DEFAULT true,
  assignment_strategy TEXT DEFAULT 'round_robin' CHECK (assignment_strategy IN ('round_robin', 'random', 'least_used')),
  exclude_main_accounts BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE proxy_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own proxy settings"
ON proxy_settings FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Function to auto-assign proxy to new spam accounts
CREATE OR REPLACE FUNCTION auto_assign_proxy_to_spam_account()
RETURNS TRIGGER AS $$
DECLARE
  proxy_id UUID;
  settings RECORD;
BEGIN
  -- Get user's proxy settings
  SELECT * INTO settings FROM proxy_settings WHERE user_id = NEW.user_id;

  -- If no settings or auto-assign disabled, skip
  IF settings IS NULL OR NOT settings.auto_assign_enabled THEN
    RETURN NEW;
  END IF;

  -- Get an available proxy based on strategy
  IF settings.assignment_strategy = 'round_robin' THEN
    SELECT p.id INTO proxy_id
    FROM proxies p
    WHERE p.user_id = NEW.user_id
      AND p.is_active = true
    ORDER BY p.last_used_at NULLS FIRST, p.created_at
    LIMIT 1;
  ELSIF settings.assignment_strategy = 'random' THEN
    SELECT p.id INTO proxy_id
    FROM proxies p
    WHERE p.user_id = NEW.user_id
      AND p.is_active = true
    ORDER BY random()
    LIMIT 1;
  ELSE -- least_used
    SELECT p.id INTO proxy_id
    FROM proxies p
    LEFT JOIN spam_accounts sa ON sa.proxy_id = p.id
    WHERE p.user_id = NEW.user_id
      AND p.is_active = true
    GROUP BY p.id
    ORDER BY COUNT(sa.id)
    LIMIT 1;
  END IF;

  -- Assign proxy if found
  IF proxy_id IS NOT NULL THEN
    NEW.proxy_id := proxy_id;

    -- Update proxy last_used_at
    UPDATE proxies SET last_used_at = NOW() WHERE id = proxy_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for spam accounts
DROP TRIGGER IF EXISTS auto_assign_proxy_spam ON spam_accounts;
CREATE TRIGGER auto_assign_proxy_spam
BEFORE INSERT ON spam_accounts
FOR EACH ROW
WHEN (NEW.proxy_id IS NULL)
EXECUTE FUNCTION auto_assign_proxy_to_spam_account();

-- Function for follow accounts (similar to spam)
CREATE OR REPLACE FUNCTION auto_assign_proxy_to_follow_account()
RETURNS TRIGGER AS $$
DECLARE
  proxy_id UUID;
  settings RECORD;
BEGIN
  -- Get user's proxy settings
  SELECT * INTO settings FROM proxy_settings WHERE user_id = NEW.user_id;

  -- If no settings or auto-assign disabled, skip
  IF settings IS NULL OR NOT settings.auto_assign_enabled THEN
    RETURN NEW;
  END IF;

  -- Get an available proxy based on strategy
  IF settings.assignment_strategy = 'round_robin' THEN
    SELECT p.id INTO proxy_id
    FROM proxies p
    WHERE p.user_id = NEW.user_id
      AND p.is_active = true
    ORDER BY p.last_used_at NULLS FIRST, p.created_at
    LIMIT 1;
  ELSIF settings.assignment_strategy = 'random' THEN
    SELECT p.id INTO proxy_id
    FROM proxies p
    WHERE p.user_id = NEW.user_id
      AND p.is_active = true
    ORDER BY random()
    LIMIT 1;
  ELSE -- least_used
    SELECT p.id INTO proxy_id
    FROM proxies p
    LEFT JOIN follow_accounts fa ON fa.proxy_id = p.id
    WHERE p.user_id = NEW.user_id
      AND p.is_active = true
    GROUP BY p.id
    ORDER BY COUNT(fa.id)
    LIMIT 1;
  END IF;

  -- Assign proxy if found
  IF proxy_id IS NOT NULL THEN
    NEW.proxy_id := proxy_id;

    -- Update proxy last_used_at
    UPDATE proxies SET last_used_at = NOW() WHERE id = proxy_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add proxy_id to follow_accounts if not exists
ALTER TABLE follow_accounts
ADD COLUMN IF NOT EXISTS proxy_id UUID REFERENCES proxies(id) ON DELETE SET NULL;

-- Trigger for follow accounts
DROP TRIGGER IF EXISTS auto_assign_proxy_follow ON follow_accounts;
CREATE TRIGGER auto_assign_proxy_follow
BEFORE INSERT ON follow_accounts
FOR EACH ROW
WHEN (NEW.proxy_id IS NULL)
EXECUTE FUNCTION auto_assign_proxy_to_follow_account();

-- Align proxies table with frontend expectations
ALTER TABLE proxies
  ADD COLUMN IF NOT EXISTS proxy_name TEXT,
  ADD COLUMN IF NOT EXISTS host TEXT,
  ADD COLUMN IF NOT EXISTS port INTEGER,
  ADD COLUMN IF NOT EXISTS test_status TEXT DEFAULT 'untested',
  ADD COLUMN IF NOT EXISTS last_tested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assigned_accounts_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Ensure proxy_url exists for backward compatibility; if missing host/port, keep original
CREATE OR REPLACE FUNCTION ensure_proxy_url_consistency()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.proxy_url IS NULL THEN
    IF NEW.host IS NOT NULL AND NEW.port IS NOT NULL THEN
      NEW.proxy_url := NEW.proxy_type || '://' || NEW.host || ':' || NEW.port;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proxies_set_proxy_url ON proxies;
CREATE TRIGGER trg_proxies_set_proxy_url
  BEFORE INSERT OR UPDATE ON proxies
  FOR EACH ROW
  EXECUTE FUNCTION ensure_proxy_url_consistency();

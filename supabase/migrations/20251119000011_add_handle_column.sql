-- Add handle and name columns if they don't exist
-- This fixes the CSV import issue

-- For main_accounts
ALTER TABLE main_accounts
ADD COLUMN IF NOT EXISTS handle TEXT;

ALTER TABLE main_accounts
ADD COLUMN IF NOT EXISTS name TEXT;

-- Set handle from existing data if possible (from account_name or similar)
UPDATE main_accounts
SET handle = COALESCE(handle, account_name, 'unknown')
WHERE handle IS NULL;

UPDATE main_accounts
SET name = COALESCE(name, account_name, handle, 'unknown')
WHERE name IS NULL;

-- Make handle NOT NULL after populating
ALTER TABLE main_accounts
ALTER COLUMN handle SET NOT NULL;

ALTER TABLE main_accounts
ALTER COLUMN name SET NOT NULL;

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'main_accounts_user_id_handle_key'
  ) THEN
    ALTER TABLE main_accounts ADD CONSTRAINT main_accounts_user_id_handle_key UNIQUE (user_id, handle);
  END IF;
END $$;

-- For spam_accounts
ALTER TABLE spam_accounts
ADD COLUMN IF NOT EXISTS handle TEXT;

ALTER TABLE spam_accounts
ADD COLUMN IF NOT EXISTS name TEXT;

UPDATE spam_accounts
SET handle = COALESCE(handle, account_name, 'unknown')
WHERE handle IS NULL;

UPDATE spam_accounts
SET name = COALESCE(name, account_name, handle, 'unknown')
WHERE name IS NULL;

ALTER TABLE spam_accounts
ALTER COLUMN handle SET NOT NULL;

ALTER TABLE spam_accounts
ALTER COLUMN name SET NOT NULL;

-- Add unique constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'spam_accounts_user_id_handle_key'
  ) THEN
    ALTER TABLE spam_accounts ADD CONSTRAINT spam_accounts_user_id_handle_key UNIQUE (user_id, handle);
  END IF;
END $$;

-- Comments
COMMENT ON COLUMN main_accounts.handle IS 'Twitter handle/screen name';
COMMENT ON COLUMN main_accounts.name IS 'Display name';
COMMENT ON COLUMN spam_accounts.handle IS 'Twitter handle/screen name';
COMMENT ON COLUMN spam_accounts.name IS 'Display name';

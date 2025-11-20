-- Add credential columns to main_accounts
ALTER TABLE main_accounts
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS password TEXT,
ADD COLUMN IF NOT EXISTS mail_password TEXT,
ADD COLUMN IF NOT EXISTS two_factor_url TEXT,
ADD COLUMN IF NOT EXISTS backup_codes TEXT,
ADD COLUMN IF NOT EXISTS reg_number TEXT,
ADD COLUMN IF NOT EXISTS auth_token TEXT;

-- Add credential columns to spam_accounts
ALTER TABLE spam_accounts
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS password TEXT,
ADD COLUMN IF NOT EXISTS mail_password TEXT,
ADD COLUMN IF NOT EXISTS two_factor_url TEXT,
ADD COLUMN IF NOT EXISTS backup_codes TEXT,
ADD COLUMN IF NOT EXISTS reg_number TEXT,
ADD COLUMN IF NOT EXISTS auth_token TEXT;

-- Add credential columns to follow_accounts
ALTER TABLE follow_accounts
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS password TEXT,
ADD COLUMN IF NOT EXISTS mail_password TEXT,
ADD COLUMN IF NOT EXISTS two_factor_url TEXT,
ADD COLUMN IF NOT EXISTS backup_codes TEXT,
ADD COLUMN IF NOT EXISTS reg_number TEXT,
ADD COLUMN IF NOT EXISTS auth_token TEXT;

-- Comments for documentation
COMMENT ON COLUMN main_accounts.email IS 'Email address for Twitter account login';
COMMENT ON COLUMN main_accounts.password IS 'Password for Twitter account';
COMMENT ON COLUMN main_accounts.mail_password IS 'Email account password';
COMMENT ON COLUMN main_accounts.two_factor_url IS 'URL to retrieve 2FA codes';
COMMENT ON COLUMN main_accounts.backup_codes IS 'Backup codes for 2FA';
COMMENT ON COLUMN main_accounts.reg_number IS 'Registration number';
COMMENT ON COLUMN main_accounts.auth_token IS 'Twitter auth token from CSV';

COMMENT ON COLUMN spam_accounts.email IS 'Email address for Twitter account login';
COMMENT ON COLUMN spam_accounts.password IS 'Password for Twitter account';
COMMENT ON COLUMN spam_accounts.mail_password IS 'Email account password';
COMMENT ON COLUMN spam_accounts.two_factor_url IS 'URL to retrieve 2FA codes';
COMMENT ON COLUMN spam_accounts.backup_codes IS 'Backup codes for 2FA';
COMMENT ON COLUMN spam_accounts.reg_number IS 'Registration number';
COMMENT ON COLUMN spam_accounts.auth_token IS 'Twitter auth token from CSV';

COMMENT ON COLUMN follow_accounts.email IS 'Email address for Twitter account login';
COMMENT ON COLUMN follow_accounts.password IS 'Password for Twitter account';
COMMENT ON COLUMN follow_accounts.mail_password IS 'Email account password';
COMMENT ON COLUMN follow_accounts.two_factor_url IS 'URL to retrieve 2FA codes';
COMMENT ON COLUMN follow_accounts.backup_codes IS 'Backup codes for 2FA';
COMMENT ON COLUMN follow_accounts.reg_number IS 'Registration number';
COMMENT ON COLUMN follow_accounts.auth_token IS 'Twitter auth token from CSV';

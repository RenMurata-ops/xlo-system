-- Add notes column to follow_accounts table
-- This fixes the schema cache error: "Could not find the 'note' column of 'follow_accounts'"

ALTER TABLE follow_accounts
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN follow_accounts.notes IS 'Optional notes about this follow account';

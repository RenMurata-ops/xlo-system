-- Add execution_interval_minutes to loops table
ALTER TABLE loops
ADD COLUMN IF NOT EXISTS execution_interval_minutes INTEGER;

-- Migrate existing data from hours to minutes
UPDATE loops
SET execution_interval_minutes = execution_interval_hours * 60
WHERE execution_interval_minutes IS NULL;

-- Set default for new records
ALTER TABLE loops
ALTER COLUMN execution_interval_minutes SET DEFAULT 60;

-- Add comment
COMMENT ON COLUMN loops.execution_interval_minutes IS 'Execution interval in minutes (1-10080)';

/*
  # Add active status to users

  1. Changes
    - Add active column to users table with default true
    - Update existing users to be active
    - Add index on active column for better performance

  2. Security
    - No changes to RLS policies needed
*/

-- Add active column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Create index for active column
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);

-- Update existing users to be active
UPDATE users SET active = true WHERE active IS NULL;

-- Add active status to sync queue tracking
ALTER TABLE sync_queue 
ADD COLUMN IF NOT EXISTS active BOOLEAN;
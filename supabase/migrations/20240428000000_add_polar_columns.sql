-- Add Polar.sh billing columns to user_settings
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS polar_customer_id TEXT,
ADD COLUMN IF NOT EXISTS polar_subscription_id TEXT;

-- Index for faster lookups during webhooks
CREATE INDEX IF NOT EXISTS idx_user_settings_polar_customer_id ON user_settings(polar_customer_id);
CREATE INDEX IF NOT EXISTS idx_user_settings_polar_subscription_id ON user_settings(polar_subscription_id);

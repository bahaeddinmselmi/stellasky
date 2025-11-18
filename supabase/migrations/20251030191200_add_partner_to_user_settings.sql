ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS partner_user_id uuid,
  ADD COLUMN IF NOT EXISTS partner_display_name text,
  ADD COLUMN IF NOT EXISTS partner_share_code text;

CREATE INDEX IF NOT EXISTS user_settings_partner_idx ON user_settings(partner_user_id);

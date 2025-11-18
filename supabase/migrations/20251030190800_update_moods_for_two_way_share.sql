-- Add recipient and gif url to moods
ALTER TABLE moods
  ADD COLUMN IF NOT EXISTS recipient_user_id uuid,
  ADD COLUMN IF NOT EXISTS gif_url text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Ensure created_at defaults for new rows (for existing column it may already exist)
ALTER TABLE moods ALTER COLUMN created_at SET DEFAULT now();

-- Index moods for faster lookups by sender/recipient latest order
CREATE INDEX IF NOT EXISTS moods_sender_created_idx ON moods(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS moods_recipient_created_idx ON moods(recipient_user_id, created_at DESC);

-- Allow recipients to view moods addressed to them
CREATE POLICY IF NOT EXISTS "Recipients can view moods" ON moods
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR recipient_user_id = auth.uid());

-- Allow senders to insert moods to their recipient (redundant check but ensures RLS)
CREATE POLICY IF NOT EXISTS "Users can insert moods" ON moods
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

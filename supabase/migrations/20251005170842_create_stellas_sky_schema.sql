/*
  # Stella's Sky Database Schema

  ## Overview
  Complete database schema for Stella's Sky - a celestial-themed task management app
  that gamifies productivity through stars, constellations, and personalized encouragement.

  ## Tables Created

  ### 1. `tasks` - Core Task Management
  - `id` (uuid, primary key) - Unique task identifier
  - `user_id` (uuid) - Reference to auth.users
  - `title` (text) - Task name/description
  - `priority` (text) - Priority level: low, medium, high
  - `completed` (boolean) - Completion status
  - `completed_at` (timestamptz) - When task was completed
  - `due_time` (time) - Optional scheduled time for task
  - `created_at` (timestamptz) - Task creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 2. `streaks` - Daily Completion Tracking
  - `id` (uuid, primary key) - Unique streak record identifier
  - `user_id` (uuid) - Reference to auth.users
  - `date` (date) - Date of completion record
  - `tasks_completed` (integer) - Number of tasks completed that day
  - `total_tasks` (integer) - Total tasks that existed that day
  - `created_at` (timestamptz) - Record creation timestamp

  ### 3. `user_settings` - Personalization Preferences
  - `user_id` (uuid, primary key) - Reference to auth.users
  - `theme` (text) - Theme choice: night_sky, dawn_sky, royal_purple
  - `central_star_color` (text) - Central star color: gold, silver, pink
  - `notifications_enabled` (boolean) - Push notification toggle
  - `notification_tone` (text) - Tone style: motivational, playful
  - `quiet_hours_start` (time) - Start of quiet hours
  - `quiet_hours_end` (time) - End of quiet hours
  - `created_at` (timestamptz) - Settings creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### 4. `hidden_messages` - Secret Star Messages
  - `id` (uuid, primary key) - Unique message identifier
  - `user_id` (uuid) - Reference to auth.users
  - `message` (text) - Hidden message content
  - `unlocked` (boolean) - Whether message has been unlocked
  - `unlock_milestone` (integer) - Streak days required to unlock
  - `unlocked_at` (timestamptz) - When message was unlocked
  - `created_at` (timestamptz) - Message creation timestamp

  ### 5. `constellations` - Weekly Progress Patterns
  - `id` (uuid, primary key) - Unique constellation identifier
  - `user_id` (uuid) - Reference to auth.users
  - `week_start_date` (date) - Start date of week
  - `pattern_data` (jsonb) - Constellation pattern coordinates
  - `tasks_completed` (integer) - Total tasks completed this week
  - `constellation_name` (text) - User-given name for constellation
  - `created_at` (timestamptz) - Constellation creation timestamp

  ### 6. `voice_recordings` - Custom Audio Reminders
  - `id` (uuid, primary key) - Unique recording identifier
  - `user_id` (uuid) - Reference to auth.users
  - `task_id` (uuid) - Reference to associated task (optional)
  - `file_path` (text) - Storage path to audio file
  - `duration` (integer) - Audio duration in seconds
  - `created_at` (timestamptz) - Recording creation timestamp

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Users can only access their own data
  - Policies enforce authentication and user ownership

  ## Notes
  - All timestamps use timestamptz for timezone awareness
  - Default values set for booleans and timestamps
  - Indexes created on frequently queried columns for performance
*/

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  completed boolean DEFAULT false,
  completed_at timestamptz,
  due_time time,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create streaks table
CREATE TABLE IF NOT EXISTS streaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  date date NOT NULL,
  tasks_completed integer DEFAULT 0,
  total_tasks integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Create user_settings table
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY,
  theme text DEFAULT 'night_sky' CHECK (theme IN ('night_sky', 'dawn_sky', 'royal_purple')),
  central_star_color text DEFAULT 'gold' CHECK (central_star_color IN ('gold', 'silver', 'pink')),
  notifications_enabled boolean DEFAULT true,
  notification_tone text DEFAULT 'motivational' CHECK (notification_tone IN ('motivational', 'playful')),
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create hidden_messages table
CREATE TABLE IF NOT EXISTS hidden_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message text NOT NULL,
  unlocked boolean DEFAULT false,
  unlock_milestone integer NOT NULL,
  unlocked_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Create constellations table
CREATE TABLE IF NOT EXISTS constellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  week_start_date date NOT NULL,
  pattern_data jsonb DEFAULT '[]'::jsonb,
  tasks_completed integer DEFAULT 0,
  constellation_name text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, week_start_date)
);

-- Create voice_recordings table
CREATE TABLE IF NOT EXISTS voice_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_id uuid,
  file_path text NOT NULL,
  duration integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security on all tables
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE hidden_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE constellations ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_recordings ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS tasks_user_id_idx ON tasks(user_id);
CREATE INDEX IF NOT EXISTS tasks_created_at_idx ON tasks(created_at);
CREATE INDEX IF NOT EXISTS streaks_user_id_date_idx ON streaks(user_id, date);
CREATE INDEX IF NOT EXISTS hidden_messages_user_id_idx ON hidden_messages(user_id);
CREATE INDEX IF NOT EXISTS constellations_user_id_idx ON constellations(user_id);

-- RLS Policies for tasks table
CREATE POLICY "Users can view own tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own tasks"
  ON tasks FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for streaks table
CREATE POLICY "Users can view own streaks"
  ON streaks FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own streaks"
  ON streaks FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own streaks"
  ON streaks FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for user_settings table
CREATE POLICY "Users can view own settings"
  ON user_settings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own settings"
  ON user_settings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own settings"
  ON user_settings FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for hidden_messages table
CREATE POLICY "Users can view own messages"
  ON hidden_messages FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own messages"
  ON hidden_messages FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own messages"
  ON hidden_messages FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own messages"
  ON hidden_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for constellations table
CREATE POLICY "Users can view own constellations"
  ON constellations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own constellations"
  ON constellations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own constellations"
  ON constellations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for voice_recordings table
CREATE POLICY "Users can view own recordings"
  ON voice_recordings FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own recordings"
  ON voice_recordings FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own recordings"
  ON voice_recordings FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
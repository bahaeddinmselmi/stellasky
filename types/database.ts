export type Priority = 'low' | 'medium' | 'high';
export type Theme = 'night_sky' | 'dawn_sky' | 'royal_purple';
export type StarColor = 'gold' | 'silver' | 'pink';
export type NotificationTone = 'motivational' | 'playful';

export interface Task {
  id: string;
  user_id: string;
  title: string;
  priority: Priority;
  completed: boolean;
  completed_at: string | null;
  due_time: string | null;
  created_at: string;
  updated_at: string;
}

export interface Streak {
  id: string;
  user_id: string;
  date: string;
  tasks_completed: number;
  total_tasks: number;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  theme: Theme;
  central_star_color: StarColor;
  notifications_enabled: boolean;
  notification_tone: NotificationTone;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  created_at: string;
  updated_at: string;
  partner_user_id?: string | null;
  partner_display_name?: string | null;
  partner_share_code?: string | null;
}

export interface HiddenMessage {
  id: string;
  user_id: string;
  message: string;
  unlocked: boolean;
  unlock_milestone: number;
  unlock_type?: 'tasks' | 'days';
  unlocked_at: string | null;
  created_at: string;
}

export interface Constellation {
  id: string;
  user_id: string;
  week_start_date: string;
  pattern_data: ConstellationPoint[];
  tasks_completed: number;
  constellation_name: string | null;
  created_at: string;
}

export interface ConstellationPoint {
  x: number;
  y: number;
  taskId: string;
  completedAt: string;
}

export interface VoiceRecording {
  id: string;
  user_id: string;
  task_id: string | null;
  file_path: string;
  duration: number;
  created_at: string;
}

export interface Mood {
  id: string;
  user_id: string;
  mood: string;
  emoji: string;
  note: string | null;
  gif_search: string | null;
  created_at: string;
  recipient_user_id?: string | null;
  gif_url?: string | null;
}

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  updated_at: string;
  created_at: string;
}

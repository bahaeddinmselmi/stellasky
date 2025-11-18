import { supabase } from '@/lib/supabase';
import { sendStreakMilestoneNotification } from './notificationService';

export async function updateDailyStreak(userId: string) {
  const today = new Date().toISOString().split('T')[0];

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, completed')
    .eq('user_id', userId);

  if (!tasks) return;

  const completedTasks = tasks.filter((t) => t.completed).length;
  const totalTasks = tasks.length;

  const { data: existingStreak } = await supabase
    .from('streaks')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .maybeSingle();

  if (existingStreak) {
    await supabase
      .from('streaks')
      .update({
        tasks_completed: completedTasks,
        total_tasks: totalTasks,
      })
      .eq('id', existingStreak.id);
  } else {
    await supabase.from('streaks').insert({
      user_id: userId,
      date: today,
      tasks_completed: completedTasks,
      total_tasks: totalTasks,
    });
  }

  // Check if we hit a milestone
  const currentStreak = await getCurrentStreak(userId);
  const milestones = [3, 7, 14, 30, 50, 100];
  if (milestones.includes(currentStreak)) {
    await sendStreakMilestoneNotification(userId, currentStreak);
  }
}

export async function getCurrentStreak(userId: string): Promise<number> {
  const { data: streaks } = await supabase
    .from('streaks')
    .select('date,tasks_completed')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (!streaks || streaks.length === 0) return 0;

  let streak = 0;
  for (const record of streaks) {
    if (record.tasks_completed > 0) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export async function checkMilestoneUnlocks(userId: string) {
  // Total completed tasks
  const { count } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('completed', true);
  const tasksCompleted = count || 0;

  // Consecutive days with at least 1 task completed
  const { data: streaks } = await supabase
    .from('streaks')
    .select('date,tasks_completed')
    .eq('user_id', userId)
    .order('date', { ascending: false });
  let dayStreak = 0;
  if (streaks) {
    for (const r of streaks) {
      if (r.tasks_completed > 0) dayStreak++;
      else break;
    }
  }

  const progress = Math.max(tasksCompleted, dayStreak);

  const { data: lockedMessages } = await supabase
    .from('hidden_messages')
    .select('*')
    .eq('user_id', userId)
    .eq('unlocked', false)
    .gte('unlock_milestone', 0)
    .lte('unlock_milestone', progress);

  if (lockedMessages && lockedMessages.length > 0) {
    for (const message of lockedMessages) {
      await supabase
        .from('hidden_messages')
        .update({
          unlocked: true,
          unlocked_at: new Date().toISOString(),
        })
        .eq('id', message.id);
    }

    return lockedMessages.length;
  }

  return 0;
}

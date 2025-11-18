import { supabase } from '@/lib/supabase';
import messages from '@/data/messages.json';

export async function sendTaskCompletionNotification(userId: string, taskTitle: string) {
  try {
    // Get random completion message
    const randomMessage =
      messages.taskCompletion[Math.floor(Math.random() * messages.taskCompletion.length)];

    // Send via Supabase Edge Function
    await supabase.functions.invoke('send-push-notification', {
      body: {
        userId,
        title: '✨ Task Completed!',
        body: randomMessage.message,
        data: {
          type: 'task_completion',
          taskTitle,
        },
      },
    });
  } catch (error) {
    console.error('Failed to send task completion notification:', error);
  }
}

export async function sendStreakMilestoneNotification(userId: string, streakCount: number) {
  try {
    const milestone = messages.streakMilestones[streakCount.toString() as keyof typeof messages.streakMilestones];
    
    if (!milestone) return;

    // Send notification
    await supabase.functions.invoke('send-push-notification', {
      body: {
        userId,
        title: `🔥 ${streakCount} Day Streak!`,
        body: milestone.message,
        data: {
          type: 'streak_milestone',
          streakCount,
          secret: milestone.secret,
        },
      },
    });
  } catch (error) {
    console.error('Failed to send streak milestone notification:', error);
  }
}

export async function sendDailyReminder(userId: string, taskCount: number) {
  try {
    const message = taskCount === 0
      ? "✨ Time to add your stars for today!"
      : `⭐ You have ${taskCount} stars waiting to shine!`;

    await supabase.functions.invoke('send-push-notification', {
      body: {
        userId,
        title: "Good Morning, Little Star! 🌅",
        body: message,
        data: {
          type: 'daily_reminder',
          taskCount,
        },
      },
    });
  } catch (error) {
    console.error('Failed to send daily reminder:', error);
  }
}

export async function sendEncouragementNotification(userId: string, trigger: string) {
  try {
    const encouragement = messages.encouragement.find((e) => e.trigger === trigger);
    
    if (!encouragement) return;

    await supabase.functions.invoke('send-push-notification', {
      body: {
        userId,
        title: "Stella's Sky 💫",
        body: encouragement.message,
        data: {
          type: 'encouragement',
          trigger,
        },
      },
    });
  } catch (error) {
    console.error('Failed to send encouragement notification:', error);
  }
}

export async function sendPartnerMoodNotification(
  partnerUserId: string,
  mood: string,
  emoji: string,
  note?: string,
  imageUrl?: string | null
) {
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        userId: partnerUserId,
        title: `💭 Your partner shared their mood: ${emoji}`,
        body: note?.length ? note : `They're feeling ${mood}`,
        androidChannelId: 'partner-moods',
        data: {
          type: 'partner_mood',
          mood,
          emoji,
          note,
          imageUrl,
        },
        imageUrl: imageUrl ?? undefined,
      },
    });
  } catch (error) {
    console.error('Failed to send partner mood notification:', error);
  }
}

export async function sendPartnerMoodPreviewNotification(
  partnerUserId: string,
  mood: string,
  emoji: string,
  note: string | null,
  imageUrl?: string | null
) {
  try {
    await supabase.functions.invoke('send-push-notification', {
      body: {
        userId: partnerUserId,
        title: `💝 ${emoji} ${mood}`,
        body: note?.length ? note : 'Open Stella’s Sky to see the full vibe.',
        androidChannelId: 'partner-moods',
        data: {
          type: 'partner_mood',
          mood,
          emoji,
          note,
          imageUrl,
        },
        imageUrl: imageUrl ?? undefined,
      },
    });
  } catch (error) {
    console.error('Failed to send partner mood notification:', error);
  }
}

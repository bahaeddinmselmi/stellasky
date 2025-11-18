# 📱 Push Notifications Setup Guide

## Overview
The app now has a complete push notification system that sends notifications for:
- ✨ Task completions
- 🔥 Streak milestones (3, 7, 14, 30, 50, 100 days)
- 💭 Partner mood updates
- 🌅 Daily reminders
- 💫 Encouragement messages

## Database Setup

### 1. Create Push Tokens Table

Run this SQL in your Supabase SQL Editor:

\`\`\`sql
-- Create push_tokens table
create table public.push_tokens (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  token text unique not null,
  platform text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.push_tokens enable row level security;

-- Create policies
create policy "Users can insert their own tokens"
  on public.push_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own tokens"
  on public.push_tokens for update
  using (auth.uid() = user_id);

create policy "Users can view their own tokens"
  on public.push_tokens for select
  using (auth.uid() = user_id);

-- Create index for faster lookups
create index push_tokens_user_id_idx on public.push_tokens(user_id);
create index push_tokens_token_idx on public.push_tokens(token);
\`\`\`

## Expo Push Notification Service Setup

### 1. Create Supabase Edge Function

\`\`\`bash
# Navigate to your project directory
cd "c:\Users\bahae\Music\new pro\new new\project"

# Initialize Supabase (if not already done)
supabase init

# Create the edge function
supabase functions new send-push-notification
\`\`\`

### 2. Edge Function Code

Create/replace \`supabase/functions/send-push-notification/index.ts\`:

\`\`\`typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

interface NotificationRequest {
  userId: string
  title: string
  body: string
  data?: Record<string, any>
}

serve(async (req) => {
  try {
    const { userId, title, body, data } = await req.json() as NotificationRequest

    // Create Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    // Get user's push tokens
    const { data: tokens, error } = await supabase
      .from('push_tokens')
      .select('token, platform')
      .eq('user_id', userId)

    if (error) throw error
    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No push tokens found for user' }),
        { status: 404 }
      )
    }

    // Send push notifications to all user's devices
    const messages = tokens.map(({ token }) => ({
      to: token,
      sound: 'default',
      title,
      body,
      data: data || {},
    }))

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...(EXPO_ACCESS_TOKEN && { 'Authorization': \`Bearer \${EXPO_ACCESS_TOKEN}\` }),
      },
      body: JSON.stringify(messages),
    })

    const result = await response.json()

    return new Response(
      JSON.stringify({ success: true, result }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error sending push notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
\`\`\`

### 3. Deploy the Edge Function

\`\`\`bash
# Set environment variables (optional, for higher rate limits)
supabase secrets set EXPO_ACCESS_TOKEN=your_expo_access_token_here

# Deploy the function
supabase functions deploy send-push-notification
\`\`\`

## Getting Expo Access Token (Optional)

For production apps with high notification volume:

1. Go to https://expo.dev
2. Sign in to your account
3. Go to Account Settings → Access Tokens
4. Create a new token
5. Add it to Supabase secrets:
   \`\`\`bash
   supabase secrets set EXPO_ACCESS_TOKEN=your_token_here
   \`\`\`

**Note**: For development/testing, you can skip this. Expo provides a free tier without authentication.

## Testing Push Notifications

### 1. Test on Physical Device

Push notifications only work on physical devices (not simulators/emulators).

\`\`\`bash
# Start the app
npx expo start

# Scan QR code with Expo Go app on your phone
\`\`\`

### 2. Verify Token Registration

After logging in, check Supabase:

\`\`\`sql
-- View registered tokens
select user_id, platform, token, created_at 
from public.push_tokens 
order by created_at desc;
\`\`\`

### 3. Test Notifications

1. **Task Completion**: Complete a task in the app
2. **Streak Milestone**: Complete tasks for 3, 7, 14, etc. days
3. **Manual Test**: Use Supabase Edge Functions UI to call \`send-push-notification\` with:
   \`\`\`json
   {
     "userId": "your-user-id-here",
     "title": "Test Notification",
     "body": "This is a test!",
     "data": {
       "type": "test"
     }
   }
   \`\`\`

## Notification Types

### Task Completion
Sent when user completes a task:
- **Title**: "✨ Task Completed!"
- **Body**: Random message from \`messages.json\`
- **Data**: \`{ type: 'task_completion', taskTitle }\`

### Streak Milestone
Sent at 3, 7, 14, 30, 50, 100 day streaks:
- **Title**: "🔥 {X} Day Streak!"
- **Body**: Milestone message
- **Data**: \`{ type: 'streak_milestone', streakCount, secret }\`

### Partner Mood
Sent when partner shares mood:
- **Title**: "💭 Your partner shared their mood: {emoji}"
- **Body**: Mood note or feeling
- **Data**: \`{ type: 'partner_mood', mood, emoji, note }\`

### Daily Reminder
Can be scheduled via cron job:
- **Title**: "Good Morning, Little Star! 🌅"
- **Body**: Task count or encouragement
- **Data**: \`{ type: 'daily_reminder', taskCount }\`

## Customization

### Change Notification Sound

In \`supabase/functions/send-push-notification/index.ts\`:

\`\`\`typescript
const messages = tokens.map(({ token }) => ({
  to: token,
  sound: 'default', // Change to 'custom_sound.wav' or null
  title,
  body,
  data: data || {},
  priority: 'high', // Add priority
  badge: 1, // Add badge count
}))
\`\`\`

### Add Custom Notification Channels (Android)

In \`app.json\`:

\`\`\`json
{
  "expo": {
    "android": {
      "notificationIcon": "./assets/notification-icon.png"
    },
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#FFD700",
      "androidMode": "default",
      "androidCollapsedTitle": "Stella's Sky"
    }
  }
}
\`\`\`

## Troubleshooting

### No Notifications Received

1. **Check device permissions**:
   - Android: Settings → Apps → Expo Go → Notifications (Enable)
   - iOS: Settings → Expo Go → Notifications (Enable)

2. **Verify token in database**:
   \`\`\`sql
   select * from public.push_tokens where user_id = 'your-user-id';
   \`\`\`

3. **Check Edge Function logs**:
   - Go to Supabase Dashboard → Edge Functions → Logs

4. **Test with Expo Push Tool**:
   Visit https://expo.dev/notifications
   Enter your push token and test

### Rate Limiting

Expo free tier limits:
- 100 notifications per day
- Higher limits with Expo Access Token

### iOS Specific

- Notifications work in Expo Go
- For production, you need Apple Push Notification service (APNs) certificate
- Configure in Expo dashboard

## Production Deployment

For standalone apps (not Expo Go):

\`\`\`bash
# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios
\`\`\`

Add to \`app.json\`:
\`\`\`json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.yourcompany.stellassky"
    },
    "android": {
      "package": "com.yourcompany.stellassky"
    }
  }
}
\`\`\`

## Security Best Practices

1. **Never expose push tokens publicly**
2. **Use Row Level Security** (already configured)
3. **Validate user permissions** in Edge Functions
4. **Rate limit notifications** to prevent spam
5. **Encrypt sensitive data** in notification payload

---

**All set! Your app now has a complete push notification system! ✨**

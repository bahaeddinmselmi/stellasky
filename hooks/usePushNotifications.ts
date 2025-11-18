import { useEffect } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) return null;

  // Skip in Expo Go - push notifications require development build in SDK 53+
  if (Constants.appOwnership === 'expo') {
    console.log('[Push] Skipping registration in Expo Go. Use development build for push notifications.');
    return null;
  }

  const settings = await Notifications.getPermissionsAsync();
  let finalStatus = settings.status;

  if (finalStatus !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    finalStatus = req.status;
  }

  if (finalStatus !== 'granted') return null;

  // Try to resolve projectId for SDK 54+
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId
    || Constants?.easConfig?.projectId
    || undefined;

  const token = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined as any
  );
  return token.data;
}

export function usePushNotifications() {
  useEffect(() => {
    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (!token) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Upsert the push token
        await supabase
          .from('push_tokens')
          .upsert({
            user_id: user.id,
            token,
            platform: Platform.OS,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'token' });

        // Android notification channels
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.DEFAULT,
            sound: 'default',
          });

          await Notifications.setNotificationChannelAsync('partner-moods', {
            name: 'Partner Moods',
            importance: Notifications.AndroidImportance.MAX,
            sound: 'default',
            vibrationPattern: [0, 250, 250, 250],
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            showBadge: true,
          });
        }
      } catch (e) {
        console.warn('[Push] Registration failed:', e);
      }
    })();
  }, []);
}

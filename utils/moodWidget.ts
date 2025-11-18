import { NativeModules, Platform } from 'react-native';

export function updateMoodWidget(
  emoji: string,
  title: string,
  note: string,
  imageUrl?: string | null
) {
  if (Platform.OS !== 'android') {
    try { console.log('[Widget] Skip update: not Android'); } catch {}
    return;
  }
  const Native = (NativeModules as any)?.MoodWidget;
  if (!Native?.updateMoodWidget) {
    try { console.log('[Widget] Native module missing: MoodWidget.updateMoodWidget not found'); } catch {}
    return;
  }
  try {
    console.log?.('[Widget] Updating widget', { emoji, title, hasImage: !!imageUrl });
    Native.updateMoodWidget(emoji, title, note ?? '', imageUrl ?? null);
    console.log?.('[Widget] Update call invoked');
  } catch (e) {
    try { console.error('[Widget] Update error', e); } catch {}
  }
}

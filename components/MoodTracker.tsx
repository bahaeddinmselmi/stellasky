import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Smile, Meh, Frown, Heart, Cloud, Sun } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';
import { sendPartnerMoodNotification } from '@/utils/notificationService';
import { useFriends } from '@/hooks/useFriends';

interface Mood {
  emoji: string;
  label: string;
  icon: typeof Smile;
  color: string;
}

const moods: Mood[] = [
  { emoji: '😊', label: 'Happy', icon: Sun, color: '#FFD93D' },
  { emoji: '😍', label: 'Loved', icon: Heart, color: '#FF6B9D' },
  { emoji: '😌', label: 'Peaceful', icon: Cloud, color: '#6BCB77' },
  { emoji: '😐', label: 'Neutral', icon: Meh, color: '#95A5A6' },
  { emoji: '😢', label: 'Sad', icon: Cloud, color: '#3498DB' },
  { emoji: '😞', label: 'Down', icon: Frown, color: '#9B59B6' },
];

export function MoodTracker() {
  const { colors, partnerUserId, partnerDisplayName } = useTheme();
  const [selectedMood, setSelectedMood] = useState<Mood | null>(null);
  const [note, setNote] = useState('');
  const [gifSearch, setGifSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [gifResults, setGifResults] = useState<{ url: string; preview: string }[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [selectedGifUrl, setSelectedGifUrl] = useState<string | null>(null);
  const [gifError, setGifError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<{ type: 'self' | 'partner' | 'friend'; id?: string | null }>({ type: 'self' });
  const { friends } = useFriends(currentUserId);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);
    })();
  }, []);

  useEffect(() => {
    let timer: any;
    const controller = new AbortController();
    const query = gifSearch.trim();
    const extra = ((Constants as any)?.expoConfig?.extra) || ((Constants as any)?.manifest?.extra) || {};
    const key = extra?.tenorKey || process.env.EXPO_PUBLIC_TENOR_KEY as string | undefined;
    if (!key) {
      // Fallback to Tenor v1 test key
      // Note: Rate-limited. For production, set EXPO_PUBLIC_TENOR_KEY or expo.extra.tenorKey.
      // @ts-ignore
      (global as any)._TENOR_TEST_KEY_USED_ = true;
    }
    setLoadingGifs(true);
    timer = setTimeout(async () => {
      try {
        const prodKey = key || 'LIVDSRZULELA';
        // Try v2 first: search when query, featured when empty
        const v2Url = query
          ? `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${prodKey}&limit=12&media_filter=gif,tinygif`
          : `https://tenor.googleapis.com/v2/featured?key=${prodKey}&limit=12&media_filter=gif,tinygif`;
        let items: { url: string; preview: string }[] = [];
        try {
          const res = await fetch(v2Url, { signal: controller.signal, headers: { Accept: 'application/json' } });
          const json = await res.json();
          items = (json?.results || [])
            .map((r: any) => {
              const tiny = r?.media_formats?.tinygif?.url;
              const gif = r?.media_formats?.gif?.url;
              const pick = tiny || gif;
              return pick ? { url: gif || tiny, preview: tiny || gif } : null;
            })
            .filter(Boolean) as { url: string; preview: string }[];
        } catch (e) {
          items = [];
        }
        // If v2 yields nothing, try v1 (search or trending)
        if (!items.length) {
          const v1Url = query
            ? `https://g.tenor.com/v1/search?q=${encodeURIComponent(query)}&key=${prodKey}&limit=12`
            : `https://g.tenor.com/v1/trending?key=${prodKey}&limit=12`;
          const res1 = await fetch(v1Url, { signal: controller.signal, headers: { Accept: 'application/json' } });
          const json1 = await res1.json();
          items = (json1?.results || [])
            .map((r: any) => {
              const media0 = Array.isArray(r?.media) && r.media.length ? r.media[0] : null;
              const tiny = media0?.tinygif?.url || media0?.nanogif?.url;
              const gif = media0?.gif?.url || media0?.mediumgif?.url;
              const pick = tiny || gif;
              return pick ? { url: gif || tiny, preview: tiny || gif } : null;
            })
            .filter(Boolean) as { url: string; preview: string }[];
        }

        setGifResults(items);
        setGifError(items.length ? null : 'No GIFs found. Try another search.');
      } catch (e) {
        setGifResults([]);
        setGifError('Failed to load GIFs. Check your internet connection.');
      } finally {
        setLoadingGifs(false);
      }
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [gifSearch]);

  const sendMood = async () => {
    if (!selectedMood) {
      Alert.alert('Select a Mood', 'Please choose how you\'re feeling');
      return;
    }

    setSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) {
        throw new Error('No signed-in user');
      }

      const trimmedNote = note.trim();
      const trimmedSearch = gifSearch.trim();
      const finalGifUrl = selectedGifUrl || gifResults[0]?.url || null;

      // Store mood in database
      const targetRecipientId = recipient.type === 'partner' ? partnerUserId : recipient.type === 'friend' ? (recipient.id ?? null) : null;

      const { error: dbError } = await supabase
        .from('moods')
        .insert({
          user_id: user.id,
          mood: selectedMood.label,
          emoji: selectedMood.emoji,
          note: trimmedNote.length ? trimmedNote : null,
          recipient_user_id: targetRecipientId ?? null,
          gif_url: finalGifUrl,
        });

      if (dbError) throw dbError;

      // Do not update the widget here. The widget is updated only when you RECEIVE a mood
      // (handled globally via ThemeContext subscription on moods where recipient_user_id=you).

      if (targetRecipientId) {
        sendPartnerMoodNotification(
          targetRecipientId,
          selectedMood.label,
          selectedMood.emoji,
          trimmedNote || undefined,
          finalGifUrl || undefined,
        );
      }

      const sharedText =
        recipient.type === 'partner'
          ? `Shared with ${partnerDisplayName ?? 'your partner'}! Thank you for opening up 💖`
          : recipient.type === 'friend'
          ? 'Shared with your friend! Thank you for opening up 💖'
          : 'Your mood has been saved. Thank you for opening up! 💖';

      Alert.alert('Mood Sent! ✨', sharedText, [{ text: 'OK', onPress: resetForm }]);
    } catch (error: any) {
      console.error('Error sending mood:', error);
      Alert.alert('Error', 'Failed to send mood. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const resetForm = () => {
    setSelectedMood(null);
    setNote('');
    setGifSearch('');
    setGifResults([]);
    setSelectedGifUrl(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text.primary }]}> 
        How are you feeling? 💭
      </Text>
      <Text style={[styles.subtitle, { color: colors.text.secondary }]}> 
        Share your mood and it'll reach me instantly
      </Text>

      <View style={styles.moodsGrid}>
        {moods.map((mood) => (
          <TouchableOpacity
            key={mood.label}
            style={[
              styles.moodButton,
              {
                backgroundColor: colors.card,
                borderColor: selectedMood?.label === mood.label ? mood.color : 'transparent',
                borderWidth: selectedMood?.label === mood.label ? 3 : 1,
              },
            ]}
            onPress={() => setSelectedMood(mood)}
          >
            <Text style={styles.moodEmoji}>{mood.emoji}</Text>
            <Text
              style={[
                styles.moodLabel,
                {
                  color:
                    selectedMood?.label === mood.label ? mood.color : colors.text.secondary,
                },
              ]}
            >
              {mood.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedMood && (
        <View style={styles.detailsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Recipient</Text>
          <View style={styles.recipientRow}>
            <TouchableOpacity
              style={[
                styles.recipientChip,
                recipient.type === 'self' && { borderColor: colors.accent, borderWidth: 2 },
              ]}
              onPress={() => setRecipient({ type: 'self' })}
            >
              <Text style={[styles.recipientLabel, { color: colors.text.primary }]}>Just me</Text>
            </TouchableOpacity>
            {!!partnerUserId && (
              <TouchableOpacity
                style={[
                  styles.recipientChip,
                  recipient.type === 'partner' && { borderColor: colors.accent, borderWidth: 2 },
                ]}
                onPress={() => setRecipient({ type: 'partner', id: partnerUserId })}
              >
                <Text style={[styles.recipientLabel, { color: colors.text.primary }]}>Partner</Text>
              </TouchableOpacity>
            )}
            {friends.map((f) => (
              <TouchableOpacity
                key={f.friend_user_id}
                style={[
                  styles.recipientChip,
                  recipient.type === 'friend' && recipient.id === f.friend_user_id && { borderColor: colors.accent, borderWidth: 2 },
                ]}
                onPress={() => setRecipient({ type: 'friend', id: f.friend_user_id })}
              >
                <Text style={[styles.recipientLabel, { color: colors.text.primary }]}>
                  {f.display_name || f.friend_user_id.slice(0, 8)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}> 
            What's on your mind? (optional)
          </Text>
          <TextInput
            style={[styles.noteInput, { color: colors.text.primary, borderColor: colors.accent }]}
            placeholder="Tell me what you're feeling..."
            placeholderTextColor={colors.text.secondary}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}> 
            Add a GIF (optional)
          </Text>
          <Text style={[styles.helperText, { color: colors.text.secondary }]}> 
            Type what you're looking for (e.g., "happy cat", "hug")
          </Text>
          <TextInput
            style={[styles.input, { color: colors.text.primary, borderColor: colors.accent }]}
            placeholder="Search for a GIF..."
            placeholderTextColor={colors.text.secondary}
            value={gifSearch}
            onChangeText={setGifSearch}
          />
          {loadingGifs && (
            <ActivityIndicator size="small" color={colors.accent} />
          )}
          {!loadingGifs && gifResults.length > 0 && (
            <View style={styles.gifGrid}>
              {gifResults.map((g) => (
                <TouchableOpacity
                  key={g.url}
                  style={[
                    styles.gifItem,
                    selectedGifUrl === g.url && { borderColor: colors.accent, borderWidth: 3 },
                  ]}
                  onPress={() => setSelectedGifUrl(g.url)}
                >
                  <Image source={{ uri: g.preview }} style={styles.gifImage} />
                </TouchableOpacity>
              ))}
            </View>
          )}
          {!loadingGifs && !!gifError && (
            <Text style={[styles.helperText, { color: colors.text.secondary }]}>{gifError}</Text>
          )}

          <TouchableOpacity
            style={[
              styles.sendButton,
              {
                backgroundColor: colors.accent,
                opacity: sending ? 0.6 : 1,
              },
            ]}
            onPress={sendMood}
            disabled={sending}
          >
            <Text style={styles.sendButtonText}>
              {sending ? 'Sending...' : `Send ${selectedMood.emoji}`}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  moodsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  moodButton: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  moodEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  moodLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  detailsSection: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  recipientRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  recipientChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  recipientLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 14,
    marginBottom: 8,
  },
  noteInput: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
    minHeight: 120,
  },
  input: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
  },
  gifGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  gifItem: {
    width: '31%',
    aspectRatio: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gifImage: {
    width: '100%',
    height: '100%',
  },
  sendButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
});

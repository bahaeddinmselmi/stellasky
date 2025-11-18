import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  TextInput,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Mood } from '@/types/database';
import { OptimizedStarfield } from '@/components/OptimizedStarfield';
import { usePartnerMoods } from '@/hooks/usePartnerMoods';
import { useFriends } from '@/hooks/useFriends';

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'received', label: 'Received' },
  { key: 'sent', label: 'Sent' },
] as const;

type FilterKey = (typeof FILTERS)[number]['key'];

export default function MoodHistoryScreen() {
  const {
    colors,
    partnerUserId,
    partnerDisplayName,
  } = useTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [error, setError] = useState<string | null>(null);
  const [section, setSection] = useState<'history' | 'friends'>('history');
  const [friendCode, setFriendCode] = useState('');

  const { friends, loading: friendsLoading, error: friendsError, linkByCode, unlinkFriend } = useFriends(userId);

  const loadUser = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  }, []);

  const fetchMoods = useCallback(async () => {
    if (!userId) return;
    try {
      setError(null);
      setLoading(true);
      const { data, error: dbError } = await supabase
        .from('moods')
        .select('*')
        .or(`user_id.eq.${userId},recipient_user_id.eq.${userId}`)
        .order('created_at', { ascending: false });
      if (dbError) throw dbError;
      setMoods(data ?? []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load moods');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const handleRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    await fetchMoods();
    setRefreshing(false);
  }, [fetchMoods, userId]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        fetchMoods();
      }
    }, [fetchMoods, userId])
  );

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`mood_history_sender_${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'moods',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const newMood = payload.new as Mood;
        setMoods((prev) => {
          if (prev.some((m) => m.id === newMood.id)) return prev;
          return [newMood, ...prev];
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const handleLinkFriend = useCallback(async () => {
    if (!friendCode.trim()) return;
    const res = await linkByCode(friendCode);
    if (res.ok) {
      setFriendCode('');
      Alert.alert('Linked', 'Friend linked successfully.');
    } else {
      Alert.alert('Link failed', res.message || 'Could not link friend.');
    }
  }, [friendCode, linkByCode]);

  usePartnerMoods({
    currentUserId: userId,
    partnerUserId,
    onNewMood: (incoming) => {
      setMoods((prev) => {
        if (prev.some((m) => m.id === incoming.id)) return prev;
        return [incoming, ...prev];
      });
    },
  });

  const filteredMoods = useMemo(() => {
    return moods.filter((mood) => {
      if (!userId) return false;
      if (filter === 'all') return true;
      if (filter === 'received') return mood.recipient_user_id === userId;
      if (filter === 'sent') return mood.user_id === userId;
      return true;
    });
  }, [filter, moods, userId]);

  const renderMood = ({ item }: { item: Mood }) => {
    const isSent = item.user_id === userId;
    const timestamp = new Date(item.created_at).toLocaleString();

    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}> 
        <View style={styles.cardHeader}>
          <Text style={styles.emoji}>{item.emoji}</Text>
          <View style={styles.headerText}>
            <Text style={[styles.moodLabel, { color: colors.text.primary }]}>{item.mood}</Text>
            <Text style={[styles.metaText, { color: colors.text.secondary }]}> 
              {isSent
                ? `You → ${partnerDisplayName ?? 'Partner'}`
                : `${partnerDisplayName ?? 'Partner'} → You`}
            </Text>
          </View>
          <Text style={[styles.timeText, { color: colors.text.secondary }]}>{timestamp}</Text>
        </View>
        {item.note && (
          <Text style={[styles.noteText, { color: colors.text.primary }]}>{item.note}</Text>
        )}
        {item.gif_url && (
          <Image source={{ uri: item.gif_url }} style={styles.previewImage} />
        )}
      </View>
    );
  };

  const WebWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (Platform.OS === 'web') {
      return (
        <ScrollView style={styles.webScroll} contentContainerStyle={styles.webScrollContent}>
          {children}
        </ScrollView>
      );
    }
    return <>{children}</>;
  };

  return (
    <View style={styles.container}>
      <OptimizedStarfield />
      <WebWrap>
      <SafeAreaView style={styles.content} edges={['top']}>
        <View style={styles.contentInner}>
        <Text style={[styles.title, { color: colors.text.primary }]}>Mood</Text>
        <Text style={[styles.subtitle, { color: colors.text.secondary }]}>
          Relive the feelings youve shared together.
        </Text>

        <View style={styles.sectionRow}>
          {(['history', 'friends'] as const).map((key) => {
            const isActive = section === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.sectionChip, isActive && { backgroundColor: colors.accent }]}
                onPress={() => setSection(key)}
              >
                <Text style={[styles.sectionLabel, { color: isActive ? '#000' : colors.text.primary }]}>
                  {key === 'history' ? 'History' : 'Friends'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {section === 'history' ? (
          <>
            <View style={styles.filterRow}>
              {FILTERS.map(({ key, label }) => {
                const isActive = filter === key;
                return (
                  <TouchableOpacity
                    key={key}
                    style={[styles.filterChip, isActive && { backgroundColor: colors.accent }]}
                    onPress={() => setFilter(key)}
                  >
                    <Text
                      style={[
                        styles.filterLabel,
                        { color: isActive ? '#000' : colors.text.primary },
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {loading ? (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={colors.accent} />
              </View>
            ) : error ? (
              <Text style={[styles.errorText, { color: '#FF6B6B' }]}>{error}</Text>
            ) : filteredMoods.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={[styles.emptyTitle, { color: colors.text.primary }]}>No moods yet</Text>
                <Text style={[styles.emptySubtitle, { color: colors.text.secondary }]}>Share how youre feeling to see it here.</Text>
              </View>
            ) : (
              Platform.OS === 'web' ? (
                <View style={styles.listContent}>
                  {filteredMoods.map((m) => (
                    <React.Fragment key={m.id}>{renderMood({ item: m })}</React.Fragment>
                  ))}
                </View>
              ) : (
                <FlatList
                  style={{ flexGrow: 1 }}
                  data={filteredMoods}
                  keyExtractor={(item) => item.id}
                  renderItem={renderMood}
                  contentContainerStyle={styles.listContent}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={handleRefresh}
                      tintColor={colors.accent}
                    />
                  }
                />
              )
            )}
          </>
        ) : (
          <View style={{ gap: 16 }}>
            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Add a Friend by Code</Text>
            <TextInput
              style={[styles.input, { color: colors.text.primary, borderColor: colors.accent }]}
              placeholder="Enter friend's share code"
              placeholderTextColor={colors.text.secondary}
              value={friendCode}
              onChangeText={setFriendCode}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: colors.accent }]}
              onPress={handleLinkFriend}
            >
              <Text style={styles.sendButtonText}>Link Friend</Text>
            </TouchableOpacity>

            <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Your Friends</Text>
            {friendsError ? (
              <Text style={[styles.errorText, { color: '#FF6B6B' }]}>{friendsError}</Text>
            ) : friendsLoading ? (
              <View style={styles.loader}><ActivityIndicator size="small" color={colors.accent} /></View>
            ) : friends.length === 0 ? (
              <Text style={[styles.helperText, { color: colors.text.secondary }]}>No friends yet</Text>
            ) : (
              <View style={{ gap: 12 }}>
                {friends.map((f) => (
                  <View key={f.friend_user_id} style={[styles.card, { backgroundColor: colors.card }]}> 
                    <View style={styles.cardHeader}>
                      <Text style={[styles.moodLabel, { color: colors.text.primary }]}>
                        {f.display_name || f.friend_user_id.slice(0, 8)}
                      </Text>
                      <TouchableOpacity
                        onPress={async () => {
                          const res = await unlinkFriend(f.friend_user_id);
                          if (!res.ok) Alert.alert('Unlink failed', res.message || 'Try again later');
                        }}
                        style={[styles.filterChip, { paddingVertical: 6, paddingHorizontal: 10 }]}
                      >
                        <Text style={[styles.filterLabel, { color: colors.text.primary }]}>Unlink</Text>
                      </TouchableOpacity>
                    </View>
                    {f.share_code && (
                      <Text style={[styles.metaText, { color: colors.text.secondary }]}>Code: {f.share_code}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        </View>
      </SafeAreaView>
      </WebWrap>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  contentInner: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    marginTop: 4,
    marginBottom: 20,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  sectionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  sectionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  sendButton: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  helperText: {
    fontSize: 14,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 32,
    gap: 16,
    alignItems: 'stretch',
  },
  card: {
    borderRadius: 20,
    padding: 16,
    gap: 12,
    width: '100%',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emoji: {
    fontSize: 32,
  },
  headerText: {
    flex: 1,
  },
  moodLabel: {
    fontSize: 18,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 14,
    marginTop: 2,
  },
  timeText: {
    fontSize: 12,
  },
  noteText: {
    fontSize: 16,
    lineHeight: 22,
  },
  previewImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 420,
    borderRadius: 12,
  },
  webScroll: {
    flex: 1,
  },
  webScrollContent: {
    flexGrow: 1,
  },
});

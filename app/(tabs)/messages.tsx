import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Star, Lock, Plus, X, Trash } from 'lucide-react-native';
import { OptimizedStarfield } from '@/components/OptimizedStarfield';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { HiddenMessage } from '@/types/database';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  ZoomIn,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';

export default function MessagesScreen() {
  const { colors } = useTheme();
  const [messages, setMessages] = useState<HiddenMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<HiddenMessage | null>(null);
  const [showAddMessage, setShowAddMessage] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [milestone, setMilestone] = useState('7');
  const [userId, setUserId] = useState<string | null>(null);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const [bulkText, setBulkText] = useState('');
  const [editMode, setEditMode] = useState(false);

  

  const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
  const pulse = useSharedValue(0);

  useEffect(() => {
    // Subtle pulsing for unlocked stars
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1200, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const starPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.08 }],
  }));

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (userId) {
      loadMessages();
      checkAndUnlockMessages();
    }
  }, [userId]);

  // Ensure messages refresh when the screen gains focus
  useFocusEffect(
    React.useCallback(() => {
      if (!userId) return;
      loadMessages();
      checkAndUnlockMessages();
    }, [userId])
  );

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`tasks_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        () => {
          checkAndUnlockMessages();
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`hidden_messages_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hidden_messages', filter: `user_id=eq.${userId}` },
        () => {
          loadMessages();
          checkAndUnlockMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      setIsAdmin((user.email || '').toLowerCase() === 'bahaeddinmselmi1@gmail.com');
    }
  };

  const loadMessages = async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('hidden_messages')
      .select('*')
      .eq('user_id', userId)
      .order('unlock_milestone', { ascending: true });

    if (data) {
      setMessages(data);
    }
  };

  const checkAndUnlockMessages = async () => {
    if (!userId) return;
    // Strict per-task unlocking
    const { count } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('completed', true);

    const tasksCompleted = count || 0;
    setCurrentStreak(tasksCompleted);
    const progress = tasksCompleted;

    const { data: lockedMessages } = await supabase
      .from('hidden_messages')
      .select('*')
      .eq('user_id', userId)
      .eq('unlocked', false)
      .or(`unlock_milestone.lte.${progress},unlock_milestone.lt.0`);

    if (lockedMessages && lockedMessages.length > 0) {
      const now = new Date();
      for (const message of lockedMessages) {
        const isTaskBased = (message as any).unlock_milestone >= 0;
        let shouldUnlock = false;
        if (isTaskBased) {
          shouldUnlock = (message as any).unlock_milestone <= progress;
        } else {
          const days = Math.abs((message as any).unlock_milestone);
          const created = new Date((message as any).created_at);
          const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
          shouldUnlock = diffDays >= days;
        }
        if (shouldUnlock) {
          await supabase
            .from('hidden_messages')
            .update({
              unlocked: true,
              unlocked_at: new Date().toISOString(),
            })
            .eq('id', (message as any).id);
        }
      }
      await loadMessages();
    }

    // Relock only task-based secrets that are above progress
    await supabase
      .from('hidden_messages')
      .update({ unlocked: false, unlocked_at: null })
      .eq('user_id', userId)
      .eq('unlocked', true)
      .gt('unlock_milestone', progress)
      .gte('unlock_milestone', 0);

    await loadMessages();
  };

  const addMessage = async () => {
    if (!newMessage.trim() || !userId) return;

    if (isAdmin) {
      // Broadcast to all users via RPC
      const daysVal = Math.max(1, Math.abs(parseInt((milestone || '1').trim(), 10) || 1));
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('add_hidden_message_for_all', {
        p_message: newMessage,
        // Use negative milestone to indicate days countdown
        p_unlock_milestone: -daysVal,
      });
      if (!rpcErr) {
        await loadMessages();
        setNewMessage('');
        setMilestone('7');
        setShowAddMessage(false);
      } else {
        const msgText = rpcErr.message || '';
        if (msgText.includes('duplicate key value') || msgText.toLowerCase().includes('duplicate')) {
          // Auto-suffix to avoid unique constraint
          const daysVal2 = Math.max(1, Math.abs(parseInt((milestone || '1').trim(), 10) || 1));
          let success = false;
          for (let k = 2; k <= 10; k++) {
            const candidate = `${newMessage} (${k})`;
            const { error: retryErr } = await supabase.rpc('add_hidden_message_for_all', {
              p_message: candidate,
              p_unlock_milestone: -daysVal2,
            });
            if (!retryErr) {
              success = true;
              await loadMessages();
              setNewMessage('');
              setMilestone('7');
              setShowAddMessage(false);
              Alert.alert('Created', `Saved as "${candidate}" to avoid duplicates.`);
              break;
            }
            if (!(retryErr.message || '').toLowerCase().includes('duplicate')) break;
          }
          if (!success) {
            Alert.alert('Error', 'Could not create a unique message. Try changing the text.');
          }
        } else {
          Alert.alert('Error', rpcErr.message || 'Failed to add secret');
        }
      }
      return;
    }
    // Non-admin shouldn't see add, but guard anyway
  };

  const addBulkMessages = async () => {
    if (!isAdmin || !userId) return;
    const items: string[] = [];
    const regex = /"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(bulkText)) !== null) {
      const s = m[1].trim();
      if (s.length) items.push(s);
    }
    if (!items.length) return;
    // Determine current max milestone for this user to continue sequence
    const { data: maxRows } = await supabase
      .from('hidden_messages')
      .select('unlock_milestone')
      .eq('user_id', userId)
      .gte('unlock_milestone', 0)
      .order('unlock_milestone', { ascending: false })
      .limit(1);
    const base = maxRows && maxRows.length ? Math.max(0, maxRows[0].unlock_milestone) : 0;

    const skipped: string[] = [];
    for (let i = 0; i < items.length; i++) {
      const msg = items[i];
      const { error: rpcErr } = await supabase.rpc('add_hidden_message_for_all', {
        p_message: msg,
        // Continue from last milestone
        p_unlock_milestone: base + i + 1,
      });
      if (rpcErr) {
        const txt = rpcErr.message || '';
        if (txt.includes('duplicate key value') || txt.includes('duplicate')) {
          skipped.push(msg);
          continue;
        }
        Alert.alert('Error', txt || 'Failed to add some messages');
        break;
      }
    }
    await loadMessages();
    setBulkText('');
    setNewMessage('');
    setMilestone('7');
    setShowAddMessage(false);
    if (skipped.length) {
      Alert.alert('Skipped duplicates', `${skipped.length} message(s) already exist and were skipped.`);
    }
  };

  const deleteMessageGlobal = async (message: HiddenMessage) => {
    if (!isAdmin) return;
    await supabase.rpc('delete_hidden_message_for_all', {
      p_message: message.message,
    });
    await loadMessages();
  };

  const deleteBulkMessages = async () => {
    if (!isAdmin || !bulkText.trim()) return;
    const items: string[] = [];
    const regex = /"([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(bulkText)) !== null) {
      const s = m[1].trim();
      if (s.length) items.push(s);
    }
    if (!items.length) return;
    for (const msg of items) {
      await supabase.rpc('delete_hidden_message_for_all', { p_message: msg });
    }
    await loadMessages();
    setBulkText('');
  };

  // Web: single page scroll wrapper
  const WebWrap: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (Platform.OS === 'web') {
      return (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
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
      <SafeAreaView style={Platform.OS === 'web' ? styles.contentWeb : styles.content} edges={['top']}>
        <View style={styles.contentInner}>
        <View style={styles.header}>
          <View style={{ width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.title, { color: colors.text.primary }]}>Secret Stars</Text>
            {isAdmin && (
              <TouchableOpacity onPress={() => setEditMode((v) => !v)}>
                <Text style={{ color: colors.accent, fontWeight: '700' }}>{editMode ? 'Done' : 'Edit'}</Text>
              </TouchableOpacity>
            )}
          </View>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}>Unlock messages as you complete tasks, and time-based secrets unlock after days pass</Text>
        </View>

        {Platform.OS === 'web' ? (
          <View style={styles.gridContainer}>
            {messages.map((message, i) => {
              const isTask = message.unlock_milestone >= 0;
              const unlocked = message.unlocked;
              let subtitle = '';
              if (isTask) {
                subtitle = `${message.unlock_milestone} ${message.unlock_milestone === 1 ? 'task' : 'tasks'}`;
              } else {
                const days = Math.abs(message.unlock_milestone);
                const created = new Date(message.created_at);
                const now = new Date();
                const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
                const remaining = Math.max(0, days - diffDays);
                subtitle = unlocked
                  ? `${days} ${days === 1 ? 'day' : 'days'}`
                  : `in ${remaining} ${remaining === 1 ? 'day' : 'days'}`;
              }
              return (
                <AnimatedTouchable
                  key={message.id}
                  entering={undefined}
                  style={[
                    styles.messageCard,
                    { backgroundColor: colors.card, opacity: unlocked ? 1 : 0.6 },
                  ]}
                  onPress={() => unlocked && setSelectedMessage(message)}
                  disabled={!unlocked}
                >
                  {isAdmin && editMode && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteMessageGlobal(message)}>
                      <Trash size={16} color={colors.text.secondary} />
                    </TouchableOpacity>
                  )}
                  {unlocked ? (
                    <Animated.View style={starPulseStyle}>
                      <Star size={40} color={colors.accent} fill={colors.accent} />
                    </Animated.View>
                  ) : (
                    <Lock size={40} color={colors.text.secondary} />
                  )}
                  <Text style={[styles.milestoneText, { color: colors.text.secondary }]}>{subtitle}</Text>
                </AnimatedTouchable>
              );
            })}
            {isAdmin && (
              <AnimatedTouchable
                entering={undefined}
                style={[styles.addCard, { borderColor: colors.accent }]}
                onPress={() => setShowAddMessage(true)}
              >
                <Plus size={40} color={colors.accent} />
              </AnimatedTouchable>
            )}
          </View>
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={styles.gridContainer}>
            {messages.map((message, i) => {
              const isTask = message.unlock_milestone >= 0;
              const unlocked = message.unlocked;
              let subtitle = '';
              if (isTask) {
                subtitle = `${message.unlock_milestone} ${message.unlock_milestone === 1 ? 'task' : 'tasks'}`;
              } else {
                const days = Math.abs(message.unlock_milestone);
                const created = new Date(message.created_at);
                const now = new Date();
                const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
                const remaining = Math.max(0, days - diffDays);
                subtitle = unlocked
                  ? `${days} ${days === 1 ? 'day' : 'days'}`
                  : `in ${remaining} ${remaining === 1 ? 'day' : 'days'}`;
              }
              return (
                <AnimatedTouchable
                  key={message.id}
                  entering={ZoomIn.delay(i * 50)}
                  style={[
                    styles.messageCard,
                    { backgroundColor: colors.card, opacity: unlocked ? 1 : 0.6 },
                  ]}
                  onPress={() => unlocked && setSelectedMessage(message)}
                  disabled={!unlocked}
                >
                  {isAdmin && editMode && (
                    <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteMessageGlobal(message)}>
                      <Trash size={16} color={colors.text.secondary} />
                    </TouchableOpacity>
                  )}
                  {unlocked ? (
                    <Animated.View style={starPulseStyle}>
                      <Star size={40} color={colors.accent} fill={colors.accent} />
                    </Animated.View>
                  ) : (
                    <Lock size={40} color={colors.text.secondary} />
                  )}
                  <Text style={[styles.milestoneText, { color: colors.text.secondary }]}>{subtitle}</Text>
                </AnimatedTouchable>
              );
            })}
            {isAdmin && (
              <AnimatedTouchable
                entering={ZoomIn.delay(messages.length * 50 + 100)}
                style={[styles.addCard, { borderColor: colors.accent }]}
                onPress={() => setShowAddMessage(true)}
              >
                <Plus size={40} color={colors.accent} />
              </AnimatedTouchable>
            )}
          </ScrollView>
        )}

        <View style={[styles.streakBanner, { backgroundColor: colors.card }]}>
          <Text style={[styles.streakText, { color: colors.text.primary }]}>Tasks Completed: {currentStreak}</Text>
        </View>
        </View>
      </SafeAreaView>
      </WebWrap>

      <Modal
        visible={selectedMessage !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedMessage(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}> 
            <View style={styles.modalHeader}>
              <Animated.View entering={Platform.OS === 'web' ? undefined as any : (ZoomIn as any)}>
                <Star size={48} color={colors.accent} fill={colors.accent} />
              </Animated.View>
              <TouchableOpacity onPress={() => setSelectedMessage(null)}>
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>
            <Text style={[styles.messageText, { color: colors.text.primary }]}> 
              {selectedMessage?.message}
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAddMessage && isAdmin}
        animationType="fade"
        transparent
        onRequestClose={() => setShowAddMessage(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}> 
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}> 
                Add Secret Star
              </Text>
              <TouchableOpacity onPress={() => setShowAddMessage(false)}>
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { color: colors.text.primary, borderColor: colors.accent }]}
              placeholder="Enter your secret message..."
              placeholderTextColor={colors.text.secondary}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
              numberOfLines={4}
            />

            {/* Admin messages always broadcast to all users */}

            <Text style={[styles.label, { color: colors.text.secondary }]}>Unlock after (days)</Text>
            <TextInput
              style={[styles.input, { color: colors.text.primary, borderColor: colors.accent }]}
              placeholder="7"
              placeholderTextColor={colors.text.secondary}
              value={milestone}
              onChangeText={setMilestone}
              keyboardType="number-pad"
            />

            {isAdmin && (
              <>
                <Text style={[styles.label, { color: colors.text.secondary }]}>Bulk list (paste messages in "quotes") — continues after your last milestone</Text>
                <TextInput
                  style={[styles.input, { color: colors.text.primary, borderColor: colors.accent }]}
                  placeholder='e.g. "You did it!" some text "Proud of you" ...'
                  placeholderTextColor={colors.text.secondary}
                  value={bulkText}
                  onChangeText={setBulkText}
                  multiline
                  numberOfLines={4}
                />
                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: colors.accent }]}
                  onPress={addBulkMessages}
                >
                  <Text style={styles.submitButtonText}>Add List</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, { backgroundColor: '#ff4d4f' }]}
                  onPress={deleteBulkMessages}
                >
                  <Text style={styles.submitButtonText}>Delete List</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.accent }]}
              onPress={addMessage}
            >
              <Text style={styles.submitButtonText}>Create Secret</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentWeb: {
    paddingTop: 0,
    // no flex on web so ScrollView can measure full height
  },
  contentInner: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
    paddingBottom: 32,
  },
  scroll: {
    flexGrow: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  gridContainer: {
    padding: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  messageCard: {
    width: '31%',
    maxWidth: 340,
    aspectRatio: 0.88,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  addCard: {
    width: '31%',
    maxWidth: 340,
    aspectRatio: 0.88,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  milestoneText: {
    fontSize: 12,
  },
  streakBanner: {
    padding: 16,
    alignItems: 'center',
  },
  streakText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  messageText: {
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
  },
  input: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
  },
  deleteBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    padding: 6,
    zIndex: 2,
    borderRadius: 10,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: '600',
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
});

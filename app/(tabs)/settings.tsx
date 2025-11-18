import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Palette, Star, Trash2, Heart } from 'lucide-react-native';
import { OptimizedStarfield } from '@/components/OptimizedStarfield';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Theme, StarColor } from '@/types/database';

export default function SettingsScreen() {
  const {
    colors,
    theme,
    starColor,
    setTheme,
    setStarColor,
    partnerUserId,
    partnerDisplayName,
    partnerShareCode,
    updatePartnerSettings,
  } = useTheme();
  const [userId, setUserId] = useState<string | null>(null);
  const [taskCount, setTaskCount] = useState(0);
  const [partnerCodeInput, setPartnerCodeInput] = useState('');
  const [partnerNameInput, setPartnerNameInput] = useState('');
  const [linkingPartner, setLinkingPartner] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (userId) {
      loadTaskCount();
    }
  }, [userId]);

  useEffect(() => {
    setPartnerNameInput(partnerDisplayName ?? '');
  }, [partnerDisplayName]);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
    }
  };

  const broadcastTasksRefresh = async () => {
    if (!userId) return;
    try {
      const channel = supabase.channel(`tasks_sync_${userId}`);
      await channel.subscribe();
      await channel.send({ type: 'broadcast', event: 'refresh', payload: { source: 'settings' } });
      supabase.removeChannel(channel);
    } catch {}
  };

  const clearActiveTasks = async () => {
    if (!userId) return;

    Alert.alert(
      'Clear Active Tasks',
      'This will permanently delete all active (not completed) tasks from the Home starfield. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data, error } = await supabase
                .from('tasks')
                .delete()
                .eq('user_id', userId)
                .or('completed.eq.false,completed.is.null')
                .select('id');
              if (error) throw error;
              const deleted = Array.isArray(data) ? data.length : 0;
              await loadTaskCount();
              await broadcastTasksRefresh();
              if (deleted > 0) {
                Alert.alert('Done', `Cleared ${deleted} active ${deleted === 1 ? 'task' : 'tasks'}.`);
              } else {
                Alert.alert('Nothing to clear', 'No active tasks found.');
              }
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to clear active tasks.');
            }
          },
        },
      ]
    );
  };

  const clearAllTasks = async () => {
    if (!userId) return;

    Alert.alert(
      'Clear ALL Tasks',
      'This will permanently delete ALL tasks (active and completed). Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data, error } = await supabase
                .from('tasks')
                .delete()
                .eq('user_id', userId)
                .select('id');
              if (error) throw error;
              const deleted = Array.isArray(data) ? data.length : 0;
              await loadTaskCount();
              await broadcastTasksRefresh();
              if (deleted > 0) {
                Alert.alert('Done', `Cleared ${deleted} ${deleted === 1 ? 'task' : 'tasks'}.`);
              } else {
                Alert.alert('Nothing to clear', 'No tasks found.');
              }
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to clear all tasks.');
            }
          },
        },
      ]
    );
  };

  const loadTaskCount = async () => {
    if (!userId) return;

    const { count } = await supabase
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    setTaskCount(count || 0);
  };

  const saveDisplayName = async () => {
    try {
      await updatePartnerSettings({ partnerDisplayName: partnerNameInput.trim() || null });
      Alert.alert('Saved', 'Your display name has been updated.');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to save display name.');
    }
  };

  const linkPartner = async () => {
    if (!partnerCodeInput.trim()) {
      Alert.alert('Enter Code', 'Please enter your partner\'s share code.');
      return;
    }
    if (!userId) {
      Alert.alert('Not signed in', 'You must be signed in to link a partner.');
      return;
    }
    const code = partnerCodeInput.trim().toUpperCase();
    if (partnerShareCode && code === partnerShareCode) {
      Alert.alert('Invalid Code', 'That\'s your own share code. Ask your partner for theirs.');
      return;
    }

    setLinkingPartner(true);
    try {
      const { data, error } = await supabase.rpc('link_partner', { p_code: code });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data as any;
      if (!row?.linked || !row?.partner_id) {
        Alert.alert('Not found', 'No partner was found with that code.');
        return;
      }

      await updatePartnerSettings({ partnerUserId: row.partner_id });

      Alert.alert('Partner Linked', 'You are now connected!');
      setPartnerCodeInput('');
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to link partner.');
    } finally {
      setLinkingPartner(false);
    }
  };

  const unlinkPartner = async () => {
    if (!partnerUserId) {
      Alert.alert('No partner linked');
      return;
    }
    if (!userId) return;

    Alert.alert(
      'Unlink Partner',
      'This will remove the connection. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('unlink_partner');
              if (error) throw error;
              await updatePartnerSettings({ partnerUserId: null });
              Alert.alert('Done', 'Partner connection removed.');
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to unlink partner.');
            }
          },
        },
      ]
    );
  };

  const clearCompletedTasks = async () => {
    if (!userId) return;

    Alert.alert(
      'Clear Completed Tasks',
      'This will permanently delete all completed tasks. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data, error } = await supabase
                .from('tasks')
                .delete()
                .eq('user_id', userId)
                .eq('completed', true)
                .select('id');
              if (error) throw error;
              const deleted = Array.isArray(data) ? data.length : 0;
              await loadTaskCount();
              await broadcastTasksRefresh();
              if (deleted > 0) {
                Alert.alert('Done', `Cleared ${deleted} completed ${deleted === 1 ? 'task' : 'tasks'}.`);
              } else {
                Alert.alert('Nothing to clear', 'No completed tasks found.');
              }
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to clear tasks.');
            }
          },
        },
      ]
    );
  };

  const themes: { value: Theme; label: string; description: string }[] = [
    { value: 'night_sky', label: 'Night Sky', description: 'Deep midnight blue' },
    { value: 'dawn_sky', label: 'Dawn Sky', description: 'Sunrise tones' },
    { value: 'royal_purple', label: 'Royal Purple', description: 'Majestic violet' },
  ];

  const starColors: { value: StarColor; label: string }[] = [
    { value: 'gold', label: 'Gold' },
    { value: 'silver', label: 'Silver' },
    { value: 'pink', label: 'Pink' },
  ];

  return (
    <View style={styles.container}>
      <OptimizedStarfield />
      <SafeAreaView style={styles.content} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Settings</Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Heart size={24} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Partner Connection</Text>
            </View>

            <Text style={[styles.infoText, { color: colors.text.secondary }]}>Share this code with your partner so they can link to you.</Text>
            <View style={[styles.shareCodeBox, { borderColor: colors.accent }]}>
              <Text style={[styles.shareCodeText, { color: colors.text.primary }]}>{partnerShareCode ?? '...'}</Text>
            </View>

            <Text style={[styles.optionDescription, { color: colors.text.secondary, marginTop: 16 }]}>How should your partner see your name?</Text>
            <TextInput
              style={[styles.input, { color: colors.text.primary, borderColor: colors.accent }]}
              placeholder="Enter display name"
              placeholderTextColor={colors.text.secondary}
              value={partnerNameInput}
              onChangeText={setPartnerNameInput}
              onBlur={saveDisplayName}
              returnKeyType="done"
            />

            <Text style={[styles.optionDescription, { color: colors.text.secondary, marginTop: 16 }]}>Enter your partner's share code:</Text>
            <TextInput
              style={[styles.input, { color: colors.text.primary, borderColor: colors.accent }]}
              placeholder="Partner share code"
              placeholderTextColor={colors.text.secondary}
              autoCapitalize="characters"
              value={partnerCodeInput}
              onChangeText={setPartnerCodeInput}
            />

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: linkingPartner ? 0.6 : 1 }]}
              onPress={linkPartner}
              disabled={linkingPartner}
            >
              <Text style={[styles.primaryButtonText, { color: '#000' }]}>{linkingPartner ? 'Linking...' : 'Link Partner'}</Text>
            </TouchableOpacity>

            {partnerUserId && (
              <TouchableOpacity
                style={[styles.dangerButton, { borderColor: '#FF6B6B', marginTop: 12 }]}
                onPress={unlinkPartner}
              >
                <Text style={[styles.dangerButtonText, { color: '#FF6B6B' }]}>Unlink Partner</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Palette size={24} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Sky Theme</Text>
            </View>

            {themes.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[
                  styles.option,
                  theme === t.value && {
                    backgroundColor: colors.accent,
                    borderColor: colors.accent,
                  },
                ]}
                onPress={() => setTheme(t.value)}
              >
                <View>
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: theme === t.value ? '#000' : colors.text.primary },
                    ]}
                  >
                    {t.label}
                  </Text>
                  <Text
                    style={[
                      styles.optionDescription,
                      { color: theme === t.value ? '#000' : colors.text.secondary },
                    ]}
                  >
                    {t.description}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Star size={24} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Central Star Color</Text>
            </View>

            <View style={styles.colorRow}>
              {starColors.map((color) => (
                <TouchableOpacity
                  key={color.value}
                  style={[
                    styles.colorOption,
                    starColor === color.value && { borderColor: colors.accent, borderWidth: 3 },
                  ]}
                  onPress={() => setStarColor(color.value)}
                >
                  <View
                    style={[
                      styles.colorCircle,
                      {
                        backgroundColor:
                          color.value === 'gold'
                            ? '#FFD700'
                            : color.value === 'silver'
                            ? '#C0C0C0'
                            : '#FFB6C1',
                      },
                    ]}
                  />
                  <Text style={[styles.colorLabel, { color: colors.text.secondary }]}>
                    {color.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.card }]}>
            <View style={styles.sectionHeader}>
              <Trash2 size={24} color={colors.accent} />
              <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>Data Management</Text>
            </View>

            <Text style={[styles.infoText, { color: colors.text.secondary }]}>Total tasks: {taskCount}</Text>

            <TouchableOpacity
              style={[styles.dangerButton, { borderColor: '#FF6B6B' }]}
              onPress={clearCompletedTasks}
            >
              <Text style={[styles.dangerButtonText, { color: '#FF6B6B' }]}>Clear Completed Tasks</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dangerButton, { borderColor: '#FF6B6B', marginTop: 12 }]}
              onPress={clearActiveTasks}
            >
              <Text style={[styles.dangerButtonText, { color: '#FF6B6B' }]}>Clear Active Tasks (Home)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.dangerButton, { borderColor: '#FF6B6B', marginTop: 12 }]}
              onPress={clearAllTasks}
            >
              <Text style={[styles.dangerButtonText, { color: '#FF6B6B' }]}>Clear ALL Tasks</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.text.secondary }]}>Stella's Sky </Text>
            <Text style={[styles.footerText, { color: colors.text.secondary }]}>Version 1.0.0</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
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
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  section: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  shareCodeBox: {
    borderWidth: 2,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareCodeText: {
    fontSize: 20,
    letterSpacing: 4,
    fontWeight: 'bold',
  },
  option: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 16,
  },
  colorOption: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  colorLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 16,
    marginBottom: 16,
  },
  dangerButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  input: {
    marginTop: 8,
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  primaryButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 14,
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

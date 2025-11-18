import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Line, Circle } from 'react-native-svg';
import { Flame } from 'lucide-react-native';
import { OptimizedStarfield } from '@/components/OptimizedStarfield';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Task } from '@/types/database';
import { MoodTracker } from '@/components/MoodTracker';
import { useFocusEffect } from '@react-navigation/native';
import { getCurrentStreak } from '@/utils/streakUtils';

export default function ConstellationScreen() {
  const { colors } = useTheme();
  const [currentStreak, setCurrentStreak] = useState(0);
  const [weeklyTasks, setWeeklyTasks] = useState<Task[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'mood'>('overview');

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    if (userId) {
      loadStreakData();
      loadWeeklyTasks();
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadStreakData();
        loadWeeklyTasks();
      }
      return () => {};
    }, [userId])
  );

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`tasks_sync_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks', filter: `user_id=eq.${userId}` },
        () => {
          loadStreakData();
          loadWeeklyTasks();
        }
      )
      .on('broadcast', { event: 'refresh' }, () => {
        loadStreakData();
        loadWeeklyTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const loadUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user?.id) setUserId(sessionData.session.user.id);
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id ?? null);
    });
    // Clean it up when component unmounts
    return () => {
      authListener.subscription.unsubscribe();
    };
  };

  const loadStreakData = async () => {
    if (!userId) return;
    const streak = await getCurrentStreak(userId);
    setCurrentStreak(streak);
  };

  const loadWeeklyTasks = async () => {
    if (!userId) return;

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', true)
      .gte('completed_at', weekStart.toISOString())
      .order('completed_at', { ascending: true });

    if (data) {
      setWeeklyTasks(data);
    }
  };

  const renderConstellation = () => {
    if (weeklyTasks.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: colors.text.secondary }]}>
            Complete tasks to form your constellation
          </Text>
        </View>
      );
    }

    const points = weeklyTasks.map((task, index) => {
      const angle = (index / weeklyTasks.length) * Math.PI * 2;
      const radius = 80;
      return {
        x: 150 + Math.cos(angle) * radius,
        y: 150 + Math.sin(angle) * radius,
        id: task.id,
      };
    });

    return (
      <Svg width={300} height={300}>
        {points.map((point, index) => {
          if (index < points.length - 1) {
            const nextPoint = points[index + 1];
            return (
              <Line
                key={`line-${index}`}
                x1={point.x}
                y1={point.y}
                x2={nextPoint.x}
                y2={nextPoint.y}
                stroke={colors.accent}
                strokeWidth="2"
                opacity={0.6}
              />
            );
          }
          return null;
        })}
        {points.map((point, index) => (
          <Circle
            key={`star-${point.id}`}
            cx={point.x}
            cy={point.y}
            r={6}
            fill={colors.accent}
          />
        ))}
      </Svg>
    );
  };

  return (
    <View style={styles.container}>
      <OptimizedStarfield />
      <SafeAreaView style={styles.content} edges={['top']}>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && { borderBottomColor: colors.accent, borderBottomWidth: 3 }]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'overview' ? colors.accent : colors.text.secondary }]}>Overview</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'mood' && { borderBottomColor: colors.accent, borderBottomWidth: 3 }]}
            onPress={() => setActiveTab('mood')}
          >
            <Text style={[styles.tabText, { color: activeTab === 'mood' ? colors.accent : colors.text.secondary }]}>Share Mood 💭</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'overview' ? (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text.primary }]}>Your Constellation</Text>
            </View>

            <View style={[styles.streakCard, { backgroundColor: colors.card }]}>
              <View style={styles.streakHeader}>
                <Flame size={32} color={colors.accent} />
                <Text style={[styles.streakNumber, { color: colors.accent }]}>{currentStreak}</Text>
              </View>
              <Text style={[styles.streakLabel, { color: colors.text.secondary }]}>Day Streak</Text>
            </View>

            <View style={styles.constellationContainer}>{renderConstellation()}</View>

            <View style={[styles.statsCard, { backgroundColor: colors.card }]}>
              <Text style={[styles.statsTitle, { color: colors.text.primary }]}>This Week</Text>
              <Text style={[styles.statsNumber, { color: colors.accent }]}>{weeklyTasks.length}</Text>
              <Text style={[styles.statsLabel, { color: colors.text.secondary }]}>Stars Completed</Text>
            </View>

            {weeklyTasks.length > 0 && (
              <View style={[styles.tasksCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.tasksCardTitle, { color: colors.text.primary }]}>Completed Tasks ✨</Text>
                {weeklyTasks.map((task) => (
                  <View key={task.id} style={styles.taskItem}>
                    <Text style={[styles.taskTitle, { color: colors.accent }]}>⭐</Text>
                    <View style={styles.taskInfo}>
                      <Text style={[styles.taskTitle, { color: colors.text.primary }]}>{task.title}</Text>
                      <Text style={[styles.taskTime, { color: colors.text.secondary }]}>
                        {new Date(task.completed_at!).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <MoodTracker />
          </ScrollView>
        )}
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
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  streakCard: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    width: '100%',
    marginBottom: 32,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  streakNumber: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  streakLabel: {
    fontSize: 18,
  },
  constellationContainer: {
    marginBottom: 32,
    alignItems: 'center',
  },
  emptyState: {
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    textAlign: 'center',
  },
  statsCard: {
    padding: 24,
    borderRadius: 20,
    alignItems: 'center',
    width: '100%',
  },
  statsTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  statsNumber: {
    fontSize: 56,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statsLabel: {
    fontSize: 16,
  },
  tasksCard: {
    padding: 20,
    borderRadius: 20,
    width: '100%',
    marginTop: 20,
  },
  tasksCardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  taskInfo: {
    flex: 1,
    marginLeft: 12,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  taskTime: {
    fontSize: 14,
    marginTop: 4,
  },
  tabContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
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

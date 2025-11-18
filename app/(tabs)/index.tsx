import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, X } from 'lucide-react-native';
import { OptimizedStarfield } from '@/components/OptimizedStarfield';
import { TaskDetailModal } from '@/components/TaskDetailModal';
import { CompletionMessage } from '@/components/CompletionMessage';
import { CentralStar } from '@/components/CentralStar';
import { TaskStar } from '@/components/TaskStar';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/lib/supabase';
import { Task, Priority } from '@/types/database';
import { updateDailyStreak, checkMilestoneUnlocks } from '@/utils/streakUtils';
import { sendTaskCompletionNotification } from '@/utils/notificationService';
import { useFocusEffect } from '@react-navigation/native';

export default function HomeScreen() {
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<Priority>('medium');
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showCompletionMessage, setShowCompletionMessage] = useState(false);
  const [completionText, setCompletionText] = useState<string | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (userId) {
      loadTasks();
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      if (userId) {
        loadTasks();
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
          loadTasks();
        }
      )
      .on('broadcast', { event: 'refresh' }, () => {
        loadTasks();
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
  };

  const loadTasks = async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (data) {
      setTasks(data);
    }
  };

  const addTask = async () => {
    if (!newTaskTitle.trim() || !userId) return;

    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: userId,
        title: newTaskTitle,
        priority: selectedPriority,
      })
      .select()
      .single();

    if (data) {
      setTasks([...tasks, data]);
      setNewTaskTitle('');
      setSelectedPriority('medium');
      setShowAddTask(false);
    }
  };

  const toggleTask = async (task: Task) => {
    const newCompleted = !task.completed;
    const { data, error } = await supabase
      .from('tasks')
      .update({
        completed: newCompleted,
        completed_at: newCompleted ? new Date().toISOString() : null,
      })
      .eq('id', task.id)
      .select()
      .single();

    if (data) {
      setTasks(tasks.map((t) => (t.id === task.id ? data : t)));

      if (userId) {
        await updateDailyStreak(userId);
      }

      // Show completion message when task is completed
      if (newCompleted) {
        if (userId) {
          // Re-run unlocks (days/tasks). Then show the most recently unlocked message.
          await checkMilestoneUnlocks(userId);
          const { data: last } = await supabase
            .from('hidden_messages')
            .select('message, unlocked_at')
            .eq('user_id', userId)
            .eq('unlocked', true)
            .order('unlocked_at', { ascending: false })
            .limit(1);
          if (last && last.length > 0) setCompletionText(last[0].message as string);
        }

        setShowCompletionMessage(true);
        if (userId) {
          await sendTaskCompletionNotification(userId, task.title);
        }
      }
    }
  };

  const completedCount = tasks.filter((t) => t.completed).length;
  const activeCount = tasks.filter((t) => !t.completed).length;

  return (
    <View style={styles.container}>
      <OptimizedStarfield />
      <CompletionMessage
        visible={showCompletionMessage}
        onHide={() => {
          setShowCompletionMessage(false);
          setCompletionText(null);
        }}
        text={completionText ?? undefined}
      />
      <SafeAreaView style={styles.content} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text.primary }]}>Stella's Sky ✨</Text>
          <Text style={[styles.subtitle, { color: colors.text.secondary }]}> 
            {completedCount}/{tasks.length} stars shining
          </Text>
        </View>

        <View style={styles.starContainer}>
          <CentralStar />
          {tasks.map((task, index) => (
            <TaskStar
              key={task.id}
              task={task}
              index={index}
              total={tasks.length}
              onPress={() => setSelectedTask(task)}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.accent }]}
          onPress={() => setShowAddTask(true)}
        >
          <Plus size={32} color="#000" />
        </TouchableOpacity>
      </SafeAreaView>

      <Modal
        visible={showAddTask}
        animationType="fade"
        transparent
        onRequestClose={() => setShowAddTask(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text.primary }]}>Add New Star</Text>
              <TouchableOpacity onPress={() => setShowAddTask(false)}>
                <X size={24} color={colors.text.primary} />
              </TouchableOpacity>
            </View>

            <TextInput
              style={[styles.input, { color: colors.text.primary, borderColor: colors.accent }]}
              placeholder="What needs to shine today?"
              placeholderTextColor={colors.text.secondary}
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
              autoFocus
            />

            <Text style={[styles.label, { color: colors.text.secondary }]}>Priority</Text>
            <View style={styles.priorityRow}>
              {(['low', 'medium', 'high'] as Priority[]).map((priority) => (
                <TouchableOpacity
                  key={priority}
                  style={[
                    styles.priorityButton,
                    selectedPriority === priority && {
                      backgroundColor: colors.accent,
                      borderColor: colors.accent,
                    },
                  ]}
                  onPress={() => setSelectedPriority(priority)}
                >
                  <Text
                    style={[
                      styles.priorityText,
                      { color: selectedPriority === priority ? '#000' : colors.text.primary },
                    ]}
                  >
                    {priority.charAt(0).toUpperCase() + priority.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: colors.accent }]}
              onPress={addTask}
            >
              <Text style={styles.submitButtonText}>Create Star</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TaskDetailModal
        task={selectedTask}
        visible={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
        onToggleComplete={() => selectedTask && toggleTask(selectedTask)}
      />
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
  },
  starContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButton: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
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
  input: {
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    marginBottom: 12,
    fontWeight: '600',
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  priorityButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  priorityText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
});

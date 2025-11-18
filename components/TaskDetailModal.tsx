import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { X, CheckCircle, Circle } from 'lucide-react-native';
import { Task } from '@/types/database';
import { useTheme } from '@/contexts/ThemeContext';

interface TaskDetailModalProps {
  task: Task | null;
  visible: boolean;
  onClose: () => void;
  onToggleComplete: () => void;
}

const { width } = Dimensions.get('window');

export function TaskDetailModal({
  task,
  visible,
  onClose,
  onToggleComplete,
}: TaskDetailModalProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(0.9);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      scale.value = withSpring(1, { damping: 15 });
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      scale.value = withTiming(0.9, { duration: 150 });
    }
  }, [visible]);

  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const animatedModalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  if (!task) return null;

  const priorityColors = {
    high: '#FF6B6B',
    medium: '#FFD93D',
    low: '#6BCB77',
  };

  const priorityColor = priorityColors[task.priority as keyof typeof priorityColors] || priorityColors.medium;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, animatedOverlayStyle]}>
        <TouchableOpacity
          style={StyleSheet.absoluteFillObject}
          activeOpacity={1}
          onPress={onClose}
        />
        <Animated.View
          style={[
            styles.modalContent,
            { backgroundColor: colors.card },
            animatedModalStyle,
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text.primary }]}>
              Task Details
            </Text>
            <TouchableOpacity onPress={onClose}>
              <X size={24} color={colors.text.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            <Text style={[styles.taskTitle, { color: colors.text.primary }]}>
              {task.title}
            </Text>

            <View style={styles.priorityContainer}>
              <View
                style={[
                  styles.priorityBadge,
                  { backgroundColor: priorityColor + '20', borderColor: priorityColor },
                ]}
              >
                <Text style={[styles.priorityText, { color: priorityColor }]}>
                  {task.priority.toUpperCase()} PRIORITY
                </Text>
              </View>
            </View>

            {task.completed_at && (
              <Text style={[styles.completedText, { color: colors.text.secondary }]}>
                Completed: {new Date(task.completed_at).toLocaleDateString()}
              </Text>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.completeButton,
              {
                backgroundColor: task.completed ? colors.accent : 'transparent',
                borderColor: colors.accent,
              },
            ]}
            onPress={() => {
              onToggleComplete();
              setTimeout(onClose, 300);
            }}
          >
            {task.completed ? (
              <CheckCircle size={24} color="#000" />
            ) : (
              <Circle size={24} color={colors.accent} />
            )}
            <Text
              style={[
                styles.buttonText,
                { color: task.completed ? '#000' : colors.accent },
              ]}
            >
              {task.completed ? 'Completed ✨' : 'Mark as Complete'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: width - 40,
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  body: {
    marginBottom: 24,
  },
  taskTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  priorityContainer: {
    marginBottom: 16,
  },
  priorityBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 2,
  },
  priorityText: {
    fontSize: 12,
    fontWeight: '700',
  },
  completedText: {
    fontSize: 14,
    marginTop: 8,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});

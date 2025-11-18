import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { Task } from '@/types/database';
import { useTheme } from '@/contexts/ThemeContext';

const { width, height } = Dimensions.get('window');
const ORBIT_RADIUS = 120;

interface TaskStarProps {
  task: Task;
  index: number;
  total: number;
  onPress: () => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function getStarSize(priority: string): number {
  switch (priority) {
    case 'high':
      return 32;
    case 'medium':
      return 24;
    case 'low':
      return 18;
    default:
      return 24;
  }
}

export function TaskStar({ task, index, total, onPress }: TaskStarProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(task.completed ? 1 : 0.6);

  const angle = (index / total) * Math.PI * 2;
  const x = Math.cos(angle) * ORBIT_RADIUS;
  const y = Math.sin(angle) * ORBIT_RADIUS;

  const starSize = getStarSize(task.priority);

  useEffect(() => {
    if (task.completed) {
      scale.value = withSequence(
        withSpring(1.5, { damping: 5 }),
        withSpring(1)
      );
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      opacity.value = withTiming(0.6, { duration: 300 });
    }
  }, [task.completed]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const starColor = task.completed ? colors.accent : '#FFFFFF';

  return (
    <AnimatedTouchable
      style={[
        styles.star,
        {
          left: width / 2 + x - starSize / 2,
          top: height / 2 + y - starSize / 2,
        },
        animatedStyle,
      ]}
      onPress={onPress}
    >
      <Svg width={starSize} height={starSize}>
        <Defs>
          <RadialGradient id={`taskGradient-${task.id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={starColor} stopOpacity="1" />
            <Stop offset="70%" stopColor={starColor} stopOpacity="0.5" />
            <Stop offset="100%" stopColor={starColor} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle
          cx={starSize / 2}
          cy={starSize / 2}
          r={starSize / 2}
          fill={`url(#taskGradient-${task.id})`}
        />
        <Circle cx={starSize / 2} cy={starSize / 2} r={starSize / 4} fill={starColor} />
      </Svg>
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
  },
});

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import messages from '@/data/messages.json';
import { supabase } from '@/lib/supabase';

interface CompletionMessageProps {
  visible: boolean;
  onHide: () => void;
  text?: string;
}

const { width, height } = Dimensions.get('window');

export function CompletionMessage({ visible, onHide, text }: CompletionMessageProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-50);
  const starScale = useSharedValue(0);
  const starRotate = useSharedValue(0);
  const [pool, setPool] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('hidden_messages')
        .select('message, unlocked')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (data && data.length) {
        const unlocked = data.filter((m) => m.unlocked).map((m) => m.message);
        const all = data.map((m) => m.message);
        setPool(unlocked.length ? unlocked : all);
      }
    })();
  }, []);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('hidden_messages')
        .select('message, unlocked')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (data && data.length) {
        const unlocked = data.filter((m) => m.unlocked).map((m) => m.message);
        const all = data.map((m) => m.message);
        setPool(unlocked.length ? unlocked : all);
      }
    })();
  }, [visible]);

  useEffect(() => {
    if (visible) {
      // Show animation
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSpring(1, { damping: 12 });
      translateY.value = withSpring(0, { damping: 10 });

      // Star sparkle animation
      starScale.value = withSequence(
        withDelay(200, withSpring(1.2, { damping: 8 })),
        withSpring(1, { damping: 10 })
      );
      starRotate.value = withSequence(
        withTiming(360, { duration: 600, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 0 })
      );

      // Auto hide after 3 seconds
      opacity.value = withDelay(
        2700,
        withTiming(0, { duration: 300 }, () => {
          runOnJS(onHide)();
        })
      );
      scale.value = withDelay(2700, withTiming(0.8, { duration: 300 }));
      translateY.value = withDelay(2700, withTiming(50, { duration: 300 }));
    } else {
      scale.value = 0;
      opacity.value = 0;
      translateY.value = -50;
      starScale.value = 0;
      starRotate.value = 0;
    }
  }, [visible]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  const animatedStarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: starScale.value }, { rotate: `${starRotate.value}deg` }],
  }));

  if (!visible) return null;

  const defaultText = messages.taskCompletion[
    Math.floor(Math.random() * messages.taskCompletion.length)
  ]?.message;
  const displayText = text
    ? text
    : pool.length
      ? pool[Math.floor(Math.random() * pool.length)]
      : defaultText;

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View style={[styles.container, animatedContainerStyle]}>
        <LinearGradient
          colors={['rgba(255, 215, 0, 0.3)', 'rgba(255, 255, 255, 0.1)']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Animated.Text style={[styles.star, animatedStarStyle]}>✨</Animated.Text>
          <Text style={styles.message}>{displayText}</Text>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  container: {
    width: width - 60,
    maxWidth: 350,
  },
  gradient: {
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.5)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 10,
  },
  star: {
    fontSize: 48,
    marginBottom: 12,
  },
  message: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});

import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  useSharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  duration: number;
}

// Reduced star count for better performance
const NUM_STARS = 30;

function generateStars(): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < NUM_STARS; i++) {
    stars.push({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 0.5,
      opacity: Math.random() * 0.5 + 0.3,
      duration: Math.random() * 2000 + 2000,
    });
  }
  return stars;
}

// Memoized individual star component
const TwinklingStar = React.memo(({ star }: { star: Star }) => {
  const opacity = useSharedValue(star.opacity);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: star.duration, easing: Easing.inOut(Easing.ease) }),
        withTiming(star.opacity, { duration: star.duration, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.star,
        {
          left: `${star.x}%`,
          top: `${star.y}%`,
          width: star.size,
          height: star.size,
        },
        animatedStyle,
      ]}
    />
  );
});

TwinklingStar.displayName = 'TwinklingStar';

export function OptimizedStarfield() {
  const { colors } = useTheme();
  
  // Memoize stars to prevent regeneration on re-renders
  const stars = useMemo(() => generateStars(), []);

  return (
    <View style={styles.container} pointerEvents="none">
      <LinearGradient
        colors={[colors.background.start, colors.background.end]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <View style={styles.starsContainer}>
        {stars.map((star) => (
          <TwinklingStar key={star.id} star={star} />
        ))}
      </View>
      <View style={[styles.nebula, { backgroundColor: colors.nebula }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  starsContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
  },
  nebula: {
    position: 'absolute',
    top: '20%',
    left: '10%',
    width: '80%',
    height: '60%',
    borderRadius: 300,
    opacity: 0.2,
  },
});

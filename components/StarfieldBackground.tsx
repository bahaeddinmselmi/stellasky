import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '@/contexts/ThemeContext';

interface Star {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
}

const NUM_STARS = 50;

function generateStars(): Star[] {
  const stars: Star[] = [];
  for (let i = 0; i < NUM_STARS; i++) {
    stars.push({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      delay: Math.random() * 2000,
    });
  }
  return stars;
}

function TwinklingStar({ star }: { star: Star }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    setTimeout(() => {
      opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 1000 + Math.random() * 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.3, { duration: 1000 + Math.random() * 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }, star.delay);
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
}

export function StarfieldBackground() {
  const { colors } = useTheme();
  const starsRef = useRef<Star[]>(generateStars());

  return (
    <View style={styles.container} pointerEvents="none">
      <LinearGradient
        colors={[colors.background.start, colors.background.end]}
        style={styles.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
      />
      <View style={styles.starsContainer}>
        {starsRef.current.map((star) => (
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
    opacity: 0.3,
  },
});

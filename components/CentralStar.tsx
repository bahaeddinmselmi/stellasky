import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';

 

export function CentralStar() {
  const { centralStarColor } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.9);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );

    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.star, animatedStyle]}>
      <Svg width={120} height={120}>
        <Defs>
          <RadialGradient id="starGradient" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={centralStarColor} stopOpacity="1" />
            <Stop offset="50%" stopColor={centralStarColor} stopOpacity="0.6" />
            <Stop offset="100%" stopColor={centralStarColor} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="60" cy="60" r="60" fill="url(#starGradient)" />
        <Circle cx="60" cy="60" r="20" fill={centralStarColor} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  star: {
    position: 'absolute',
  },
});

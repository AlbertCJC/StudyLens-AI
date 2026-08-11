import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

const COLORS = ['#6366f1', '#f97316', '#22c55e', '#eab308', '#f43f5e', '#0ea5e9', '#a855f7'];

interface Particle {
  x: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
  drift: number;
}

function buildParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * 100,
    delay: Math.random() * 600,
    duration: 1400 + Math.random() * 1000,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 8,
    drift: (Math.random() - 0.5) * 60,
  }));
}

export const ConfettiEffect: React.FC<{ trigger: boolean }> = ({ trigger }) => {
  const progress = useRef(new Animated.Value(0)).current;
  const particles = useRef<Particle[]>([]).current;

  useEffect(() => {
    if (trigger) {
      particles.length = 0;
      particles.push(...buildParticles(48));
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: 2200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  if (!trigger) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => {
        const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-40, 620 + (i % 3) * 80] });
        const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] });
        const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${i % 2 === 0 ? 360 : -360}deg`] });
        const opacity = progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              left: `${p.x}%`,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
};
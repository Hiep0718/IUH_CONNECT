import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors, BorderRadius, Spacing } from '../theme/theme';

interface TypingIndicatorProps {
  isVisible: boolean;
}

const TypingIndicator: React.FC<TypingIndicatorProps> = ({ isVisible }) => {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.timing(containerOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      const createDotAnimation = (dot: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(dot, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true,
            }),
            Animated.delay(600 - delay),
          ]),
        );

      const anim1 = createDotAnimation(dot1, 0);
      const anim2 = createDotAnimation(dot2, 150);
      const anim3 = createDotAnimation(dot3, 300);

      anim1.start();
      anim2.start();
      anim3.start();

      return () => {
        anim1.stop();
        anim2.stop();
        anim3.stop();
      };
    } else {
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const renderDot = (dotAnim: Animated.Value) => (
    <Animated.View
      style={[
        styles.dot,
        {
          transform: [
            {
              translateY: dotAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -6],
              }),
            },
            {
              scale: dotAnim.interpolate({
                inputRange: [0, 0.5, 1],
                outputRange: [1, 1.2, 1],
              }),
            },
          ],
          opacity: dotAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0.4, 1],
          }),
        },
      ]}
    />
  );

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <View style={styles.bubble}>
        {renderDot(dot1)}
        {renderDot(dot2)}
        {renderDot(dot3)}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingLeft: Spacing.lg,
    paddingBottom: Spacing.sm,
    alignItems: 'flex-start',
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.chatBubbleReceived,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderBottomLeftRadius: BorderRadius.xs,
    gap: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textMuted,
  },
});

export default TypingIndicator;

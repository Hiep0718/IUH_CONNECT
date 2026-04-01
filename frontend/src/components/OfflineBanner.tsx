import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius } from '../theme/theme';

interface OfflineBannerProps {
  isOffline: boolean;
  onRetry?: () => void;
}

const OfflineBanner: React.FC<OfflineBannerProps> = ({ isOffline, onRetry }) => {
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isOffline) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 12,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Pulse animation for icon
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -60,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isOffline]);

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[
        styles.wrapper,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <LinearGradient
        colors={['#FF9800', '#F57C00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.container}
      >
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Icon name="wifi-off" size={18} color={Colors.white} />
        </Animated.View>
        <Text style={styles.text}>Không có kết nối mạng</Text>
        {onRetry && (
          <TouchableOpacity onPress={onRetry} style={styles.retryButton} activeOpacity={0.7}>
            <Icon name="refresh" size={16} color="#FF9800" />
            <Text style={styles.retryText}>Thử lại</Text>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  text: {
    color: Colors.white,
    fontSize: Typography.caption,
    fontWeight: Typography.semiBold,
    flex: 1,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
    gap: 4,
  },
  retryText: {
    fontSize: Typography.tiny,
    fontWeight: Typography.bold,
    color: '#F57C00',
  },
});

export default OfflineBanner;

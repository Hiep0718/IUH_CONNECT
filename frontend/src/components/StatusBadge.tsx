import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, BorderRadius, Spacing } from '../theme/theme';
import type { LecturerStatus } from '../types/types';

interface StatusBadgeProps {
  status: LecturerStatus;
  compact?: boolean;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, compact = false }) => {
  const isAvailable = status === 'available';
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isAvailable) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isAvailable]);

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: isAvailable ? Colors.successSoft : Colors.dangerSoft,
        },
        compact && styles.badgeCompact,
      ]}
    >
      <View style={styles.dotWrapper}>
        {isAvailable && (
          <Animated.View
            style={[
              styles.dotPulse,
              {
                backgroundColor: Colors.onlineGlow,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        )}
        <View
          style={[
            styles.dot,
            {
              backgroundColor: isAvailable ? Colors.success : Colors.danger,
            },
            compact && styles.dotCompact,
          ]}
        />
      </View>
      {!compact && (
        <View style={styles.textRow}>
          <Text
            style={[
              styles.text,
              {
                color: isAvailable ? Colors.success : Colors.danger,
              },
            ]}
          >
            {isAvailable ? 'Sẵn sàng' : 'Đang bận'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.round,
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dotWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    width: 10,
    height: 10,
  },
  dotPulse: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotCompact: {
    width: 5,
    height: 5,
  },
  textRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  text: {
    fontSize: Typography.tiny,
    fontWeight: Typography.semiBold,
  },
});

export default StatusBadge;

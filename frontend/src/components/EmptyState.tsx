import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius } from '../theme/theme';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
}) => {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.iconContainer,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={styles.iconCircle}>
          <Icon name={icon} size={48} color={Colors.primary} />
        </View>
      </Animated.View>

      <Animated.View style={[styles.textContainer, { opacity: fadeAnim }]}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}

        {actionLabel && onAction && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={onAction}
            activeOpacity={0.7}
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.gigantic,
    paddingHorizontal: Spacing.xxxl,
  },
  iconContainer: {
    marginBottom: Spacing.xxl,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primaryGhost,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: Typography.h4,
    fontWeight: Typography.semiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: Typography.bodySmall * Typography.lineHeightRelaxed,
  },
  actionButton: {
    marginTop: Spacing.xxl,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.round,
  },
  actionText: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.semiBold,
    color: Colors.white,
  },
});

export default EmptyState;

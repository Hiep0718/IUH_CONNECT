import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing } from '../theme/theme';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  accentColor?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  actionLabel,
  onAction,
  accentColor = Colors.primary,
}) => (
  <View style={styles.container}>
    <View style={styles.titleRow}>
      <View style={[styles.accentLine, { backgroundColor: accentColor }]} />
      <Text style={styles.title}>{title}</Text>
    </View>
    {actionLabel && onAction && (
      <TouchableOpacity onPress={onAction} activeOpacity={0.6}>
        <Text style={[styles.action, { color: accentColor }]}>{actionLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  accentLine: {
    width: 3,
    height: 16,
    borderRadius: 2,
  },
  title: {
    fontSize: Typography.caption,
    fontWeight: Typography.bold,
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: Typography.letterSpacingWide,
  },
  action: {
    fontSize: Typography.caption,
    fontWeight: Typography.semiBold,
  },
});

export default SectionHeader;

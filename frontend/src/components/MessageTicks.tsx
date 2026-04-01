import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme/theme';
import type { MessageStatus } from '../types/types';

interface MessageTicksProps {
  status: MessageStatus;
  size?: number;
}

const MessageTicks: React.FC<MessageTicksProps> = ({ status, size = 16 }) => {
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [status]);

  const getIcon = () => {
    switch (status) {
      case 'sending':
        return <Icon name="clock-outline" size={size - 2} color={Colors.textMuted} />;
      case 'sent':
        return <Icon name="check" size={size} color={Colors.textSecondary} />;
      case 'delivered':
        return <Icon name="check-all" size={size} color={Colors.textSecondary} />;
      case 'read':
        return <Icon name="check-all" size={size} color={Colors.accent} />;
      case 'failed':
        return <Icon name="alert-circle-outline" size={size} color={Colors.danger} />;
      default:
        return null;
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      {getIcon()}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
});

export default MessageTicks;

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Avatar from './Avatar';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NOTIFICATION_HEIGHT = 90;
const AUTO_DISMISS_MS = 4000;

export interface InAppNotificationData {
  id: string;
  title: string;
  body: string;
  senderName?: string;
  icon?: string;           // MaterialCommunityIcons name
  iconColor?: string;
  type: 'chat' | 'contact' | 'system';
  onPress?: () => void;
}

interface InAppNotificationProps {
  notification: InAppNotificationData | null;
  onDismiss: () => void;
}

const InAppNotification: React.FC<InAppNotificationProps> = ({
  notification,
  onDismiss,
}) => {
  const translateY = useRef(new Animated.Value(-NOTIFICATION_HEIGHT - 50)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const isShowingRef = useRef(false);

  const hide = useCallback(() => {
    if (!isShowingRef.current) return;
    isShowingRef.current = false;
    clearTimeout(timerRef.current);

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -NOTIFICATION_HEIGHT - 50,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss();
    });
  }, [onDismiss, opacity, translateY]);

  useEffect(() => {
    if (notification) {
      isShowingRef.current = true;
      clearTimeout(timerRef.current);

      // Slide down
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: Platform.OS === 'ios' ? 50 : 10,
          tension: 80,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss
      timerRef.current = setTimeout(() => {
        hide();
      }, AUTO_DISMISS_MS);
    }

    return () => {
      clearTimeout(timerRef.current);
    };
  }, [notification, hide, opacity, translateY]);

  if (!notification) return null;

  const getIconForType = () => {
    if (notification.icon) return notification.icon;
    switch (notification.type) {
      case 'chat': return 'chat';
      case 'contact': return 'account-plus';
      case 'system': return 'bell';
      default: return 'bell';
    }
  };

  const getGradientForType = (): [string, string] => {
    switch (notification.type) {
      case 'chat': return ['#0066B3', '#004A82'];
      case 'contact': return ['#4CAF50', '#2E7D32'];
      case 'system': return ['#FF9800', '#F57C00'];
      default: return ['#0066B3', '#004A82'];
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity
        style={styles.touchable}
        activeOpacity={0.9}
        onPress={() => {
          hide();
          notification.onPress?.();
        }}
      >
        <LinearGradient
          colors={['#FFFFFF', '#F8FAFC']}
          style={styles.gradient}
        >
          {/* Left accent bar */}
          <LinearGradient
            colors={getGradientForType()}
            style={styles.accentBar}
          />

          {/* Avatar / Icon */}
          <View style={styles.iconSection}>
            {notification.senderName ? (
              <Avatar name={notification.senderName} size="small" />
            ) : (
              <LinearGradient
                colors={getGradientForType()}
                style={styles.iconCircle}
              >
                <Icon name={getIconForType()} size={18} color={Colors.white} />
              </LinearGradient>
            )}
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={styles.body} numberOfLines={2}>
              {notification.body}
            </Text>
          </View>

          {/* Dismiss */}
          <TouchableOpacity
            style={styles.dismissButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={hide}
          >
            <Icon name="close" size={16} color={Colors.textMuted} />
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    paddingHorizontal: Spacing.md,
  },
  touchable: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingRight: Spacing.md,
    paddingLeft: 0,
    minHeight: 68,
  },
  accentBar: {
    width: 4,
    alignSelf: 'stretch',
    borderTopLeftRadius: BorderRadius.xl,
    borderBottomLeftRadius: BorderRadius.xl,
  },
  iconSection: {
    marginLeft: Spacing.md,
    marginRight: Spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  body: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  dismissButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default InAppNotification;

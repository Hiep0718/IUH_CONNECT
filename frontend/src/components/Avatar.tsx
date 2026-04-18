import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Colors, BorderRadius, Shadows } from '../theme/theme';

interface AvatarProps {
  uri?: string;
  name?: string;
  size?: 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge';
  isOnline?: boolean;
  showOnlineStatus?: boolean;
  showGradientRing?: boolean;
}

const SIZES = {
  small: 36,
  medium: 48,
  large: 56,
  xlarge: 100,
  xxlarge: 120,
};

const DOT_SIZES = {
  small: 10,
  medium: 13,
  large: 15,
  xlarge: 20,
  xxlarge: 24,
};

const FONT_SIZES = {
  small: 13,
  medium: 17,
  large: 20,
  xlarge: 34,
  xxlarge: 40,
};

const RING_WIDTHS = {
  small: 2,
  medium: 2.5,
  large: 3,
  xlarge: 3.5,
  xxlarge: 4,
};

const getInitials = (name?: string): string => {
  const safeName = name || '?';
  const parts = safeName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return safeName.substring(0, 2).toUpperCase();
};

const AVATAR_GRADIENTS: [string, string][] = [
  ['#667EEA', '#764BA2'],
  ['#FF6B6B', '#FF8E53'],
  ['#4FACFE', '#00F2FE'],
  ['#43E97B', '#38F9D7'],
  ['#FA709A', '#FEE140'],
  ['#A18CD1', '#FBC2EB'],
  ['#F093FB', '#F5576C'],
  ['#4481EB', '#04BEFE'],
  ['#0066B3', '#00A8FF'],
  ['#FF9A9E', '#FECFEF'],
  ['#A1C4FD', '#C2E9FB'],
  ['#D4FC79', '#96E6A1'],
];

const getGradientFromName = (name?: string): [string, string] => {
  const safeName = name || '';
  let hash = 0;
  for (let i = 0; i < safeName.length; i++) {
    hash = safeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_GRADIENTS[Math.abs(hash) % AVATAR_GRADIENTS.length];
};

const Avatar: React.FC<AvatarProps> = ({
  uri,
  name,
  size = 'medium',
  isOnline = false,
  showOnlineStatus = false,
  showGradientRing = false,
}) => {
  const avatarSize = SIZES[size];
  const dotSize = DOT_SIZES[size];
  const fontSize = FONT_SIZES[size];
  const ringWidth = RING_WIDTHS[size];
  const gradient = getGradientFromName(name);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Online pulse animation
  useEffect(() => {
    if (isOnline && showOnlineStatus) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.4,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [isOnline, showOnlineStatus]);

  const totalSize = showGradientRing ? avatarSize + ringWidth * 2 + 4 : avatarSize;

  const renderAvatarContent = () => {
    const innerSize = showGradientRing ? avatarSize - 4 : avatarSize;

    if (uri) {
      return (
        <Image
          source={{ uri }}
          style={[
            styles.image,
            {
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
            },
          ]}
        />
      );
    }

    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.fallback,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
          },
        ]}
      >
        <Text style={[styles.initials, { fontSize }]}>{getInitials(name)}</Text>
      </LinearGradient>
    );
  };

  return (
    <View style={[styles.container, { width: totalSize, height: totalSize }]}>
      {showGradientRing ? (
        <LinearGradient
          colors={[Colors.accent, Colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.gradientRing,
            {
              width: totalSize,
              height: totalSize,
              borderRadius: totalSize / 2,
              padding: ringWidth,
            },
          ]}
        >
          <View
            style={[
              styles.ringInner,
              {
                width: totalSize - ringWidth * 2,
                height: totalSize - ringWidth * 2,
                borderRadius: (totalSize - ringWidth * 2) / 2,
              },
            ]}
          >
            {renderAvatarContent()}
          </View>
        </LinearGradient>
      ) : (
        renderAvatarContent()
      )}

      {showOnlineStatus && (
        <View
          style={[
            styles.onlineDotWrapper,
            {
              right: size === 'xlarge' || size === 'xxlarge' ? 4 : 0,
              bottom: size === 'xlarge' || size === 'xxlarge' ? 4 : 0,
            },
          ]}
        >
          {isOnline && (
            <Animated.View
              style={[
                styles.onlinePulse,
                {
                  width: dotSize + 4,
                  height: dotSize + 4,
                  borderRadius: (dotSize + 4) / 2,
                  backgroundColor: Colors.onlineGlow,
                  transform: [{ scale: pulseAnim }],
                },
              ]}
            />
          )}
          <View
            style={[
              styles.onlineDot,
              {
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: isOnline ? Colors.online : Colors.offline,
                borderWidth: dotSize > 12 ? 2.5 : 2,
              },
            ]}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    resizeMode: 'cover',
  },
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: Colors.white,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  gradientRing: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringInner: {
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 2,
  },
  onlineDotWrapper: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlinePulse: {
    position: 'absolute',
  },
  onlineDot: {
    borderColor: Colors.white,
  },
});

export default Avatar;

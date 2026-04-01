import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';
import Avatar from '../components/Avatar';

const { width, height } = Dimensions.get('window');

interface VideoCallScreenProps {
  navigation: any;
  route: {
    params: {
      callerId: string;
      callerName: string;
      callerAvatar?: string;
      isIncoming?: boolean;
    };
  };
}

const VideoCallScreen: React.FC<VideoCallScreenProps> = ({ navigation, route }) => {
  const { callerName, callerAvatar, isIncoming = false } = route.params;

  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Animations
  const pipScale = useRef(new Animated.Value(0)).current;
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const connectingPulse = useRef(new Animated.Value(1)).current;
  const connectingPulse2 = useRef(new Animated.Value(1)).current;
  const callerInfoAnim = useRef(new Animated.Value(0)).current;
  const endCallScale = useRef(new Animated.Value(1)).current;
  const recordingDotAnim = useRef(new Animated.Value(1)).current;

  // Simulate connection
  useEffect(() => {
    Animated.timing(callerInfoAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    const connectTimer = setTimeout(() => {
      setIsConnected(true);
      Animated.spring(pipScale, {
        toValue: 1,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }).start();
    }, 2500);

    return () => clearTimeout(connectTimer);
  }, []);

  // Connecting ripple animation
  useEffect(() => {
    if (!isConnected) {
      const pulse1 = Animated.loop(
        Animated.sequence([
          Animated.timing(connectingPulse, {
            toValue: 1.8,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(connectingPulse, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      const pulse2 = Animated.loop(
        Animated.sequence([
          Animated.delay(500),
          Animated.timing(connectingPulse2, {
            toValue: 1.8,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(connectingPulse2, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse1.start();
      pulse2.start();
      return () => {
        pulse1.stop();
        pulse2.stop();
      };
    }
  }, [isConnected]);

  // Recording dot blink
  useEffect(() => {
    if (isConnected) {
      const blink = Animated.loop(
        Animated.sequence([
          Animated.timing(recordingDotAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(recordingDotAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      );
      blink.start();
      return () => blink.stop();
    }
  }, [isConnected]);

  // Call duration timer
  useEffect(() => {
    if (!isConnected) return;
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isConnected]);

  const toggleControls = () => {
    const toValue = showControls ? 0 : 1;
    Animated.timing(controlsOpacity, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setShowControls(!showControls);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    Animated.parallel([
      Animated.timing(endCallScale, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      navigation.goBack();
    });
  };

  const ControlButton = ({
    icon,
    label,
    isActive = true,
    onPress,
    isDanger = false,
  }: {
    icon: string;
    label: string;
    isActive?: boolean;
    onPress: () => void;
    isDanger?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.controlItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.controlButton,
          !isActive && styles.controlButtonOff,
          isDanger && styles.endCallButton,
        ]}
      >
        {isDanger ? (
          <LinearGradient
            colors={['#F44336', '#C62828']}
            style={styles.endCallGradient}
          >
            <Icon name={icon} size={28} color={Colors.white} />
          </LinearGradient>
        ) : (
          <Icon name={icon} size={24} color={Colors.white} />
        )}
      </View>
      <Text style={styles.controlLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <Animated.View style={[styles.fullScreen, { transform: [{ scale: endCallScale }] }]}>
        <TouchableOpacity
          style={styles.fullScreen}
          activeOpacity={1}
          onPress={toggleControls}
        >
          {/* Remote Video */}
          <View style={styles.remoteVideo}>
            {isConnected ? (
              <LinearGradient
                colors={['#0F172A', '#1E293B', '#0F172A']}
                style={styles.videoSimulation}
              >
                <View style={styles.remoteAvatarContainer}>
                  <Avatar
                    name={callerName}
                    uri={callerAvatar}
                    size="xlarge"
                  />
                  <Text style={styles.remoteVideoLabel}>
                    Video của {callerName}
                  </Text>
                </View>

                {/* Network quality indicator */}
                <View style={styles.networkIndicator}>
                  <Icon name="signal-cellular-3" size={16} color="#4CAF50" />
                  <Text style={styles.networkText}>Tốt</Text>
                </View>
              </LinearGradient>
            ) : (
              /* Connecting State */
              <LinearGradient
                colors={['#0F172A', '#1E293B']}
                style={styles.connectingContainer}
              >
                <Animated.View
                  style={[
                    styles.connectingRipple,
                    {
                      transform: [{ scale: connectingPulse }],
                      opacity: connectingPulse.interpolate({
                        inputRange: [1, 1.8],
                        outputRange: [0.4, 0],
                      }),
                    },
                  ]}
                />
                <Animated.View
                  style={[
                    styles.connectingRipple,
                    styles.connectingRipple2,
                    {
                      transform: [{ scale: connectingPulse2 }],
                      opacity: connectingPulse2.interpolate({
                        inputRange: [1, 1.8],
                        outputRange: [0.3, 0],
                      }),
                    },
                  ]}
                />
                <Avatar
                  name={callerName}
                  uri={callerAvatar}
                  size="xlarge"
                  showGradientRing
                />
                <Text style={styles.connectingName}>{callerName}</Text>
                <Text style={styles.connectingStatus}>
                  {isIncoming ? 'Cuộc gọi đến...' : 'Đang kết nối...'}
                </Text>

                {/* Animated dots */}
                <View style={styles.connectingDots}>
                  {[0, 1, 2].map((i) => (
                    <Animated.View
                      key={i}
                      style={[
                        styles.connectingDot,
                        {
                          opacity: connectingPulse.interpolate({
                            inputRange: [1, 1.4, 1.8],
                            outputRange: i === 0 ? [1, 0.3, 1] : i === 1 ? [0.3, 1, 0.3] : [1, 0.3, 1],
                          }),
                        },
                      ]}
                    />
                  ))}
                </View>
              </LinearGradient>
            )}
          </View>

          {/* Local PiP */}
          {isConnected && (
            <Animated.View
              style={[
                styles.localVideoPiP,
                { transform: [{ scale: pipScale }] },
              ]}
            >
              {isCameraOn ? (
                <LinearGradient
                  colors={['#334155', '#1E293B']}
                  style={styles.localVideoSimulation}
                >
                  <Icon name="account" size={32} color="rgba(255,255,255,0.7)" />
                  <Text style={styles.localVideoLabel}>Bạn</Text>
                </LinearGradient>
              ) : (
                <View style={styles.cameraOffPiP}>
                  <Icon name="camera-off" size={24} color="rgba(255,255,255,0.5)" />
                </View>
              )}
            </Animated.View>
          )}

          {/* Top Overlay */}
          <Animated.View
            style={[
              styles.topOverlay,
              { opacity: controlsOpacity },
            ]}
          >
            <LinearGradient
              colors={['rgba(0,0,0,0.6)', 'transparent']}
              style={styles.topOverlayGradient}
            >
              <TouchableOpacity
                style={styles.topBackButton}
                onPress={() => navigation.goBack()}
              >
                <Icon name="arrow-left" size={22} color={Colors.white} />
              </TouchableOpacity>

              <View style={styles.topInfo}>
                <Text style={styles.topCallerName}>{callerName}</Text>
                {isConnected && (
                  <View style={styles.durationRow}>
                    <Animated.View
                      style={[
                        styles.recordingDot,
                        { opacity: recordingDotAnim },
                      ]}
                    />
                    <Text style={styles.durationText}>
                      {formatDuration(callDuration)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.topSpacer} />
            </LinearGradient>
          </Animated.View>

          {/* Bottom Controls */}
          <Animated.View
            style={[
              styles.controlsContainer,
              { opacity: controlsOpacity },
            ]}
          >
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.controlsGradient}
            >
              <View style={styles.controlsBar}>
                <ControlButton
                  icon={isMicOn ? 'microphone' : 'microphone-off'}
                  label={isMicOn ? 'Tắt mic' : 'Bật mic'}
                  isActive={isMicOn}
                  onPress={() => setIsMicOn(!isMicOn)}
                />
                <ControlButton
                  icon={isCameraOn ? 'camera' : 'camera-off'}
                  label={isCameraOn ? 'Tắt cam' : 'Bật cam'}
                  isActive={isCameraOn}
                  onPress={() => setIsCameraOn(!isCameraOn)}
                />
                <ControlButton
                  icon="phone-hangup"
                  label="Kết thúc"
                  onPress={handleEndCall}
                  isDanger
                />
                <ControlButton
                  icon={isSpeakerOn ? 'volume-high' : 'volume-off'}
                  label={isSpeakerOn ? 'Loa' : 'Tai nghe'}
                  isActive={isSpeakerOn}
                  onPress={() => setIsSpeakerOn(!isSpeakerOn)}
                />
                <ControlButton
                  icon="camera-flip-outline"
                  label="Xoay cam"
                  onPress={() => {}}
                />
              </View>
            </LinearGradient>
          </Animated.View>
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullScreen: {
    flex: 1,
  },
  // Remote Video
  remoteVideo: {
    flex: 1,
  },
  videoSimulation: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  remoteAvatarContainer: {
    alignItems: 'center',
  },
  remoteVideoLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: Typography.bodySmall,
    marginTop: Spacing.md,
  },
  // Network
  networkIndicator: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 44) + 60 : 100,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
    gap: 4,
  },
  networkText: {
    fontSize: Typography.tiny,
    color: '#4CAF50',
    fontWeight: Typography.medium,
  },
  // Connecting
  connectingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectingRipple: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: 'rgba(0, 168, 255, 0.3)',
  },
  connectingRipple2: {
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  connectingName: {
    fontSize: Typography.h2,
    fontWeight: Typography.bold,
    color: Colors.white,
    marginTop: Spacing.xxl,
    letterSpacing: 0.5,
  },
  connectingStatus: {
    fontSize: Typography.body,
    color: 'rgba(255,255,255,0.5)',
    marginTop: Spacing.sm,
  },
  connectingDots: {
    flexDirection: 'row',
    marginTop: Spacing.xl,
    gap: 8,
  },
  connectingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  // PiP
  localVideoPiP: {
    position: 'absolute',
    top: Platform.OS === 'android' ? (StatusBar.currentHeight || 44) + 70 : 110,
    right: Spacing.lg,
    width: 110,
    height: 155,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    ...Shadows.lg,
  },
  localVideoSimulation: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  localVideoLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: Typography.tiny,
    marginTop: Spacing.xs,
  },
  cameraOffPiP: {
    flex: 1,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Top Overlay
  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  topOverlayGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 44) + 8 : 56,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  topBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topInfo: {
    flex: 1,
    alignItems: 'center',
  },
  topCallerName: {
    fontSize: Typography.body,
    fontWeight: Typography.bold,
    color: Colors.white,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  durationText: {
    fontSize: Typography.bodySmall,
    color: 'rgba(255,255,255,0.8)',
    fontVariant: ['tabular-nums'],
  },
  topSpacer: {
    width: 40,
  },
  // Controls
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  controlsGradient: {
    paddingBottom: Spacing.huge,
    paddingTop: Spacing.xxxl,
  },
  controlsBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  controlItem: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  controlButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButtonOff: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    opacity: 0.6,
  },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  endCallGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlLabel: {
    fontSize: Typography.tiny,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: Typography.medium,
  },
});

export default VideoCallScreen;

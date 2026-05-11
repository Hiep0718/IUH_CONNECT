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
  Alert,
  Linking,
  Share,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';
import Avatar from '../components/Avatar';
import { useWebSocket } from '../services/WebSocketProvider';
import {
  createCallInvite,
  createCallAccept,
  createCallEnd,
  isCallSignal,
} from '../services/callSignaling';

const { width, height } = Dimensions.get('window');
const JITSI_SERVER = 'https://meet.jit.si';

interface MeetingScreenProps {
  navigation: any;
  route: {
    params: {
      callerId: string;
      callerName: string;
      callerAvatar?: string;
      isIncoming?: boolean;
      roomName?: string;
      meetingId?: string;
    };
  };
}

const MeetingScreen: React.FC<MeetingScreenProps> = ({ navigation, route }) => {
  const {
    callerId,
    callerName,
    callerAvatar,
    isIncoming = false,
    roomName: initialRoomName,
    meetingId: initialMeetingId,
  } = route.params;

  const { sendMessage, addListener, removeListener } = useWebSocket();

  const [callDuration, setCallDuration] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [callStatus, setCallStatus] = useState(
    isIncoming ? 'Đang kết nối...' : 'Đang gọi...',
  );
  const [desktopJoined, setDesktopJoined] = useState(false);

  const roomNameRef = useRef<string>(initialRoomName || '');
  const meetingIdRef = useRef<string>(initialMeetingId || '');
  const jitsiOpenedRef = useRef(false);

  // Animations
  const connectingPulse = useRef(new Animated.Value(1)).current;
  const connectingPulse2 = useRef(new Animated.Value(1)).current;
  const callerInfoAnim = useRef(new Animated.Value(0)).current;
  const endCallScale = useRef(new Animated.Value(1)).current;
  const recordingDotAnim = useRef(new Animated.Value(1)).current;

  // ============================================================
  // Jitsi
  // ============================================================
  const openJitsiMeeting = (room: string) => {
    if (jitsiOpenedRef.current) return;
    jitsiOpenedRef.current = true;

    const jitsiUrl = `${JITSI_SERVER}/${room}#config.prejoinPageEnabled=false&config.startWithAudioMuted=false&config.startWithVideoMuted=false&config.disableDeepLinking=true&interfaceConfig.TOOLBAR_BUTTONS=["microphone","camera","hangup","fullscreen","tileview"]&interfaceConfig.DISABLE_JOIN_LEAVE_NOTIFICATIONS=true&interfaceConfig.SHOW_CHROME_EXTENSION_BANNER=false`;

    console.log('🌐 Opening Jitsi Meet:', room);
    setIsConnected(true);
    setCallStatus('Đang trong cuộc gọi');

    Linking.openURL(jitsiUrl).catch((err) => {
      console.error('Failed to open Jitsi URL:', err);
      Alert.alert('Lỗi', 'Không thể mở trình duyệt để bắt đầu cuộc gọi.', [
        { text: 'Đóng', onPress: () => navigation.goBack() },
      ]);
    });
  };

  // ============================================================
  // Signaling — dùng global WebSocket
  // ============================================================
  useEffect(() => {
    let isMounted = true;

    Animated.timing(callerInfoAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    if (!isIncoming) {
      // === CALLER ===
      if (!roomNameRef.current) {
        roomNameRef.current = `IUHConnect_${callerId}_${Date.now()}`;
      }
      sendMessage(createCallInvite(callerId, roomNameRef.current));
      setCallStatus('Đang gọi...');
    } else {
      // === CALLEE ===
      sendMessage(
        createCallAccept(callerId, meetingIdRef.current, roomNameRef.current),
      );
      setTimeout(() => {
        if (isMounted) openJitsiMeeting(roomNameRef.current);
      }, 500);
    }

    // Subscribe meeting signals
    const handler = (data: any) => {
      if (!isCallSignal(data) || !isMounted) return;

      console.log('📩 Meeting Signal:', data.signalType);

      if (data.signalType === 'CALL_ACCEPT') {
        // Lưu meetingId từ backend
        if (data.meetingId) meetingIdRef.current = data.meetingId;
        setCallStatus('Đối phương đã nghe máy!');
        setTimeout(() => {
          if (isMounted) openJitsiMeeting(roomNameRef.current);
        }, 500);
      } else if (data.signalType === 'CALL_REJECT') {
        Alert.alert('Cuộc gọi bị từ chối', 'Đối phương đã từ chối cuộc gọi.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else if (data.signalType === 'CALL_END') {
        Alert.alert('Cuộc gọi kết thúc', 'Đối phương đã kết thúc cuộc gọi.', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else if (data.signalType === 'DEVICE_JOINED') {
        setDesktopJoined(true);
      }
    };

    addListener('meeting', handler);
    return () => {
      isMounted = false;
      removeListener('meeting');
    };
  }, []);

  // ============================================================
  // Animations
  // ============================================================
  useEffect(() => {
    if (!isConnected) {
      const pulse1 = Animated.loop(
        Animated.sequence([
          Animated.timing(connectingPulse, {
            toValue: 1.8, duration: 1500, useNativeDriver: true,
          }),
          Animated.timing(connectingPulse, {
            toValue: 1, duration: 0, useNativeDriver: true,
          }),
        ]),
      );
      const pulse2 = Animated.loop(
        Animated.sequence([
          Animated.delay(400),
          Animated.timing(connectingPulse2, {
            toValue: 1.8, duration: 1500, useNativeDriver: true,
          }),
          Animated.timing(connectingPulse2, {
            toValue: 1, duration: 0, useNativeDriver: true,
          }),
        ]),
      );
      pulse1.start();
      pulse2.start();
      return () => { pulse1.stop(); pulse2.stop(); };
    }
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) {
      const blink = Animated.loop(
        Animated.sequence([
          Animated.timing(recordingDotAnim, {
            toValue: 0, duration: 500, useNativeDriver: true,
          }),
          Animated.timing(recordingDotAnim, {
            toValue: 1, duration: 500, useNativeDriver: true,
          }),
        ]),
      );
      blink.start();
      return () => blink.stop();
    }
  }, [isConnected]);

  useEffect(() => {
    if (!isConnected) return;
    const timer = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
    return () => clearInterval(timer);
  }, [isConnected]);

  // ============================================================
  // Helpers
  // ============================================================
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleEndCall = () => {
    sendMessage(createCallEnd(callerId, meetingIdRef.current));
    Animated.timing(endCallScale, {
      toValue: 0, duration: 300, useNativeDriver: true,
    }).start(() => navigation.goBack());
  };

  const handleRejoinJitsi = () => {
    if (roomNameRef.current) {
      jitsiOpenedRef.current = false;
      openJitsiMeeting(roomNameRef.current);
    }
  };

  const handleOpenOnDesktop = async () => {
    // Hiện link cho user copy — handoff token sẽ được tạo từ MeetingHandoffModal
    // Tạm thời hiển thị room name để user có thể join trên desktop
    const meetingId = meetingIdRef.current;
    if (!meetingId) {
      Alert.alert('Chưa sẵn sàng', 'Vui lòng đợi cuộc gọi được kết nối.');
      return;
    }

    try {
      await Share.share({
        message: `Tham gia cuộc họp IUH Connect: ${JITSI_SERVER}/${roomNameRef.current}`,
        title: 'IUH Connect - Chia sẻ cuộc họp',
      });
    } catch (e) {
      console.error('Share failed:', e);
    }
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <Animated.View style={[styles.fullScreen, { transform: [{ scale: endCallScale }] }]}>
        <LinearGradient
          colors={['#0F172A', '#1E293B', '#0F172A']}
          style={styles.background}
        >
          {/* Top Bar */}
          <View style={styles.topBar}>
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
                    style={[styles.recordingDot, { opacity: recordingDotAnim }]}
                  />
                  <Text style={styles.durationText}>
                    {formatDuration(callDuration)}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.topSpacer} />
          </View>

          {/* Center Content */}
          <View style={styles.centerContent}>
            {/* Ripple Effects */}
            {!isConnected && (
              <>
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
                    {
                      transform: [{ scale: connectingPulse2 }],
                      opacity: connectingPulse2.interpolate({
                        inputRange: [1, 1.8],
                        outputRange: [0.3, 0],
                      }),
                    },
                  ]}
                />
              </>
            )}

            {/* Avatar */}
            <Animated.View
              style={[
                styles.avatarContainer,
                {
                  opacity: callerInfoAnim,
                  transform: [{
                    translateY: callerInfoAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  }],
                },
              ]}
            >
              <View style={styles.avatarWrapper}>
                <Avatar
                  name={callerName}
                  uri={callerAvatar}
                  size="xxlarge"
                />
                {isConnected && (
                  <View style={styles.connectedBadge}>
                    <Icon name="video" size={16} color={Colors.white} />
                  </View>
                )}
              </View>

              <Text style={styles.callerNameText}>{callerName}</Text>
              <Text style={styles.callStatusText}>{callStatus}</Text>

              {/* Desktop joined indicator */}
              {desktopJoined && (
                <View style={styles.desktopBadge}>
                  <Icon name="monitor" size={16} color="#4CAF50" />
                  <Text style={styles.desktopBadgeText}>
                    Đã kết nối trên máy tính
                  </Text>
                </View>
              )}

              {/* Connecting dots */}
              {!isConnected && (
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
              )}

              {/* Action buttons khi connected */}
              {isConnected && (
                <View style={styles.connectedActions}>
                  <TouchableOpacity
                    style={styles.rejoinButton}
                    onPress={handleRejoinJitsi}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={['#4CAF50', '#2E7D32']}
                      style={styles.actionGradient}
                    >
                      <Icon name="video" size={20} color={Colors.white} />
                      <Text style={styles.actionText}>Mở lại cuộc gọi</Text>
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.desktopButton}
                    onPress={handleOpenOnDesktop}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={['#2196F3', '#1565C0']}
                      style={styles.actionGradient}
                    >
                      <Icon name="monitor" size={20} color={Colors.white} />
                      <Text style={styles.actionText}>Mở trên máy tính</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}
            </Animated.View>
          </View>

          {/* Bottom Controls */}
          <View style={styles.bottomControls}>
            <TouchableOpacity
              style={styles.endCallButton}
              onPress={handleEndCall}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={['#F44336', '#C62828']}
                style={styles.endCallGradient}
              >
                <Icon name="phone-hangup" size={32} color={Colors.white} />
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.endCallLabel}>Kết thúc</Text>
          </View>
        </LinearGradient>
      </Animated.View>
    </SafeAreaView>
  );
};

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  fullScreen: { flex: 1 },
  background: { flex: 1, justifyContent: 'space-between' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 44) + 10 : 10,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  topBackButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  topInfo: { flex: 1, alignItems: 'center' },
  topCallerName: { color: Colors.white, fontSize: Typography.body, fontWeight: '600' },
  topSpacer: { width: 40 },
  durationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  recordingDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#4CAF50', marginRight: 6,
  },
  durationText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: Typography.bodySmall,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
  },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  connectingRipple: {
    position: 'absolute', width: 200, height: 200, borderRadius: 100,
    borderWidth: 2, borderColor: 'rgba(59, 130, 246, 0.5)',
  },
  avatarContainer: { alignItems: 'center' },
  avatarWrapper: { marginBottom: Spacing.lg, position: 'relative' },
  connectedBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#4CAF50',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#1E293B',
  },
  callerNameText: { color: Colors.white, fontSize: 28, fontWeight: '700', marginBottom: 8 },
  callStatusText: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.body, marginBottom: Spacing.md },
  desktopBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, gap: 8, marginBottom: Spacing.md,
  },
  desktopBadgeText: { color: '#4CAF50', fontSize: Typography.caption, fontWeight: '600' },
  connectingDots: { flexDirection: 'row', gap: 6, marginTop: Spacing.sm },
  connectingDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
  },
  connectedActions: { marginTop: Spacing.xl, gap: 12, alignItems: 'center' },
  rejoinButton: { borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.md },
  desktopButton: { borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.md },
  actionGradient: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: BorderRadius.lg, gap: 10,
  },
  actionText: { color: Colors.white, fontSize: Typography.body, fontWeight: '600' },
  bottomControls: { alignItems: 'center', paddingBottom: 50 },
  endCallButton: { borderRadius: 35, overflow: 'hidden', ...Shadows.md },
  endCallGradient: {
    width: 70, height: 70, borderRadius: 35,
    justifyContent: 'center', alignItems: 'center',
  },
  endCallLabel: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.caption, marginTop: 8 },
});

export default MeetingScreen;

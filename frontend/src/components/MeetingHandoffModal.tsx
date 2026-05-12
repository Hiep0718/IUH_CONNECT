import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Camera } from 'react-native-camera-kit';
import { Colors, Typography, BorderRadius, Shadows, Spacing } from '../theme/theme';

interface MeetingHandoffModalProps {
  visible: boolean;
  onClose: () => void;
  onScanSuccess: (desktopId: string) => void;
  isJoined: boolean;
}

export const MeetingHandoffModal: React.FC<MeetingHandoffModalProps> = ({
  visible,
  onClose,
  onScanSuccess,
  isJoined,
}) => {
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!visible) {
      setScanned(false);
    }
  }, [visible]);

  const handleReadCode = (event: any) => {
    if (scanned || isJoined) return;
    
    const qrValue = event.nativeEvent.codeStringValue;
    try {
      const data = JSON.parse(qrValue);
      if (data.type === 'HANDOFF' && data.desktopId) {
        setScanned(true);
        onScanSuccess(data.desktopId);
      }
    } catch (e) {
      // Ignore non-json QRs
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="arrow-left" size={28} color={Colors.white} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Chuyển thiết bị</Text>
          <View style={{ width: 40 }} />
        </View>

        {isJoined ? (
          <View style={styles.successContainer}>
            <View style={styles.successCircle}>
              <Icon name="check" size={60} color={Colors.white} />
            </View>
            <Text style={styles.successText}>Đã kết nối máy tính!</Text>
            <Text style={styles.subText}>Bạn có thể tiếp tục cuộc họp trên trình duyệt.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={onClose}>
              <Text style={styles.primaryButtonText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraWrapper}>
            <View style={styles.instructionContainer}>
              <Text style={styles.instructionText}>
                Mở giao diện <Text style={{fontWeight: 'bold', color: '#60A5FA'}}>Chuyển thiết bị</Text> trên phiên bản máy tính của IUH Connect và hướng camera vào mã QR.
              </Text>
            </View>
            
            <View style={styles.cameraContainer}>
              <Camera
                scanBarcode={true}
                onReadCode={handleReadCode}
                style={StyleSheet.absoluteFill}
                showFrame={true}
                laserColor="#0077CC"
                frameColor="white"
              />
              
              {scanned && !isJoined && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#0077CC" />
                  <Text style={styles.loadingText}>Đang liên kết...</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    backgroundColor: '#1E293B',
  },
  headerTitle: {
    color: Colors.white,
    fontSize: Typography.h3,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
    marginLeft: -8,
  },
  cameraWrapper: {
    flex: 1,
  },
  instructionContainer: {
    padding: Spacing.xl,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  instructionText: {
    color: Colors.white,
    fontSize: Typography.body,
    textAlign: 'center',
    lineHeight: 24,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: Colors.white,
    marginTop: Spacing.md,
    fontSize: Typography.body,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    ...Shadows.lg,
  },
  successText: {
    color: '#4CAF50',
    fontSize: Typography.h2,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  subText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  primaryButton: {
    backgroundColor: '#0077CC',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: BorderRadius.lg,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: Typography.body,
    fontWeight: '600',
  },
});

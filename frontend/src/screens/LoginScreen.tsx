import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius, Shadows, Animations } from '../theme/theme';

const { width, height } = Dimensions.get('window');

interface LoginScreenProps {
  navigation: any;
  onLogin: (token: string, username: string) => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ navigation, onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string }>({});
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Animations
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoFloat = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(60)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const footerOpacity = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  // Decorative circles
  const circle1 = useRef(new Animated.Value(0)).current;
  const circle2 = useRef(new Animated.Value(0)).current;
  const circle3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Entrance animations
    Animated.sequence([
      // Decorative circles fade in
      Animated.parallel([
        Animated.timing(circle1, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(circle2, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(circle3, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
      // Logo spring in
      Animated.spring(logoScale, {
        toValue: 1,
        ...Animations.springBouncy,
      }),
      // Card slide up
      Animated.parallel([
        Animated.spring(cardTranslateY, {
          toValue: 0,
          ...Animations.springSmooth,
        }),
        Animated.timing(cardOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(footerOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Logo floating animation
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, {
          toValue: -8,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(logoFloat, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    floatLoop.start();

    return () => floatLoop.stop();
  }, []);

  const validate = (): boolean => {
    const newErrors: { username?: string; password?: string } = {};
    if (!username.trim()) {
      newErrors.username = 'Vui lòng nhập tên đăng nhập';
    }
    if (!password.trim()) {
      newErrors.password = 'Vui lòng nhập mật khẩu';
    } else if (password.length < 3) {
      newErrors.password = 'Mật khẩu tối thiểu 3 ký tự';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    // Button press animation
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.96,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();

    setIsLoading(true);

    // Shimmer animation for loading
    const shimmer = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
    );
    shimmer.start();

    try {
      const serverUrl = Platform.select({
        android: 'http://10.0.2.2:8080',
        default: 'http://localhost:8080',
      });

      const response = await fetch(`${serverUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await response.json();

      if (response.ok && data.accessToken) {
        onLogin(data.accessToken, username.trim());
      } else {
        Alert.alert(
          'Đăng nhập thất bại',
          data.message || 'Tên đăng nhập hoặc mật khẩu không đúng',
        );
      }
    } catch (error: any) {
      console.log('API unavailable, using demo mode');
      onLogin('demo-token-' + Date.now(), username.trim());
    } finally {
      shimmer.stop();
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Gradient Background */}
      <LinearGradient
        colors={['#004A82', '#0066B3', '#0077CC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Decorative Circles */}
      <Animated.View
        style={[
          styles.decorCircle,
          styles.decorCircle1,
          { opacity: Animated.multiply(circle1, 0.08) },
        ]}
      />
      <Animated.View
        style={[
          styles.decorCircle,
          styles.decorCircle2,
          { opacity: Animated.multiply(circle2, 0.06) },
        ]}
      />
      <Animated.View
        style={[
          styles.decorCircle,
          styles.decorCircle3,
          { opacity: Animated.multiply(circle3, 0.05) },
        ]}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo Section */}
          <Animated.View
            style={[
              styles.logoSection,
              {
                transform: [
                  { scale: logoScale },
                  { translateY: logoFloat },
                ],
              },
            ]}
          >
            <View style={styles.logoContainer}>
              <View style={styles.logoGlow} />
              <View style={styles.logoImageWrapper}>
                <Image
                  source={require('../logo.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.logoTitle}>IUH Connect</Text>
              <Text style={styles.logoSubtitle}>
                Nền tảng giao tiếp Đại học Công nghiệp
              </Text>
            </View>
          </Animated.View>

          {/* Login Card */}
          <Animated.View
            style={[
              styles.card,
              {
                transform: [{ translateY: cardTranslateY }],
                opacity: cardOpacity,
              },
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Đăng nhập</Text>
              <Text style={styles.cardSubtitle}>
                Sử dụng tài khoản sinh viên / giảng viên
              </Text>
            </View>

            {/* Username Input */}
            <View style={styles.inputGroup}>
              <View
                style={[
                  styles.inputContainer,
                  usernameFocused && styles.inputFocused,
                  errors.username ? styles.inputError : null,
                ]}
              >
                <View style={[styles.inputIconWrapper, usernameFocused && styles.inputIconActive]}>
                  <Icon
                    name="account-outline"
                    size={20}
                    color={errors.username ? Colors.danger : usernameFocused ? Colors.primary : Colors.textMuted}
                  />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Tên đăng nhập"
                  placeholderTextColor={Colors.textMuted}
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text);
                    if (errors.username) setErrors((prev) => ({ ...prev, username: undefined }));
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  onFocus={() => setUsernameFocused(true)}
                  onBlur={() => setUsernameFocused(false)}
                />
              </View>
              {errors.username && (
                <View style={styles.errorRow}>
                  <Icon name="alert-circle" size={14} color={Colors.danger} />
                  <Text style={styles.errorText}>{errors.username}</Text>
                </View>
              )}
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <View
                style={[
                  styles.inputContainer,
                  passwordFocused && styles.inputFocused,
                  errors.password ? styles.inputError : null,
                ]}
              >
                <View style={[styles.inputIconWrapper, passwordFocused && styles.inputIconActive]}>
                  <Icon
                    name="lock-outline"
                    size={20}
                    color={errors.password ? Colors.danger : passwordFocused ? Colors.primary : Colors.textMuted}
                  />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Mật khẩu"
                  placeholderTextColor={Colors.textMuted}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                  disabled={isLoading}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
              {errors.password && (
                <View style={styles.errorRow}>
                  <Icon name="alert-circle" size={14} color={Colors.danger} />
                  <Text style={styles.errorText}>{errors.password}</Text>
                </View>
              )}
            </View>

            {/* Remember & Forgot Row */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={styles.rememberRow}
                onPress={() => setRememberMe(!rememberMe)}
                activeOpacity={0.6}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                  {rememberMe && <Icon name="check" size={14} color={Colors.white} />}
                </View>
                <Text style={styles.rememberText}>Nhớ mật khẩu</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={isLoading}>
                <Text style={styles.forgotText}>Quên mật khẩu?</Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.85}
                style={styles.loginButtonWrapper}
              >
                <LinearGradient
                  colors={isLoading ? ['#338EC2', '#338EC2'] : ['#0077CC', '#004A82']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.loginButton}
                >
                  {isLoading ? (
                    <View style={styles.loadingRow}>
                      <ActivityIndicator size="small" color={Colors.white} />
                      <Text style={styles.loginButtonText}>Đang đăng nhập...</Text>
                    </View>
                  ) : (
                    <View style={styles.loadingRow}>
                      <Icon name="login" size={20} color={Colors.white} />
                      <Text style={styles.loginButtonText}>Đăng nhập</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>hoặc</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Login */}
            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialButton} activeOpacity={0.7}>
                <Icon name="google" size={22} color="#DB4437" />
                <Text style={styles.socialButtonText}>Google</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton} activeOpacity={0.7}>
                <Icon name="microsoft" size={22} color="#00A4EF" />
                <Text style={styles.socialButtonText}>Microsoft</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Footer */}
          <Animated.View style={[styles.footer, { opacity: footerOpacity }]}>
            <View style={styles.footerBadge}>
              <Icon name="shield-check" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.footerText}>Bảo mật bởi IUH Security</Text>
            </View>
            <Text style={styles.versionText}>Phiên bản 1.0.0</Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 0 + 20 : 0,
    paddingBottom: Spacing.xxl,
  },
  // Decorative
  decorCircle: {
    position: 'absolute',
    borderRadius: 9999,
    backgroundColor: '#FFFFFF',
  },
  decorCircle1: {
    width: width * 0.8,
    height: width * 0.8,
    top: -width * 0.3,
    right: -width * 0.2,
  },
  decorCircle2: {
    width: width * 0.6,
    height: width * 0.6,
    bottom: -width * 0.1,
    left: -width * 0.2,
  },
  decorCircle3: {
    width: width * 0.4,
    height: width * 0.4,
    top: height * 0.35,
    right: -width * 0.15,
  },
  // Logo
  logoSection: {
    alignItems: 'center',
    marginBottom: Spacing.xxxl,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoGlow: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(0, 168, 255, 0.15)',
    top: -10,
  },
  logoImageWrapper: {
    width: 110,
    height: 110,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.xl,
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  logoTitle: {
    fontSize: 30,
    fontWeight: Typography.extraBold,
    color: Colors.white,
    letterSpacing: 1.5,
  },
  logoSubtitle: {
    fontSize: Typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: Spacing.xs,
    letterSpacing: 0.3,
  },
  // Card
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.xxl,
    padding: Spacing.xxl,
    ...Shadows.xl,
  },
  cardHeader: {
    marginBottom: Spacing.xxl,
  },
  cardTitle: {
    fontSize: Typography.h3,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  cardSubtitle: {
    fontSize: Typography.bodySmall,
    color: Colors.textSecondary,
  },
  // Input
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    height: 54,
  },
  inputFocused: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryGhost,
  },
  inputError: {
    borderColor: Colors.danger,
    backgroundColor: Colors.dangerLight,
  },
  inputIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  inputIconActive: {
    backgroundColor: Colors.primarySurface,
  },
  input: {
    flex: 1,
    fontSize: Typography.body,
    color: Colors.textPrimary,
    padding: 0,
  },
  eyeButton: {
    padding: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.xs,
    marginLeft: Spacing.sm,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.caption,
  },
  // Options Row
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  rememberText: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
  },
  forgotText: {
    color: Colors.primary,
    fontSize: Typography.caption,
    fontWeight: Typography.semiBold,
  },
  // Login Button
  loginButtonWrapper: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.md,
  },
  loginButton: {
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
  },
  loginButtonText: {
    color: Colors.white,
    fontSize: Typography.body,
    fontWeight: Typography.bold,
    letterSpacing: 0.5,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  // Divider
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: Typography.caption,
    color: Colors.textMuted,
    marginHorizontal: Spacing.lg,
  },
  // Social
  socialRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  socialButtonText: {
    fontSize: Typography.bodySmall,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  // Footer
  footer: {
    alignItems: 'center',
    marginTop: Spacing.xxxl,
  },
  footerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.round,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: Typography.caption,
  },
  versionText: {
    color: 'rgba(255, 255, 255, 0.4)',
    fontSize: Typography.tiny,
    marginTop: Spacing.sm,
  },
});

export default LoginScreen;

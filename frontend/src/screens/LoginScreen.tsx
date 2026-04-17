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
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; password?: string, fullName?: string, email?: string }>({});
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [fullNameFocused, setFullNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
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
    // Initial animations
    Animated.parallel([
      Animated.parallel([
        Animated.timing(circle1, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(circle2, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(circle3, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
      Animated.spring(logoScale, { toValue: 1, ...Animations.springBouncy }),
      Animated.parallel([
        Animated.spring(cardTranslateY, { toValue: 0, ...Animations.springSmooth }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(footerOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, { toValue: -8, duration: 2000, useNativeDriver: true }),
        Animated.timing(logoFloat, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ]),
    );
    floatLoop.start();

    return () => floatLoop.stop();
  }, []);

  const validate = (): boolean => {
    const newErrors: any = {};
    if (!username.trim()) newErrors.username = 'Vui lòng nhập tên đăng nhập';
    if (!password.trim()) newErrors.password = 'Vui lòng nhập mật khẩu';
    else if (password.length < 6) newErrors.password = 'Mật khẩu tối thiểu 6 ký tự';
    
    if (isRegisterMode) {
      if (!fullName.trim()) newErrors.fullName = 'Vui lòng nhập họ tên';
      if (!email.trim() || !email.includes('@')) newErrors.email = 'Vui lòng nhập email hợp lệ';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const serverUrl = Platform.select({
    android: 'http://10.0.2.2:8080',
    default: 'http://localhost:8080',
  });

  const handleLogin = async () => {
    if (!validate()) return;

    setIsLoading(true);
    Animated.loop(Animated.timing(shimmerAnim, { toValue: 1, duration: 1500, useNativeDriver: false })).start();

    try {
      const response = await fetch(`${serverUrl}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await response.json();

      if (response.ok && data.accessToken) {
        onLogin(data.accessToken, username.trim());
      } else {
        Alert.alert('Đăng nhập thất bại', data.message || 'Tên đăng nhập hoặc mật khẩu không đúng');
      }
    } catch (error) {
      console.log('API unavailable, using demo mode');
      onLogin('demo-token-' + Date.now(), username.trim());
    } finally {
      shimmerAnim.stopAnimation();
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!validate()) return;

    setIsLoading(true);
    Animated.loop(Animated.timing(shimmerAnim, { toValue: 1, duration: 1500, useNativeDriver: false })).start();
    
    try {
      const response = await fetch(`${serverUrl}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: username.trim(), 
          password,
          fullName: fullName.trim(),
          email: email.trim()
        }),
      });

      const data = await response.json();

      if (response.ok) {
        Alert.alert('Đăng ký thành công', 'Hệ thống đang tự động đăng nhập...');
        if (data.accessToken) {
          onLogin(data.accessToken, username.trim());
        } else {
          setTimeout(handleLogin, 1000);
        }
      } else {
        Alert.alert('Đăng ký thất bại', data.message || 'Tên đăng nhập có thể đã tồn tại');
      }
    } catch (error) {
      Alert.alert('Lỗi mạng', 'Không thể kết nối đến server');
    } finally {
      shimmerAnim.stopAnimation();
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Gradient Background */}
      <LinearGradient colors={['#004A82', '#0066B3', '#0077CC']} start={{ x: 0, y: 0 }} end={{ x: 0.5, y: 1 }} style={StyleSheet.absoluteFillObject} />

      {/* Decorative Circles */}
      <Animated.View style={[styles.decorCircle, styles.decorCircle1, { opacity: Animated.multiply(circle1, 0.08) }]} />
      <Animated.View style={[styles.decorCircle, styles.decorCircle2, { opacity: Animated.multiply(circle2, 0.06) }]} />
      <Animated.View style={[styles.decorCircle, styles.decorCircle3, { opacity: Animated.multiply(circle3, 0.05) }]} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardView}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Logo Section */}
          <Animated.View style={[styles.logoContainer, { transform: [{ scale: logoScale }, { translateY: logoFloat }] }]}>
            <View style={styles.logoWrapper}>
              <Icon name="school-outline" size={48} color={Colors.white} style={styles.logoIcon} />
            </View>
            <Text style={styles.appName}>IUH Connect</Text>
            <Text style={styles.appTagline}>Cộng đồng sinh viên & Giảng viên Đại học Công Nghiệp</Text>
          </Animated.View>

          {/* Form Card */}
          <Animated.View style={[styles.formCard, { opacity: cardOpacity, transform: [{ translateY: cardTranslateY }] }]}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>{isRegisterMode ? 'Đăng ký tài khoản' : 'Chào mừng trở lại'}</Text>
              <Text style={styles.formSubtitle}>{isRegisterMode ? 'Điền thông tin để tham gia cộng đồng' : 'Đăng nhập để kết nối với mọi người'}</Text>
            </View>

            {/* Inputs */}
            <View style={styles.inputsWrapper}>
              <View style={[styles.inputContainer, usernameFocused && styles.inputFocused, errors.username ? styles.inputError : null]}>
                <View style={[styles.inputIconWrapper, usernameFocused && styles.inputIconActive]}>
                  <Icon name="account-outline" size={20} color={errors.username ? Colors.danger : usernameFocused ? Colors.primary : Colors.textMuted} />
                </View>
                <TextInput style={styles.input} placeholder="Tên đăng nhập (Mã SV / GV)" placeholderTextColor={Colors.textMuted} value={username} onChangeText={(text) => { setUsername(text); if (errors.username) setErrors((prev) => ({ ...prev, username: undefined })); }} autoCapitalize="none" autoCorrect={false} editable={!isLoading} onFocus={() => setUsernameFocused(true)} onBlur={() => setUsernameFocused(false)} />
              </View>
              {errors.username && <View style={styles.errorRow}><Icon name="alert-circle" size={14} color={Colors.danger} /><Text style={styles.errorText}>{errors.username}</Text></View>}

              <View style={[styles.inputContainer, passwordFocused && styles.inputFocused, errors.password ? styles.inputError : null]}>
                <View style={[styles.inputIconWrapper, passwordFocused && styles.inputIconActive]}>
                  <Icon name="lock-outline" size={20} color={errors.password ? Colors.danger : passwordFocused ? Colors.primary : Colors.textMuted} />
                </View>
                <TextInput style={styles.input} placeholder="Mật khẩu" placeholderTextColor={Colors.textMuted} value={password} onChangeText={(text) => { setPassword(text); if (errors.password) setErrors((prev) => ({ ...prev, password: undefined })); }} secureTextEntry={!showPassword} editable={!isLoading} onFocus={() => setPasswordFocused(true)} onBlur={() => setPasswordFocused(false)} />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton} disabled={isLoading} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
              {errors.password && <View style={styles.errorRow}><Icon name="alert-circle" size={14} color={Colors.danger} /><Text style={styles.errorText}>{errors.password}</Text></View>}

              {isRegisterMode && (
                <>
                  <View style={[styles.inputContainer, fullNameFocused && styles.inputFocused, errors.fullName ? styles.inputError : null]}>
                    <View style={[styles.inputIconWrapper, fullNameFocused && styles.inputIconActive]}>
                      <Icon name="card-account-details-outline" size={20} color={errors.fullName ? Colors.danger : fullNameFocused ? Colors.primary : Colors.textMuted} />
                    </View>
                    <TextInput style={styles.input} placeholder="Họ và tên đầy đủ" placeholderTextColor={Colors.textMuted} value={fullName} onChangeText={(text) => { setFullName(text); if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: undefined })); }} editable={!isLoading} onFocus={() => setFullNameFocused(true)} onBlur={() => setFullNameFocused(false)} />
                  </View>
                  {errors.fullName && <View style={styles.errorRow}><Icon name="alert-circle" size={14} color={Colors.danger} /><Text style={styles.errorText}>{errors.fullName}</Text></View>}

                  <View style={[styles.inputContainer, emailFocused && styles.inputFocused, errors.email ? styles.inputError : null]}>
                    <View style={[styles.inputIconWrapper, emailFocused && styles.inputIconActive]}>
                      <Icon name="email-outline" size={20} color={errors.email ? Colors.danger : emailFocused ? Colors.primary : Colors.textMuted} />
                    </View>
                    <TextInput style={styles.input} placeholder="Email" placeholderTextColor={Colors.textMuted} value={email} onChangeText={(text) => { setEmail(text); if (errors.email) setErrors((prev) => ({ ...prev, email: undefined })); }} keyboardType="email-address" autoCapitalize="none" editable={!isLoading} onFocus={() => setEmailFocused(true)} onBlur={() => setEmailFocused(false)} />
                  </View>
                  {errors.email && <View style={styles.errorRow}><Icon name="alert-circle" size={14} color={Colors.danger} /><Text style={styles.errorText}>{errors.email}</Text></View>}
                </>
              )}
            </View>

            {/* Remember & Forgot Row */}
            {!isRegisterMode && (
              <View style={styles.optionsRow}>
                <TouchableOpacity style={styles.rememberRow} onPress={() => setRememberMe(!rememberMe)} activeOpacity={0.6}>
                  <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>{rememberMe && <Icon name="check" size={14} color={Colors.white} />}</View>
                  <Text style={styles.rememberText}>Nhớ mật khẩu</Text>
                </TouchableOpacity>
                <TouchableOpacity disabled={isLoading}><Text style={styles.forgotText}>Quên mật khẩu?</Text></TouchableOpacity>
              </View>
            )}

            {/* Action Buttons */}
            <View style={{ gap: 12, marginTop: isRegisterMode ? 16 : 0 }}>
              <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
                <TouchableOpacity onPress={isRegisterMode ? handleRegister : handleLogin} disabled={isLoading} activeOpacity={0.85} style={styles.loginButtonWrapper}>
                  <LinearGradient colors={isLoading ? ['#338EC2', '#338EC2'] : ['#0077CC', '#004A82']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.loginButton}>
                    {isLoading ? (
                      <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" color={Colors.white} />
                        <Text style={styles.loginButtonText}>{isRegisterMode ? 'Đang đăng ký...' : 'Đang xử lý...'}</Text>
                      </View>
                    ) : (
                      <View style={styles.loadingRow}>
                        <Icon name={isRegisterMode ? "account-plus" : "login"} size={20} color={Colors.white} />
                        <Text style={styles.loginButtonText}>{isRegisterMode ? 'Đăng ký ngay' : 'Đăng nhập'}</Text>
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            </View>

            {/* Toggle Mode */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleText}>{isRegisterMode ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}</Text>
              <TouchableOpacity onPress={() => setIsRegisterMode(!isRegisterMode)}>
                <Text style={styles.toggleAction}>{isRegisterMode ? 'Đăng nhập' : 'Đăng ký ngay'}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#004A82' },
  decorCircle: { position: 'absolute', backgroundColor: Colors.white, borderRadius: 500 },
  decorCircle1: { width: 400, height: 400, top: -100, right: -100 },
  decorCircle2: { width: 250, height: 250, bottom: -50, left: -80 },
  decorCircle3: { width: 150, height: 150, top: '40%', right: -60 },
  keyboardView: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: Spacing.xl },
  logoContainer: { alignItems: 'center', marginBottom: Spacing.huge, marginTop: Platform.OS === 'ios' ? 40 : 20 },
  logoWrapper: { width: 90, height: 90, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', ...Shadows.lg },
  logoIcon: { opacity: 0.95 },
  appName: { fontSize: 32, fontWeight: Typography.extraBold, color: Colors.white, letterSpacing: 1, marginBottom: Spacing.xs, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 },
  appTagline: { fontSize: Typography.bodySmall, color: 'rgba(255,255,255,0.85)', fontWeight: Typography.medium, textAlign: 'center' },
  formCard: { backgroundColor: Colors.white, borderRadius: BorderRadius.xxl, padding: Spacing.xl, ...Shadows.xl, elevation: 8, zIndex: 10 },
  formHeader: { marginBottom: Spacing.xl },
  formTitle: { fontSize: Typography.h2, fontWeight: Typography.extraBold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  formSubtitle: { fontSize: Typography.bodySmall, color: Colors.textSecondary },
  inputsWrapper: { gap: Spacing.md },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.background, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: 'transparent', height: 56, paddingHorizontal: Spacing.sm },
  inputFocused: { borderColor: Colors.primary, backgroundColor: Colors.white, ...Shadows.sm },
  inputError: { borderColor: Colors.danger, backgroundColor: Colors.dangerSoft },
  inputIconWrapper: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: BorderRadius.md, backgroundColor: Colors.white },
  inputIconActive: { backgroundColor: Colors.primaryGhost },
  input: { flex: 1, height: '100%', fontSize: Typography.body, color: Colors.textPrimary, marginLeft: Spacing.sm },
  eyeButton: { padding: Spacing.sm },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginTop: -8, marginLeft: 4, gap: 4 },
  errorText: { fontSize: Typography.tiny, color: Colors.danger, fontWeight: Typography.medium },
  optionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.md, marginBottom: Spacing.xl },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, borderColor: Colors.border, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.white },
  checkboxActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  rememberText: { fontSize: Typography.bodySmall, color: Colors.textSecondary, fontWeight: Typography.medium },
  forgotText: { fontSize: Typography.bodySmall, color: Colors.primary, fontWeight: Typography.semiBold },
  loginButtonWrapper: { borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.md },
  loginButton: { height: 56, justifyContent: 'center', alignItems: 'center' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  loginButtonText: { color: Colors.white, fontSize: Typography.body, fontWeight: Typography.bold, letterSpacing: 0.5 },
  toggleRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.xl },
  toggleText: { color: Colors.textSecondary, fontSize: Typography.bodySmall },
  toggleAction: { color: Colors.primary, fontSize: Typography.bodySmall, fontWeight: Typography.bold },
});

export default LoginScreen;

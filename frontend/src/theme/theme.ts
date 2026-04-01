/**
 * IUH Connect Premium Design System
 * Unified theme tokens for the entire application
 */

export const Colors = {
  // Primary Brand (IUH Blue - Premium)
  primary: '#0066B3',
  primaryDark: '#004A82',
  primaryDeep: '#003561',
  primaryLight: '#338EC2',
  primarySurface: '#E8F4FD',
  primaryGhost: 'rgba(0, 102, 179, 0.08)',

  // Gradient Pairs
  gradientPrimary: ['#0066B3', '#004A82'] as [string, string],
  gradientPrimaryLight: ['#338EC2', '#0066B3'] as [string, string],
  gradientAccent: ['#00A8FF', '#0066B3'] as [string, string],
  gradientDark: ['#1A1A2E', '#16213E'] as [string, string],
  gradientSunset: ['#FF6B6B', '#FF8E53'] as [string, string],
  gradientSuccess: ['#4CAF50', '#2E7D32'] as [string, string],
  gradientGold: ['#FFD700', '#FFA500'] as [string, string],

  // Secondary Accent
  accent: '#00A8FF',
  accentLight: '#66CCFF',
  accentSoft: 'rgba(0, 168, 255, 0.12)',

  // Semantic Colors
  success: '#4CAF50',
  successLight: '#E8F5E9',
  successSoft: 'rgba(76, 175, 80, 0.12)',
  danger: '#F44336',
  dangerLight: '#FFEBEE',
  dangerSoft: 'rgba(244, 67, 54, 0.12)',
  warning: '#FF9800',
  warningLight: '#FFF3E0',
  warningSoft: 'rgba(255, 152, 0, 0.12)',
  info: '#2196F3',
  infoLight: '#E3F2FD',

  // Neutrals (Refined)
  white: '#FFFFFF',
  background: '#F5F7FA',
  backgroundSecondary: '#EEF1F5',
  surface: '#FFFFFF',
  surfaceElevated: '#FAFBFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  borderFocus: '#0066B3',
  divider: '#E2E8F0',

  // Text (Better hierarchy)
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  textDisabled: '#CBD5E1',
  textInverse: '#FFFFFF',
  textLink: '#0066B3',

  // Chat Specific (Premium)
  chatBubbleSent: '#0066B3',
  chatBubbleSentGradient: ['#0077CC', '#005A9E'] as [string, string],
  chatBubbleReceived: '#F1F5F9',
  chatBubbleSentText: '#FFFFFF',
  chatBubbleReceivedText: '#0F172A',
  chatBackground: '#F0F4F8',
  chatDateBadge: 'rgba(100, 116, 139, 0.08)',

  // Status
  online: '#4CAF50',
  onlineGlow: 'rgba(76, 175, 80, 0.4)',
  offline: '#94A3B8',
  busy: '#F44336',
  busyGlow: 'rgba(244, 67, 54, 0.4)',
  available: '#4CAF50',

  // Overlay & Glass
  overlay: 'rgba(15, 23, 42, 0.6)',
  overlayLight: 'rgba(15, 23, 42, 0.3)',
  glassBg: 'rgba(255, 255, 255, 0.85)',
  glassBgDark: 'rgba(15, 23, 42, 0.7)',
  glassBlur: 'rgba(255, 255, 255, 0.15)',
  glassBorder: 'rgba(255, 255, 255, 0.2)',

  // Tab Bar
  tabBarBg: '#FFFFFF',
  tabBarActive: '#0066B3',
  tabBarInactive: '#94A3B8',
  tabBarBadge: '#F44336',
};

export const Typography = {
  // Font sizes
  h1: 28,
  h2: 24,
  h3: 20,
  h4: 18,
  body: 16,
  bodySmall: 14,
  caption: 12,
  tiny: 10,
  micro: 8,

  // Font weights
  extraBold: '800' as const,
  bold: '700' as const,
  semiBold: '600' as const,
  medium: '500' as const,
  regular: '400' as const,
  light: '300' as const,

  // Line heights
  lineHeightTight: 1.2,
  lineHeightNormal: 1.5,
  lineHeightRelaxed: 1.7,

  // Letter spacing
  letterSpacingTight: -0.5,
  letterSpacingNormal: 0,
  letterSpacingWide: 0.5,
  letterSpacingExtraWide: 1,
};

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  massive: 64,
  gigantic: 80,
};

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  round: 9999,
};

export const Shadows = {
  xs: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 1,
    elevation: 1,
  },
  sm: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  }),
  coloredSm: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  }),
};

export const IconSizes = {
  xs: 14,
  sm: 18,
  md: 22,
  lg: 28,
  xl: 36,
  xxl: 48,
};

export const Animations = {
  // Durations
  fast: 150,
  normal: 300,
  slow: 500,
  xslow: 800,

  // Spring configs  
  springBouncy: {
    tension: 80,
    friction: 8,
    useNativeDriver: true as const,
  },
  springSmooth: {
    tension: 60,
    friction: 10,
    useNativeDriver: true as const,
  },
  springGentle: {
    tension: 40,
    friction: 12,
    useNativeDriver: true as const,
  },
  springSnappy: {
    tension: 100,
    friction: 10,
    useNativeDriver: true as const,
  },
};

export const HitSlop = {
  sm: { top: 8, bottom: 8, left: 8, right: 8 },
  md: { top: 12, bottom: 12, left: 12, right: 12 },
  lg: { top: 16, bottom: 16, left: 16, right: 16 },
};

export default {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  IconSizes,
  Animations,
  HitSlop,
};

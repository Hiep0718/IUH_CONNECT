import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StatusBar, LogBox, View, Text, Animated, StyleSheet, Image } from 'react-native';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Screens
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ChatListScreen from './src/screens/ChatListScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import GroupsScreen from './src/screens/GroupsScreen';
import CreateGroupScreen from './src/screens/CreateGroupScreen';
import GroupSettingsScreen from './src/screens/GroupSettingsScreen';
import ChatSettingsScreen from './src/screens/ChatSettingsScreen';
import ChatScreen from './src/screens/ChatScreen';
import MeetingScreen from './src/screens/MeetingScreen';
import ProfileSettingsScreen from './src/screens/ProfileSettingsScreen';

// Services
import { WebSocketProvider, useWebSocket } from './src/services/WebSocketProvider';
import { isTokenExpired, onAuthExpired, authFetch } from './src/services/authService';
import { API_URL } from './src/config/env';
import {
  requestUserPermission,
  getFCMToken,
  sendFCMTokenToBackend,
  setupNotificationListeners,
} from './src/services/notificationService';

// Theme
import { Colors, Typography, Spacing, BorderRadius, Shadows } from './src/theme/theme';

// Types
import type { RootStackParamList, MainTabParamList } from './src/types/types';

// Suppress specific warnings in dev
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
]);

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// ============================================================
// Splash Screen Component
// ============================================================
const SplashScreen = ({ onFinish }: { onFinish: () => void }) => {
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => onFinish());
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient
      colors={['#004A82', '#0066B3', '#0077CC']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={splashStyles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Animated.View
        style={[
          splashStyles.logoContainer,
          {
            transform: [{ scale: logoScale }],
            opacity: logoOpacity,
          },
        ]}
      >
        <View style={splashStyles.logoGlow} />
        <View style={splashStyles.logoWrapper}>
          <Image
            source={require('./src/logo.png')}
            style={splashStyles.logo}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      <Animated.View style={[splashStyles.textContainer, { opacity: textOpacity }]}>
        <Text style={splashStyles.title}>IUH Connect</Text>
        <Text style={splashStyles.subtitle}>Nền tảng giao tiếp Đại học Công nghiệp</Text>
      </Animated.View>
    </LinearGradient>
  );
};

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxl,
  },
  logoGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(0, 168, 255, 0.15)',
  },
  logoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.xl,
  },
  logo: {
    width: 70,
    height: 70,
  },
  textContainer: {
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: Typography.bodySmall,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: Spacing.sm,
  },
});

// ============================================================
// Tab Icon Component with Badge
// ============================================================
const TabIcon = ({ name, focused, badge }: { name: string; focused: boolean; badge?: number }) => (
  <View style={tabStyles.iconContainer}>
    <Icon
      name={name}
      size={focused ? 26 : 24}
      color={focused ? Colors.tabBarActive : Colors.tabBarInactive}
    />
    {badge !== undefined && badge > 0 && (
      <View style={tabStyles.badge}>
        <Text style={tabStyles.badgeText}>
          {badge > 99 ? '99+' : badge}
        </Text>
      </View>
    )}
    {focused && <View style={tabStyles.activeIndicator} />}
  </View>
);

const tabStyles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 50,
    paddingTop: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 2,
    backgroundColor: Colors.tabBarBadge,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.white,
  },
  activeIndicator: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.tabBarActive,
    marginTop: 4,
  },
});

// ============================================================
// Main Tab Navigator
// ============================================================
const MainTabs = ({
  currentUser,
  token,
  onLogout,
}: {
  currentUser: string;
  token: string | null;
  onLogout: () => void;
}) => {
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadGroupCount, setUnreadGroupCount] = useState(0);
  const { addListener, removeListener } = useWebSocket();

  const fetchUnreadCounts = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await authFetch(`${API_URL}/api/v1/chat/conversations/${currentUser}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        let chatUnread = 0;
        let groupUnread = 0;
        const seenConvs = new Set<string>();

        data.forEach((msg: any) => {
          const isGroup = msg.type === 'GROUP' || (msg.conversationId && msg.conversationId.startsWith('GROUP_'));
          
          let dedupeKey = msg.conversationId;
          if (!isGroup) {
            const otherUserId = msg.senderId === currentUser ? msg.receiverId : (msg.receiverId === currentUser ? msg.senderId : null);
            if (otherUserId && otherUserId !== currentUser) {
               dedupeKey = [currentUser, otherUserId].sort().join('::');
            } else if (!otherUserId) {
               dedupeKey = msg.conversationId;
            } else {
               return; // Ignore if otherUserId === currentUser
            }
          }

          if (dedupeKey && !seenConvs.has(dedupeKey)) {
             seenConvs.add(dedupeKey);
             const count = msg.unreadCount !== undefined ? msg.unreadCount : (msg.unread_count || 0);
             if (isGroup) {
               groupUnread += count;
             } else {
               chatUnread += count;
             }
          } else if (dedupeKey && seenConvs.has(dedupeKey)) {
             // If we already saw this conversation, add its unread count to the total just in case
             // Wait, if ChatListScreen ignores it, we should ignore it too to keep UI consistent!
          }
        });
        setUnreadChatCount(chatUnread);
        setUnreadGroupCount(groupUnread);
      }
    } catch (e) {}
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCounts();
    }, [fetchUnreadCounts])
  );

  useEffect(() => {
    const listenerId = 'main-tabs-ws';
    const handler = (data: any) => {
      if (!data.type || data.type === 'CHAT_MESSAGE' || data.type === 'READ_RECEIPT') {
        fetchUnreadCounts();
      }
    };
    addListener(listenerId, handler);
    return () => removeListener(listenerId);
  }, [addListener, removeListener, fetchUnreadCounts]);

  return (
    <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarShowLabel: true,
      tabBarActiveTintColor: Colors.tabBarActive,
      tabBarInactiveTintColor: Colors.tabBarInactive,
      tabBarStyle: {
        backgroundColor: Colors.tabBarBg,
        borderTopWidth: 0,
        height: 65,
        paddingBottom: 8,
        paddingTop: 4,
        ...Shadows.md,
      },
      tabBarLabelStyle: {
        fontSize: Typography.tiny,
        fontWeight: Typography.semiBold,
        marginTop: -2,
      },
    }}
  >
    <Tab.Screen
      name="Home"
      options={{
        tabBarLabel: 'Trang chủ',
        tabBarIcon: ({ focused }) => (
          <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />
        ),
      }}
    >
      {(props) => (
        <HomeScreen
          {...props}
          currentUser={currentUser}
          token={token}
        />
      )}
    </Tab.Screen>

    <Tab.Screen
      name="ChatList"
      options={{
        tabBarLabel: 'Tin nhắn',
        tabBarIcon: ({ focused }) => (
          <TabIcon name={focused ? 'chat' : 'chat-outline'} focused={focused} badge={unreadChatCount > 0 ? unreadChatCount : undefined} />
        ),
      }}
    >
      {(props) => (
        <ChatListScreen
          {...props}
          currentUser={currentUser}
          token={token}
          onLogout={onLogout}
        />
      )}
    </Tab.Screen>

    <Tab.Screen
      name="Contacts"
      options={{
        tabBarLabel: 'Danh bạ',
        tabBarIcon: ({ focused }) => (
          <TabIcon name={focused ? 'account-box' : 'account-box-outline'} focused={focused} />
        ),
      }}
    >
      {(props) => (
        <ContactsScreen
          {...props}
          currentUser={currentUser}
          token={token}
        />
      )}
    </Tab.Screen>

    <Tab.Screen
      name="Groups"
      options={{
        tabBarLabel: 'Nhóm',
        tabBarIcon: ({ focused }) => (
          <TabIcon name={focused ? 'account-group' : 'account-group-outline'} focused={focused} badge={unreadGroupCount > 0 ? unreadGroupCount : undefined} />
        ),
      }}
    >
      {(props) => (
        <GroupsScreen
          {...props}
          currentUser={currentUser}
          token={token}
        />
      )}
    </Tab.Screen>

    <Tab.Screen
      name="Profile"
      options={{
        tabBarLabel: 'Cá nhân',
        tabBarIcon: ({ focused }) => (
          <TabIcon name={focused ? 'account-circle' : 'account-circle-outline'} focused={focused} />
        ),
      }}
    >
      {(props) => (
        <ProfileSettingsScreen
          {...props}
          currentUser={currentUser}
          token={token}
          onLogout={onLogout}
        />
      )}
    </Tab.Screen>
  </Tab.Navigator>
  );
};

// ============================================================
// Root App
// ============================================================
export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<string>('');
  const [showSplash, setShowSplash] = useState(true);
  const [isRestoring, setIsRestoring] = useState(true);
  const navigationRef = useRef<any>(null);

  // Khôi phục session từ AsyncStorage khi mở app
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedToken = await AsyncStorage.getItem('@auth_token');
        const savedUser = await AsyncStorage.getItem('@auth_username');
        if (savedToken && savedUser) {
          // Kiểm tra token đã hết hạn chưa
          if (isTokenExpired(savedToken)) {
            console.log('⚠️ Token expired, clearing session');
            await AsyncStorage.multiRemove(['@auth_token', '@auth_username']);
          } else {
            console.log('🔄 Restoring session for:', savedUser);
            setToken(savedToken);
            setCurrentUser(savedUser);
          }
        }
      } catch (e) {
        console.log('Failed to restore session', e);
      } finally {
        setIsRestoring(false);
      }
    };
    restoreSession();
  }, []);

  // Subscribe auto-logout khi bất kỳ API call nào nhận 401 (token expired)
  useEffect(() => {
    const unsubscribe = onAuthExpired(() => {
      console.log('🚫 [App] Auth expired event received, logging out...');
      setToken(null);
      setCurrentUser('');
    });
    return unsubscribe;
  }, []);

  const handleLogin = async (accessToken: string, username: string) => {
    setToken(accessToken);
    setCurrentUser(username);
    // Lưu session vào AsyncStorage để lần sau mở app tự đăng nhập
    try {
      await AsyncStorage.setItem('@auth_token', accessToken);
      await AsyncStorage.setItem('@auth_username', username);
    } catch (e) {
      console.log('Failed to save session', e);
    }
  };

  // Thiết lập Firebase Cloud Messaging sau khi người dùng đăng nhập thành công
  useEffect(() => {
    let unsubscribe: any = undefined;

    const setupFCM = async () => {
      if (token) {
        const hasPermission = await requestUserPermission();
        if (hasPermission) {
          const fcmToken = await getFCMToken();
          if (fcmToken) {
            await sendFCMTokenToBackend(fcmToken, token);
          }
          unsubscribe = setupNotificationListeners();
        }
      }
    };

    setupFCM();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [token]);

  const handleLogout = async () => {
    setToken(null);
    setCurrentUser('');
    // Xóa session khỏi AsyncStorage
    try {
      await AsyncStorage.multiRemove(['@auth_token', '@auth_username']);
    } catch (e) {
      console.log('Failed to clear session', e);
    }
  };

  // Hiện splash khi đang restore hoặc splash chưa xong
  if (showSplash || isRestoring) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  // WebSocketProvider bọc ngoài NavigationContainer khi đã authenticated
  // Nếu chưa login thì không tạo WS connection
  const renderNavigation = () => (
    <NavigationContainer ref={navigationRef}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Colors.primaryDark}
        translucent={false}
      />
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: Colors.background },
        }}
      >
        {!token ? (
          <Stack.Screen name="Login">
            {(props) => (
              <LoginScreen {...props} onLogin={handleLogin} />
            )}
          </Stack.Screen>
        ) : (
          <>
            <Stack.Screen name="MainTabs" options={{ animation: 'fade' }}>
              {() => (
                <MainTabs
                  currentUser={currentUser}
                  token={token}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="CreateGroup"
              options={{ animation: 'slide_from_bottom' }}
            >
              {(props) => (
                <CreateGroupScreen {...props} currentUser={currentUser} token={token} />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="GroupSettings"
              options={{ animation: 'slide_from_right' }}
            >
              {(props) => (
                <GroupSettingsScreen {...props} currentUser={currentUser} token={token} />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="ChatSettings"
              options={{ animation: 'slide_from_right' }}
            >
              {(props) => (
                <ChatSettingsScreen {...props} currentUser={currentUser} token={token} />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="Chat"
              options={{ animation: 'slide_from_right' }}
            >
              {(props) => (
                <ChatScreen
                  {...props}
                  currentUser={currentUser}
                  token={token}
                />
              )}
            </Stack.Screen>

            <Stack.Screen
              name="Meeting"
              options={{
                animation: 'slide_from_bottom',
                gestureEnabled: false,
              }}
            >
              {(props) => <MeetingScreen {...props} token={token} currentUser={currentUser} />}
            </Stack.Screen>

            <Stack.Screen
              name="ProfileSettings"
              options={{ animation: 'slide_from_right' }}
            >
              {(props) => (
                <ProfileSettingsScreen
                  {...props}
                  currentUser={currentUser}
                  onLogout={handleLogout}
                />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {token ? (
          <WebSocketProvider token={token} currentUser={currentUser} navigationRef={navigationRef}>
            {renderNavigation()}
          </WebSocketProvider>
        ) : (
          renderNavigation()
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

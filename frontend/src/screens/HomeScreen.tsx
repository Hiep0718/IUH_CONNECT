import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Animated,
  Dimensions,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme/theme';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');

interface HomeScreenProps {
  navigation: any;
  currentUser: string;
}

const CURRENT_DATE = new Date();
const DAYS_VN = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const MONTHS_VN = [
  'tháng 1','tháng 2','tháng 3','tháng 4','tháng 5','tháng 6',
  'tháng 7','tháng 8','tháng 9','tháng 10','tháng 11','tháng 12',
];

const USER_ROLE = 'student' as 'lecturer' | 'student';

// ── Schedules ──
const LECTURER_SCHEDULE = [
  { id: '1', subject: 'Kiến trúc phần mềm', classCode: 'DHTH15A', room: 'V7.01', building: 'Cơ sở Quận 1', startTime: '07:00', endTime: '09:30', periods: 'Tiết 1-3', color: '#4F46E5', status: 'ongoing' as const },
  { id: '2', subject: 'Lập trình di động', classCode: 'DHTH15B', room: 'V9.02', building: 'Cơ sở Quận 1', startTime: '09:45', endTime: '11:15', periods: 'Tiết 4-5', color: '#0891B2', status: 'upcoming' as const },
  { id: '3', subject: 'Nhập môn CNTT', classCode: 'DHTH16A', room: 'X12.05', building: 'Cơ sở Gò Vấp', startTime: '13:00', endTime: '15:30', periods: 'Tiết 7-9', color: '#059669', status: 'upcoming' as const },
];

const STUDENT_SCHEDULE = [
  { id: '1', subject: 'Kiến trúc phần mềm', lecturer: 'TS. Nguyễn Văn An', room: 'V7.01', building: 'Cơ sở Quận 1', startTime: '07:00', endTime: '09:30', periods: 'Tiết 1-3', color: '#4F46E5', status: 'ongoing' as const },
  { id: '2', subject: 'Lập trình di động', lecturer: 'ThS. Trần Thị Bình', room: 'V9.02', building: 'Cơ sở Quận 1', startTime: '09:45', endTime: '11:15', periods: 'Tiết 4-5', color: '#0891B2', status: 'upcoming' as const },
  { id: '3', subject: 'Toán rời rạc', lecturer: 'TS. Hoàng Minh Đức', room: 'X12.05', building: 'Cơ sở Gò Vấp', startTime: '13:00', endTime: '15:30', periods: 'Tiết 7-9', color: '#059669', status: 'upcoming' as const },
];

const UPCOMING_EXAMS = [
  { id: '1', subject: 'Cơ sở dữ liệu', date: 'Thứ 4, 10/04/2026', time: '07:30 - 09:30', room: 'V7.01', type: 'Giữa kỳ', daysLeft: 9, color: '#DC2626' },
  { id: '2', subject: 'Lập trình hướng đối tượng', date: 'Thứ 6, 18/04/2026', time: '13:00 - 15:00', room: 'X9.03', type: 'Cuối kỳ', daysLeft: 17, color: '#EA580C' },
  { id: '3', subject: 'Kiến trúc phần mềm', date: 'Thứ 2, 21/04/2026', time: '09:00 - 11:00', room: 'V12.02', type: 'Giữa kỳ', daysLeft: 20, color: '#4F46E5' },
];

// ── School Announcements ──
const SCHOOL_ANNOUNCEMENTS = [
  { id: '1', title: 'Thông báo lịch nghỉ lễ Giỗ Tổ Hùng Vương 2026', source: 'Ban Giám Hiệu', time: '1 giờ trước', icon: 'bullhorn', color: '#DC2626', isNew: true },
  { id: '2', title: 'Kế hoạch tổ chức Lễ tốt nghiệp đợt 1 năm 2026', source: 'Phòng Đào Tạo', time: '3 giờ trước', icon: 'school', color: '#4F46E5', isNew: true },
  { id: '3', title: 'Thông báo đóng học phí HK2 năm học 2025-2026', source: 'Phòng Tài Chính', time: '1 ngày trước', icon: 'cash-multiple', color: '#059669', isNew: false },
  { id: '4', title: 'Cập nhật quy chế thi kết thúc học phần', source: 'Phòng Đào Tạo', time: '2 ngày trước', icon: 'file-document-edit', color: '#EA580C', isNew: false },
];

// ── Faculty Announcements ──
const FACULTY_ANNOUNCEMENTS = [
  { id: '1', title: 'Lịch thi HK2 khoa CNTT đã cập nhật', source: 'Khoa CNTT', time: '2 giờ trước', icon: 'calendar-alert', color: '#DC2626', isNew: true },
  { id: '2', title: 'Thông báo seminar: AI trong phát triển phần mềm', source: 'Khoa CNTT', time: '5 giờ trước', icon: 'lightbulb-outline', color: '#7C3AED', isNew: true },
  { id: '3', title: 'Danh sách sinh viên đủ điều kiện thực tập', source: 'Khoa CNTT', time: '1 ngày trước', icon: 'clipboard-text-outline', color: '#0891B2', isNew: false },
];

// ── Upcoming Events ──
const UPCOMING_EVENTS = [
  { id: '1', title: 'Workshop React Native nâng cao', organizer: 'CLB Tin Học IUH', date: 'Thứ 7, 05/04/2026', time: '08:00 - 12:00', location: 'Hội trường V7', color: '#7C3AED', icon: 'rocket', attendees: 120 },
  { id: '2', title: 'Ngày hội việc làm IT 2026', organizer: 'Phòng CTSV', date: 'Thứ 3, 08/04/2026', time: '08:00 - 17:00', location: 'Sảnh A - Cơ sở Q1', color: '#0891B2', icon: 'briefcase-outline', attendees: 500 },
  { id: '3', title: 'Cuộc thi lập trình ACM/ICPC cấp trường', organizer: 'Khoa CNTT', date: 'Thứ 7, 12/04/2026', time: '07:30 - 16:00', location: 'Phòng Lab X12.04', color: '#059669', icon: 'trophy-outline', attendees: 80 },
];

// ── Upcoming Classes (next few) ──
const UPCOMING_CLASSES = [
  { id: '1', subject: 'Lập trình di động', lecturer: 'ThS. Trần Thị Bình', time: '09:45 - 11:15', room: 'V9.02', color: '#0891B2', isNext: true },
  { id: '2', subject: 'Toán rời rạc', lecturer: 'TS. Hoàng Minh Đức', time: '13:00 - 15:30', room: 'X12.05', color: '#059669', isNext: false },
];

const STUDENT_STATS = [
  { label: 'Môn học', value: '6', icon: 'book-open-variant', color: '#4F46E5' },
  { label: 'Tín chỉ', value: '18', icon: 'school-outline', color: '#0891B2' },
  { label: 'Tin nhắn', value: '8', icon: 'chat-outline', color: '#059669' },
  { label: 'Sắp thi', value: '3', icon: 'alert-circle-outline', color: '#DC2626' },
];

const LECTURER_STATS = [
  { label: 'Lớp hôm nay', value: '3', icon: 'school-outline', color: '#4F46E5' },
  { label: 'Sinh viên', value: '156', icon: 'account-group-outline', color: '#0891B2' },
  { label: 'Tin nhắn mới', value: '12', icon: 'chat-outline', color: '#059669' },
  { label: 'Bài chấm', value: '28', icon: 'file-document-edit-outline', color: '#EA580C' },
];

// ============================================================
// Component
// ============================================================
const HomeScreen: React.FC<HomeScreenProps> = ({ navigation, currentUser }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [examExpanded, setExamExpanded] = useState(false);
  const [scheduleViewMode, setScheduleViewMode] = useState<'day' | 'week' | 'month'>('day');

  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const chevronRotateSchedule = useRef(new Animated.Value(0)).current;
  const chevronRotateExam = useRef(new Animated.Value(0)).current;

  const isLecturer = USER_ROLE === 'lecturer';
  const schedule = isLecturer ? LECTURER_SCHEDULE : STUDENT_SCHEDULE;
  const stats = isLecturer ? LECTURER_STATS : STUDENT_STATS;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(headerAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(statsAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
        Animated.timing(contentAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  const onRefresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 1500); };

  const formatDateHeader = () => {
    const d = CURRENT_DATE;
    return `${DAYS_VN[d.getDay()]}, ${d.getDate()} ${MONTHS_VN[d.getMonth()]} ${d.getFullYear()}`;
  };

  const toggleSchedule = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setScheduleExpanded(!scheduleExpanded);
    Animated.timing(chevronRotateSchedule, { toValue: scheduleExpanded ? 0 : 1, duration: 300, useNativeDriver: true }).start();
  };

  const toggleExam = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExamExpanded(!examExpanded);
    Animated.timing(chevronRotateExam, { toValue: examExpanded ? 0 : 1, duration: 300, useNativeDriver: true }).start();
  };

  const scheduleRotation = chevronRotateSchedule.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
  const examRotation = chevronRotateExam.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  // ── Compact Schedule Summary ──
  const ongoingClass = schedule.find(s => s.status === 'ongoing');
  const upcomingCount = schedule.filter(s => s.status === 'upcoming').length;

  // ── Render helpers ──
  const renderScheduleCard = (item: any) => (
    <View key={item.id} style={styles.scheduleCard}>
      <View style={styles.timeColumn}>
        <Text style={[styles.timeStart, item.status === 'ongoing' && { color: item.color }]}>{item.startTime}</Text>
        <View style={[styles.timeLine, { backgroundColor: item.color }]} />
        <Text style={styles.timeEnd}>{item.endTime}</Text>
      </View>
      <TouchableOpacity style={[styles.scheduleCardContent, item.status === 'ongoing' && styles.scheduleCardOngoing]} activeOpacity={0.7}>
        <View style={[styles.scheduleColorBar, { backgroundColor: item.color }]} />
        <View style={styles.scheduleCardBody}>
          <View style={styles.scheduleCardHeader}>
            <Text style={styles.scheduleSubject} numberOfLines={1}>{item.subject}</Text>
            {item.status === 'ongoing' && (
              <View style={[styles.ongoingBadge, { backgroundColor: `${item.color}20` }]}>
                <View style={[styles.ongoingDot, { backgroundColor: item.color }]} />
                <Text style={[styles.ongoingText, { color: item.color }]}>Đang diễn ra</Text>
              </View>
            )}
          </View>
          <Text style={styles.scheduleDetail}>{isLecturer ? `Lớp: ${item.classCode}` : `GV: ${item.lecturer}`}</Text>
          <View style={styles.scheduleMetaRow}>
            <View style={styles.scheduleMeta}>
              <Icon name="map-marker-outline" size={14} color={Colors.textMuted} />
              <Text style={styles.scheduleMetaText}>{item.room} • {item.building}</Text>
            </View>
            <Text style={styles.schedulePeriod}>{item.periods}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderAnnouncementItem = (item: any) => (
    <TouchableOpacity key={item.id} style={styles.announcementItem} activeOpacity={0.6}>
      <View style={[styles.announcementIcon, { backgroundColor: `${item.color}15` }]}>
        <Icon name={item.icon} size={20} color={item.color} />
      </View>
      <View style={styles.announcementContent}>
        <Text style={styles.announcementTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.announcementMeta}>{item.source} • {item.time}</Text>
      </View>
      {item.isNew && <View style={styles.newDot} />}
    </TouchableOpacity>
  );

  const renderEventCard = (item: any) => (
    <TouchableOpacity key={item.id} style={styles.eventCard} activeOpacity={0.7}>
      <LinearGradient colors={[`${item.color}12`, `${item.color}06`]} style={styles.eventCardGradient}>
        <View style={[styles.eventIconWrap, { backgroundColor: `${item.color}20` }]}>
          <Icon name={item.icon} size={24} color={item.color} />
        </View>
        <View style={styles.eventInfo}>
          <Text style={styles.eventTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.eventOrganizer}>{item.organizer}</Text>
          <View style={styles.eventMetaRow}>
            <Icon name="calendar-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.eventMetaText}>{item.date}</Text>
          </View>
          <View style={styles.eventMetaRow}>
            <Icon name="clock-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.eventMetaText}>{item.time}</Text>
          </View>
          <View style={styles.eventMetaRow}>
            <Icon name="map-marker-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.eventMetaText}>{item.location}</Text>
          </View>
        </View>
        <View style={styles.eventAttendees}>
          <Icon name="account-group" size={16} color={item.color} />
          <Text style={[styles.eventAttendeesText, { color: item.color }]}>{item.attendees}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderUpcomingClass = (item: any) => (
    <TouchableOpacity key={item.id} style={styles.upcomingClassCard} activeOpacity={0.7}>
      <View style={[styles.upcomingClassBar, { backgroundColor: item.color }]} />
      <View style={styles.upcomingClassBody}>
        <View style={styles.upcomingClassRow}>
          <Text style={styles.upcomingClassName} numberOfLines={1}>{item.subject}</Text>
          {item.isNext && (
            <View style={[styles.nextBadge, { backgroundColor: `${item.color}15` }]}>
              <Text style={[styles.nextBadgeText, { color: item.color }]}>Tiếp theo</Text>
            </View>
          )}
        </View>
        <Text style={styles.upcomingClassLecturer}>GV: {item.lecturer}</Text>
        <View style={styles.upcomingClassMeta}>
          <Icon name="clock-outline" size={13} color={Colors.textMuted} />
          <Text style={styles.upcomingClassMetaText}>{item.time}</Text>
          <Icon name="map-marker-outline" size={13} color={Colors.textMuted} style={{ marginLeft: 10 }} />
          <Text style={styles.upcomingClassMetaText}>{item.room}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDark} />

      {/* Header */}
      <Animated.View style={{ opacity: headerAnim }}>
        <LinearGradient colors={['#003D6B', '#004A82', '#0066B3']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.header}>
          <View style={styles.headerDecor1} />
          <View style={styles.headerDecor2} />
          <View style={styles.headerTop}>
            <View style={styles.headerGreeting}>
              <Text style={styles.greetingText}>
                {new Date().getHours() < 12 ? 'Chào buổi sáng,' : new Date().getHours() < 18 ? 'Chào buổi chiều,' : 'Chào buổi tối,'}
              </Text>
              <Text style={styles.greetingName}>{currentUser} 👋</Text>
            </View>
            <TouchableOpacity style={styles.notifButton}>
              <Icon name="bell-outline" size={22} color={Colors.white} />
              <View style={styles.notifDot} />
            </TouchableOpacity>
          </View>
          <Text style={styles.dateText}>{formatDateHeader()}</Text>
          <View style={styles.roleBadgeRow}>
            <View style={styles.roleBadge}>
              <Icon name={isLecturer ? 'school' : 'badge-account-horizontal-outline'} size={14} color={Colors.white} />
              <Text style={styles.roleBadgeText}>
                {isLecturer ? 'Giảng viên' : 'Sinh viên'} • {isLecturer ? 'Khoa CNTT' : 'MSSV: 20001234'}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />}>

        {/* Quick Stats */}
        <Animated.View style={[styles.statsContainer, { transform: [{ scale: statsAnim }], opacity: statsAnim }]}>
          {stats.map((stat, index) => (
            <TouchableOpacity key={index} style={styles.statCard} activeOpacity={0.7}>
              <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                <Icon name={stat.icon} size={20} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        <Animated.View style={{ opacity: contentAnim }}>

          {/* ═══ COLLAPSIBLE SCHEDULE ═══ */}
          <TouchableOpacity style={styles.collapsibleHeader} onPress={toggleSchedule} activeOpacity={0.7}>
            <View style={styles.collapsibleLeft}>
              <View style={[styles.collapsibleIconWrap, { backgroundColor: '#4F46E515' }]}>
                <Icon name="calendar-today" size={18} color="#4F46E5" />
              </View>
              <View>
                <Text style={styles.collapsibleTitle}>{isLecturer ? 'Lịch dạy hôm nay' : 'Lịch học hôm nay'}</Text>
                <Text style={styles.collapsibleSubtitle}>
                  {ongoingClass ? `🔴 ${ongoingClass.subject}` : `${schedule.length} buổi`}
                  {upcomingCount > 0 ? ` • ${upcomingCount} sắp tới` : ''}
                </Text>
              </View>
            </View>
            <View style={styles.collapsibleRight}>
              {/* View mode tabs */}
              {scheduleExpanded && (
                <View style={styles.viewModeTabs}>
                  {(['day', 'week', 'month'] as const).map(mode => (
                    <TouchableOpacity
                      key={mode}
                      style={[styles.viewModeTab, scheduleViewMode === mode && styles.viewModeTabActive]}
                      onPress={() => setScheduleViewMode(mode)}
                    >
                      <Text style={[styles.viewModeText, scheduleViewMode === mode && styles.viewModeTextActive]}>
                        {mode === 'day' ? 'Ngày' : mode === 'week' ? 'Tuần' : 'Tháng'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <Animated.View style={{ transform: [{ rotate: scheduleRotation }] }}>
                <Icon name="chevron-down" size={22} color={Colors.textSecondary} />
              </Animated.View>
            </View>
          </TouchableOpacity>

          {scheduleExpanded && (
            <View style={styles.collapsibleContent}>
              {scheduleViewMode === 'day' && (
                <View style={styles.scheduleList}>
                  {schedule.length > 0 ? schedule.map(renderScheduleCard) : (
                    <View style={styles.noSchedule}>
                      <Icon name="calendar-check" size={40} color={Colors.textMuted} />
                      <Text style={styles.noScheduleText}>Không có lớp hôm nay</Text>
                    </View>
                  )}
                </View>
              )}
              {scheduleViewMode === 'week' && (
                <View style={styles.weekViewPlaceholder}>
                  <Icon name="calendar-week" size={36} color={Colors.primary} />
                  <Text style={styles.weekViewText}>Lịch tuần này</Text>
                  <Text style={styles.weekViewSubtext}>Hiển thị tổng quan 7 ngày trong tuần</Text>
                  {/* Simplified week grid */}
                  {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((day, i) => (
                    <View key={day} style={styles.weekRow}>
                      <Text style={[styles.weekRowDay, i === CURRENT_DATE.getDay() - 1 && styles.weekRowDayActive]}>{day}</Text>
                      <View style={[styles.weekRowBar, { width: `${[60, 40, 80, 60, 40, 0, 0][i]}%`, backgroundColor: [60, 40, 80, 60, 40, 0, 0][i] > 0 ? '#4F46E5' : Colors.borderLight }]} />
                      <Text style={styles.weekRowCount}>{[2, 1, 3, 2, 1, 0, 0][i]} buổi</Text>
                    </View>
                  ))}
                </View>
              )}
              {scheduleViewMode === 'month' && (
                <View style={styles.weekViewPlaceholder}>
                  <Icon name="calendar-month" size={36} color={Colors.primary} />
                  <Text style={styles.weekViewText}>Lịch tháng {CURRENT_DATE.getMonth() + 1}</Text>
                  <Text style={styles.weekViewSubtext}>Tổng: 42 buổi học • 18 tín chỉ</Text>
                </View>
              )}
            </View>
          )}

          {/* ═══ COLLAPSIBLE EXAM (Student only) ═══ */}
          {!isLecturer && (
            <>
              <TouchableOpacity style={styles.collapsibleHeader} onPress={toggleExam} activeOpacity={0.7}>
                <View style={styles.collapsibleLeft}>
                  <View style={[styles.collapsibleIconWrap, { backgroundColor: '#DC262615' }]}>
                    <Icon name="alert-decagram" size={18} color="#DC2626" />
                  </View>
                  <View>
                    <Text style={styles.collapsibleTitle}>Lịch thi sắp tới</Text>
                    <Text style={styles.collapsibleSubtitle}>
                      {UPCOMING_EXAMS.length} môn • Gần nhất: {UPCOMING_EXAMS[0]?.daysLeft} ngày nữa
                    </Text>
                  </View>
                </View>
                <Animated.View style={{ transform: [{ rotate: examRotation }] }}>
                  <Icon name="chevron-down" size={22} color={Colors.textSecondary} />
                </Animated.View>
              </TouchableOpacity>
              {examExpanded && (
                <View style={styles.collapsibleContent}>
                  {UPCOMING_EXAMS.map(item => (
                    <TouchableOpacity key={item.id} style={styles.examCard} activeOpacity={0.7}>
                      <View style={styles.examDaysLeft}>
                        <Text style={[styles.examDaysNumber, { color: item.color }]}>{item.daysLeft}</Text>
                        <Text style={[styles.examDaysLabel, { color: item.color }]}>ngày</Text>
                      </View>
                      <View style={styles.examInfo}>
                        <View style={[styles.examTypeBadge, { backgroundColor: `${item.color}20` }]}>
                          <Text style={[styles.examTypeText, { color: item.color }]}>{item.type}</Text>
                        </View>
                        <Text style={styles.examSubject} numberOfLines={1}>{item.subject}</Text>
                        <View style={styles.examMeta}>
                          <Icon name="calendar-outline" size={12} color={Colors.textMuted} />
                          <Text style={styles.examMetaText}>{item.date}</Text>
                        </View>
                        <View style={styles.examMeta}>
                          <Icon name="clock-outline" size={12} color={Colors.textMuted} />
                          <Text style={styles.examMetaText}>{item.time} • {item.room}</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </>
          )}

          {/* ═══ UPCOMING CLASSES ═══ */}
          {UPCOMING_CLASSES.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}>
                  <Icon name="timer-outline" size={20} color="#0891B2" />
                  <Text style={styles.sectionTitle}>Buổi học sắp diễn ra</Text>
                </View>
              </View>
              <View style={styles.upcomingClassList}>
                {UPCOMING_CLASSES.map(renderUpcomingClass)}
              </View>
            </>
          )}

          {/* ═══ SCHOOL ANNOUNCEMENTS ═══ */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Icon name="bullhorn" size={20} color="#EA580C" />
              <Text style={styles.sectionTitle}>Thông báo của Trường</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Tất cả</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.announcementList}>
            {SCHOOL_ANNOUNCEMENTS.map(renderAnnouncementItem)}
          </View>

          {/* ═══ FACULTY ANNOUNCEMENTS ═══ */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Icon name="domain" size={20} color="#7C3AED" />
              <Text style={styles.sectionTitle}>Thông báo của Khoa</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Tất cả</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.announcementList}>
            {FACULTY_ANNOUNCEMENTS.map(renderAnnouncementItem)}
          </View>

          {/* ═══ UPCOMING EVENTS ═══ */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Icon name="calendar-check" size={20} color="#059669" />
              <Text style={styles.sectionTitle}>Sự kiện sắp diễn ra</Text>
            </View>
            <TouchableOpacity>
              <Text style={styles.seeAllText}>Tất cả</Text>
            </TouchableOpacity>
          </View>
          {UPCOMING_EVENTS.map(renderEventCard)}

          <View style={{ height: Spacing.huge }} />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

// ============================================================
// Styles
// ============================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 20 },
  // ── Header ──
  header: { paddingTop: Spacing.lg, paddingBottom: Spacing.xxl, paddingHorizontal: Spacing.xl, position: 'relative', overflow: 'hidden' },
  headerDecor1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.04)', top: -60, right: -40 },
  headerDecor2: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.03)', bottom: -30, left: -20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerGreeting: { flex: 1 },
  greetingText: { fontSize: Typography.bodySmall, color: 'rgba(255,255,255,0.7)' },
  greetingName: { fontSize: Typography.h2, fontWeight: Typography.extraBold, color: Colors.white, marginTop: 2, letterSpacing: 0.3 },
  notifButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  notifDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#F44336', borderWidth: 1.5, borderColor: 'rgba(0,74,130,0.8)' },
  dateText: { fontSize: Typography.bodySmall, color: 'rgba(255,255,255,0.6)', marginTop: Spacing.md },
  roleBadgeRow: { marginTop: Spacing.md },
  roleBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs + 1, borderRadius: BorderRadius.round, gap: 6, alignSelf: 'flex-start' },
  roleBadgeText: { fontSize: Typography.caption, fontWeight: Typography.medium, color: 'rgba(255,255,255,0.85)' },
  // ── Stats ──
  statsContainer: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: -Spacing.lg, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.md, ...Shadows.md, gap: Spacing.sm },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, gap: 4 },
  statIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: Typography.h4, fontWeight: Typography.bold, color: Colors.textPrimary },
  statLabel: { fontSize: 9, color: Colors.textSecondary, fontWeight: Typography.medium, textAlign: 'center' },
  // ── Collapsible ──
  collapsibleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: Spacing.lg, marginTop: Spacing.lg, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, padding: Spacing.lg, ...Shadows.sm },
  collapsibleLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: Spacing.md },
  collapsibleRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  collapsibleIconWrap: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  collapsibleTitle: { fontSize: Typography.bodySmall, fontWeight: Typography.bold, color: Colors.textPrimary },
  collapsibleSubtitle: { fontSize: Typography.tiny, color: Colors.textSecondary, marginTop: 2 },
  collapsibleContent: { marginHorizontal: Spacing.lg, backgroundColor: Colors.white, borderBottomLeftRadius: BorderRadius.xl, borderBottomRightRadius: BorderRadius.xl, marginTop: -8, paddingTop: 8, paddingBottom: Spacing.md, paddingHorizontal: Spacing.md, ...Shadows.sm },
  // ── View mode tabs ──
  viewModeTabs: { flexDirection: 'row', backgroundColor: Colors.backgroundSecondary, borderRadius: BorderRadius.round, padding: 2 },
  viewModeTab: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.round },
  viewModeTabActive: { backgroundColor: Colors.primary },
  viewModeText: { fontSize: Typography.tiny, fontWeight: Typography.semiBold, color: Colors.textSecondary },
  viewModeTextActive: { color: Colors.white },
  // ── Week/Month view ──
  weekViewPlaceholder: { alignItems: 'center', paddingVertical: Spacing.lg, gap: 6 },
  weekViewText: { fontSize: Typography.body, fontWeight: Typography.bold, color: Colors.textPrimary },
  weekViewSubtext: { fontSize: Typography.caption, color: Colors.textSecondary, marginBottom: Spacing.sm },
  weekRow: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingVertical: 5, paddingHorizontal: Spacing.sm },
  weekRowDay: { width: 28, fontSize: Typography.caption, fontWeight: Typography.semiBold, color: Colors.textSecondary },
  weekRowDayActive: { color: Colors.primary, fontWeight: Typography.bold },
  weekRowBar: { height: 8, borderRadius: 4, marginRight: Spacing.sm },
  weekRowCount: { fontSize: Typography.tiny, color: Colors.textMuted },
  // ── Section header ──
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.xl, marginTop: Spacing.xxl, marginBottom: Spacing.md },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  sectionTitle: { fontSize: Typography.body, fontWeight: Typography.bold, color: Colors.textPrimary },
  seeAllText: { fontSize: Typography.caption, fontWeight: Typography.semiBold, color: Colors.primary },
  // ── Schedule Cards ──
  scheduleList: { marginTop: Spacing.sm },
  scheduleCard: { flexDirection: 'row', marginBottom: Spacing.md },
  timeColumn: { width: 50, alignItems: 'center', paddingTop: Spacing.md },
  timeStart: { fontSize: Typography.caption, fontWeight: Typography.bold, color: Colors.textPrimary },
  timeLine: { width: 2, flex: 1, marginVertical: Spacing.xs, borderRadius: 1, opacity: 0.3 },
  timeEnd: { fontSize: Typography.tiny, color: Colors.textMuted },
  scheduleCardContent: { flex: 1, flexDirection: 'row', backgroundColor: Colors.backgroundSecondary, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  scheduleCardOngoing: { borderWidth: 1, borderColor: Colors.primarySurface },
  scheduleColorBar: { width: 4 },
  scheduleCardBody: { flex: 1, padding: Spacing.md },
  scheduleCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  scheduleSubject: { fontSize: Typography.body, fontWeight: Typography.semiBold, color: Colors.textPrimary, flex: 1 },
  ongoingBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.round, gap: 4, marginLeft: Spacing.sm },
  ongoingDot: { width: 6, height: 6, borderRadius: 3 },
  ongoingText: { fontSize: Typography.tiny, fontWeight: Typography.bold },
  scheduleDetail: { fontSize: Typography.caption, color: Colors.textSecondary, marginBottom: 6 },
  scheduleMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scheduleMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  scheduleMetaText: { fontSize: Typography.tiny, color: Colors.textMuted },
  schedulePeriod: { fontSize: Typography.tiny, fontWeight: Typography.semiBold, color: Colors.textSecondary, backgroundColor: Colors.white, paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.round },
  noSchedule: { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.sm },
  noScheduleText: { fontSize: Typography.body, fontWeight: Typography.semiBold, color: Colors.textSecondary },
  // ── Exam Cards ──
  examCard: { flexDirection: 'row', backgroundColor: Colors.backgroundSecondary, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  examDaysLeft: { alignItems: 'center', justifyContent: 'center', width: 50, marginRight: Spacing.md },
  examDaysNumber: { fontSize: Typography.h2, fontWeight: Typography.extraBold },
  examDaysLabel: { fontSize: Typography.tiny, fontWeight: Typography.semiBold, marginTop: -2 },
  examInfo: { flex: 1, gap: 3 },
  examTypeBadge: { alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.round },
  examTypeText: { fontSize: Typography.tiny, fontWeight: Typography.bold },
  examSubject: { fontSize: Typography.bodySmall, fontWeight: Typography.semiBold, color: Colors.textPrimary },
  examMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  examMetaText: { fontSize: Typography.tiny, color: Colors.textMuted },
  // ── Upcoming Classes ──
  upcomingClassList: { marginHorizontal: Spacing.lg, gap: Spacing.sm },
  upcomingClassCard: { flexDirection: 'row', backgroundColor: Colors.white, borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.sm },
  upcomingClassBar: { width: 4 },
  upcomingClassBody: { flex: 1, padding: Spacing.md },
  upcomingClassRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  upcomingClassName: { fontSize: Typography.bodySmall, fontWeight: Typography.semiBold, color: Colors.textPrimary, flex: 1 },
  nextBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.round, marginLeft: Spacing.sm },
  nextBadgeText: { fontSize: Typography.tiny, fontWeight: Typography.bold },
  upcomingClassLecturer: { fontSize: Typography.caption, color: Colors.textSecondary, marginBottom: 4 },
  upcomingClassMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  upcomingClassMetaText: { fontSize: Typography.tiny, color: Colors.textMuted },
  // ── Announcements ──
  announcementList: { marginHorizontal: Spacing.lg, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, overflow: 'hidden', ...Shadows.sm },
  announcementItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  announcementIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  announcementContent: { flex: 1 },
  announcementTitle: { fontSize: Typography.bodySmall, fontWeight: Typography.medium, color: Colors.textPrimary },
  announcementMeta: { fontSize: Typography.tiny, color: Colors.textMuted, marginTop: 2 },
  newDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginLeft: Spacing.sm },
  // ── Events ──
  eventCard: { marginHorizontal: Spacing.lg, borderRadius: BorderRadius.xl, overflow: 'hidden', marginBottom: Spacing.md, ...Shadows.sm },
  eventCardGradient: { flexDirection: 'row', padding: Spacing.lg, backgroundColor: Colors.white, borderRadius: BorderRadius.xl, borderWidth: 1, borderColor: Colors.borderLight },
  eventIconWrap: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  eventInfo: { flex: 1, gap: 3 },
  eventTitle: { fontSize: Typography.bodySmall, fontWeight: Typography.semiBold, color: Colors.textPrimary },
  eventOrganizer: { fontSize: Typography.caption, fontWeight: Typography.medium, color: Colors.textSecondary },
  eventMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventMetaText: { fontSize: Typography.tiny, color: Colors.textMuted },
  eventAttendees: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  eventAttendeesText: { fontSize: Typography.tiny, fontWeight: Typography.bold },
});

export default HomeScreen;

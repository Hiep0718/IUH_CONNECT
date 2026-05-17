import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme/theme';

const { width } = Dimensions.get('window');

interface StickerPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelectSticker: (sticker: string, type: 'emoji' | 'sticker') => void;
}

const CATEGORIES = [
  {
    type: 'emoji',
    name: '😀 Mặt cười',
    items: ['😀', '😃', '😄', '😁', '😆', '🥹', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪'],
  },
  {
    type: 'emoji',
    name: '❤️ Trái tim',
    items: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💔', '❣️', '💟', '♥️'],
  },
  {
    type: 'emoji',
    name: '👋 Tay',
    items: ['👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '👏', '🙌', '🫶', '🙏'],
  },
  {
    type: 'sticker',
    name: '🐱 Mèo',
    items: [
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Cat%20Face.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Grinning%20Cat%20with%20Smiling%20Eyes.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Cat%20with%20Tears%20of%20Joy.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Smiling%20Cat%20with%20Heart-Eyes.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Kissing%20Cat.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Weary%20Cat.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Crying%20Cat.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Pouting%20Cat.png',
    ]
  },
  {
    type: 'sticker',
    name: '🐶 Cún',
    items: [
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Dog%20Face.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Guide%20Dog.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Poodle.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Wolf.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Fox.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Raccoon.png',
    ]
  },
  {
    type: 'sticker',
    name: '🌟 Khác',
    items: [
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Panda.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Bear.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Koala.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Tiger%20Face.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Lion.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Animals/Frog.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Beaming%20Face%20with%20Smiling%20Eyes.png',
      'https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Face%20with%20Tears%20of%20Joy.png',
    ]
  }
];

const StickerPicker: React.FC<StickerPickerProps> = ({ visible, onClose, onSelectSticker }) => {
  const [selectedCategory, setSelectedCategory] = useState(0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container} onStartShouldSetResponder={() => true}>
          {/* Handle bar */}
          <View style={styles.handle} />

          {/* Title */}
          <Text style={styles.title}>Sticker & Emoji</Text>

          {/* Category tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabs}
            contentContainerStyle={styles.categoryTabsContent}
            keyboardShouldPersistTaps="handled"
          >
            {CATEGORIES.map((cat, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.categoryTab,
                  selectedCategory === index && styles.categoryTabActive,
                ]}
                onPress={() => setSelectedCategory(index)}
              >
                <Text style={[
                  styles.categoryTabText,
                  selectedCategory === index && styles.categoryTabTextActive,
                ]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Emoji grid */}
          <ScrollView
            style={styles.emojiScroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.emojiGrid}>
              {CATEGORIES[selectedCategory].items.map((item, index) => {
                const isSticker = CATEGORIES[selectedCategory].type === 'sticker';
                return (
                  <TouchableOpacity
                    key={index}
                    style={styles.emojiItem}
                    onPress={() => {
                      onSelectSticker(item, isSticker ? 'sticker' : 'emoji');
                      onClose();
                    }}
                    activeOpacity={0.6}
                  >
                    {isSticker ? (
                      <Image source={{ uri: item }} style={styles.stickerImage} resizeMode="contain" />
                    ) : (
                      <Text style={styles.emojiText}>{item}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: 400,
    paddingBottom: 30,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  title: {
    fontSize: Typography.h4,
    fontWeight: Typography.bold as any,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
  },
  categoryTabs: {
    maxHeight: 44,
    marginBottom: Spacing.sm,
  },
  categoryTabsContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  categoryTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.background,
  },
  categoryTabActive: {
    backgroundColor: Colors.primaryGhost,
  },
  categoryTabText: {
    fontSize: Typography.caption,
    color: Colors.textSecondary,
    fontWeight: Typography.medium as any,
  },
  categoryTabTextActive: {
    color: Colors.primary,
    fontWeight: Typography.bold as any,
  },
  emojiScroll: {
    flex: 1,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
  },
  emojiItem: {
    width: width / 8,
    height: width / 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 28,
    color: '#000000',
    opacity: 1,
  },
  stickerImage: {
    width: 36,
    height: 36,
  },
});

export default StickerPicker;

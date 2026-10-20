import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Toast, { ToastConfig, ToastConfigParams } from 'react-native-toast-message';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface ToastCardProps {
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message?: string;
  onClose?: () => void;
}

const THEME_CONFIG = {
  success: {
    accent: '#10b981',       // Emerald 500
    iconBg: '#d1fae5',       // Emerald 100
    iconColor: '#059669',    // Emerald 600
    icon: '✓',
    defaultTitle: 'Success',
  },
  error: {
    accent: '#ef4444',       // Red 500
    iconBg: '#fee2e2',       // Red 100
    iconColor: '#dc2626',    // Red 600
    icon: '✕',
    defaultTitle: 'Error',
  },
  info: {
    accent: '#0284c7',       // Sky 600
    iconBg: '#e0f2fe',       // Sky 100
    iconColor: '#0284c7',    // Sky 600
    icon: 'ℹ',
    defaultTitle: 'Information',
  },
  warning: {
    accent: '#f59e0b',       // Amber 500
    iconBg: '#fef3c7',       // Amber 100
    iconColor: '#d97706',    // Amber 600
    icon: '⚠',
    defaultTitle: 'Attention',
  },
};

const CustomToastCard: React.FC<ToastCardProps> = ({ type, title, message, onClose }) => {
  const theme = THEME_CONFIG[type];
  const displayTitle = title || theme.defaultTitle;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onClose}
      style={[
        styles.cardContainer,
        {
          borderLeftColor: theme.accent,
        },
      ]}
    >
      <View style={styles.cardInner}>
        {/* Leading Icon Badge */}
        <View style={[styles.iconBadge, { backgroundColor: theme.iconBg }]}>
          <Text style={[styles.iconText, { color: theme.iconColor }]}>{theme.icon}</Text>
        </View>

        {/* Text Content */}
        <View style={styles.textContainer}>
          <Text style={styles.titleText} numberOfLines={2}>
            {displayTitle}
          </Text>
          {message ? (
            <Text style={styles.messageText} numberOfLines={3}>
              {message}
            </Text>
          ) : null}
        </View>

        {/* Close Button */}
        <TouchableOpacity
          onPress={onClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.closeBtn}
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

export const toastConfig: ToastConfig = {
  success: ({ text1, text2, hide }: ToastConfigParams<any>) => (
    <CustomToastCard type="success" title={text1} message={text2} onClose={hide} />
  ),
  error: ({ text1, text2, hide }: ToastConfigParams<any>) => (
    <CustomToastCard type="error" title={text1} message={text2} onClose={hide} />
  ),
  info: ({ text1, text2, hide }: ToastConfigParams<any>) => (
    <CustomToastCard type="info" title={text1} message={text2} onClose={hide} />
  ),
  warning: ({ text1, text2, hide }: ToastConfigParams<any>) => (
    <CustomToastCard type="warning" title={text1} message={text2} onClose={hide} />
  ),
};

export const toast = {
  success: (title: string, message?: string, options?: { duration?: number }) => {
    Toast.show({
      type: 'success',
      text1: title,
      text2: message,
      visibilityTime: options?.duration ?? 3500,
      autoHide: true,
      topOffset: 52,
    });
  },
  error: (title: string, message?: string, options?: { duration?: number }) => {
    Toast.show({
      type: 'error',
      text1: title,
      text2: message,
      visibilityTime: options?.duration ?? 4500,
      autoHide: true,
      topOffset: 52,
    });
  },
  info: (title: string, message?: string, options?: { duration?: number }) => {
    Toast.show({
      type: 'info',
      text1: title,
      text2: message,
      visibilityTime: options?.duration ?? 3500,
      autoHide: true,
      topOffset: 52,
    });
  },
  warning: (title: string, message?: string, options?: { duration?: number }) => {
    Toast.show({
      type: 'warning',
      text1: title,
      text2: message,
      visibilityTime: options?.duration ?? 4000,
      autoHide: true,
      topOffset: 52,
    });
  },
  hide: () => {
    Toast.hide();
  },
};

export default toast;

const styles = StyleSheet.create({
  cardContainer: {
    width: Math.min(SCREEN_WIDTH - 28, 420),
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderLeftWidth: 5,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
    marginHorizontal: 14,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  iconText: {
    fontSize: 15,
    fontWeight: '800',
  },
  textContainer: {
    flex: 1,
    paddingRight: 6,
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 18,
  },
  messageText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  closeBtnText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '700',
  },
});

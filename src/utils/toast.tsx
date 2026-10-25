import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Toast, { ToastConfig, ToastConfigParams } from 'react-native-toast-message';
import { colors } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface ToastCardProps {
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message?: string;
  onClose?: () => void;
}

const THEME_CONFIG = {
  success: {
    accent: colors.telemetry.moving,
    iconBg: '#ecfdf5',
    iconColor: colors.telemetry.movingDark,
    icon: '✓',
    defaultTitle: 'Success',
  },
  error: {
    accent: colors.telemetry.alert,
    iconBg: '#fff1f2',
    iconColor: '#be123c',
    icon: '✕',
    defaultTitle: 'Error',
  },
  info: {
    accent: colors.primary[500], // Signature Matte Orange
    iconBg: colors.primary[50],
    iconColor: colors.primary[600],
    icon: 'ℹ',
    defaultTitle: 'VIGIL Telemetry',
  },
  warning: {
    accent: colors.telemetry.idle,
    iconBg: '#fef3c7',
    iconColor: colors.telemetry.idleDark,
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
    backgroundColor: colors.day.card,
    borderRadius: 16,
    borderLeftWidth: 5,
    borderTopWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.day.cardBorder,
    shadowColor: colors.day.foreground,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
    marginHorizontal: 14,
  },
  cardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
    fontWeight: '800',
    color: colors.day.foreground,
    lineHeight: 18,
    letterSpacing: 0.2,
  },
  messageText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.day.mutedForeground,
    marginTop: 2,
    lineHeight: 16,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
  },
  closeBtnText: {
    fontSize: 13,
    color: colors.day.mutedForeground,
    fontWeight: '700',
  },
});

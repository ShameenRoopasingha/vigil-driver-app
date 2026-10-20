import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Vibration,
  Linking,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigationRef } from '../navigation/navigationRef';
import { locationService } from '../services/locationService';

interface NavArcItem {
  id: string;
  name: string;
  screen?: string;
  icon: string;
  color: string;
  bgColor: string;
  action?: () => void;
  badge?: string;
}

export default function ArcNavbar() {
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<string>('Dashboard');
  const [onDuty, setOnDuty] = useState(true);
  const [showSosModal, setShowSosModal] = useState(false);
  const [companyPhone, setCompanyPhone] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('Tour Transport Office');

  // Animation values
  const animValue = useRef(new Animated.Value(0)).current;

  // Listen to navigation state changes to know current route
  useEffect(() => {
    const checkRoute = () => {
      if (navigationRef.isReady()) {
        const route = navigationRef.getCurrentRoute();
        if (route?.name) {
          setCurrentRoute(route.name);
        }
      }
    };

    const interval = setInterval(checkRoute, 600);
    checkRoute();

    // Load driver company info & duty status
    AsyncStorage.getItem('driverData').then((val) => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          if (parsed.companyPhone) setCompanyPhone(parsed.companyPhone);
          if (parsed.companyName) setCompanyName(parsed.companyName);
        } catch {}
      }
    });

    AsyncStorage.getItem('driver_duty_status').then((val) => {
      if (val !== null) {
        setOnDuty(val === 'true');
      }
    });

    return () => clearInterval(interval);
  }, []);

  const toggleDuty = async () => {
    try {
      Vibration.vibrate(15);
      const nextDuty = !onDuty;
      setOnDuty(nextDuty);
      await AsyncStorage.setItem('driver_duty_status', String(nextDuty));
      Alert.alert(
        nextDuty ? '🟢 Status: On Duty' : '☕ Status: Resting / Off Duty',
        nextDuty
          ? 'You are marked as available for scheduled tours & passenger transfers.'
          : 'You are marked as resting. Enjoy your break!'
      );
    } catch {}
  };

  const toggleMenu = () => {
    Vibration.vibrate(15);
    if (isOpen) {
      Animated.timing(animValue, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => setIsOpen(false));
    } else {
      setIsOpen(true);
      Animated.spring(animValue, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }).start();
    }
  };

  const closeMenu = (callback?: () => void) => {
    Animated.timing(animValue, {
      toValue: 0,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      setIsOpen(false);
      if (callback) callback();
    });
  };

  const handleNavigate = (screen?: string, action?: () => void) => {
    Vibration.vibrate(12);
    closeMenu(() => {
      if (action) {
        action();
      } else if (screen && navigationRef.isReady()) {
        if (screen === 'ActiveTour') {
          const activeBookingId = locationService.getActiveBookingId();
          if (activeBookingId) {
            navigationRef.navigate('ActiveTour', { bookingId: activeBookingId });
          } else {
            navigationRef.navigate('Dashboard');
            Alert.alert('No Active Tour', 'Please select a tour from your dashboard to view its live route.');
          }
        } else {
          // Normal screen navigation
          navigationRef.navigate(screen as any);
        }
      }
    });
  };

  const handleEmergencySOS = () => {
    setShowSosModal(true);
  };

  const triggerCallOffice = () => {
    setShowSosModal(false);
    if (companyPhone) {
      Linking.openURL(`tel:${companyPhone}`);
    } else {
      Alert.alert('Office Phone', 'Company dispatch phone number is not configured in your profile.');
    }
  };

  const triggerBreakdownReport = () => {
    setShowSosModal(false);
    const activeBookingId = locationService.getActiveBookingId();
    if (activeBookingId && navigationRef.isReady()) {
      navigationRef.navigate('ActiveTour', { bookingId: activeBookingId });
      Alert.alert(
        'Breakdown Dispatch',
        'Please tap "Report Breakdown" under Tour Actions to alert office and request vehicle swap.'
      );
    } else {
      Alert.alert(
        'Emergency Assistance',
        'Connecting you to Sri Lanka Tourist Police / Emergency Hotline (1912 / 119) or Fleet Dispatch.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Call Hotline (1912)',
            onPress: () => Linking.openURL('tel:1912'),
          },
          ...(companyPhone
            ? [
                {
                  text: `Call Office (${companyPhone})`,
                  onPress: () => Linking.openURL(`tel:${companyPhone}`),
                },
              ]
            : []),
        ]
      );
    }
  };

  // Do not show on Splash or Login screens
  if (currentRoute === 'Splash' || currentRoute === 'Login') {
    return null;
  }

  // Arc Navigation Items
  const items: NavArcItem[] = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      screen: 'Dashboard',
      icon: '🏠',
      color: '#2563eb',
      bgColor: '#eff6ff',
    },
    {
      id: 'activeTour',
      name: 'Active Tour',
      screen: 'ActiveTour',
      icon: '⚡',
      color: '#059669',
      bgColor: '#ecfdf5',
      badge: locationService.isTripTrackingActive() ? 'LIVE' : undefined,
    },
    {
      id: 'calendar',
      name: 'Calendar',
      screen: 'Calendar',
      icon: '📅',
      color: '#7c3aed',
      bgColor: '#f5f3ff',
    },
    {
      id: 'expense',
      name: 'Add Expense',
      screen: 'AddExpense',
      icon: '💸',
      color: '#d97706',
      bgColor: '#fffbeb',
    },
    {
      id: 'profile',
      name: 'Profile',
      screen: 'Profile',
      icon: '👤',
      color: '#0284c7',
      bgColor: '#f0f9ff',
    },
    {
      id: 'sos',
      name: 'Emergency SOS',
      icon: '🚨',
      color: '#dc2626',
      bgColor: '#fef2f2',
      action: handleEmergencySOS,
    },
  ];

  // Arc Geometry parameters (items fan out up & left from bottom-right corner)
  const RADIUS = 148;
  const START_ANGLE = 95 * (Math.PI / 180); // ~95 degrees (almost straight up)
  const END_ANGLE = 175 * (Math.PI / 180);  // ~175 degrees (almost straight left)
  const ANGLE_STEP = (END_ANGLE - START_ANGLE) / (items.length - 1);

  const bottomOffset = Math.max(insets.bottom, 16) + 16;
  const rightOffset = 20;

  return (
    <>
      {/* Fullscreen Backdrop when Arc is Open */}
      {isOpen && (
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: animValue.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1],
              }),
            },
          ]}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => closeMenu()}
          />
        </Animated.View>
      )}

      {/* Duty Status Pill (Visible when Arc is Open) */}
      {isOpen && (
        <Animated.View
          style={[
            styles.dutyPillContainer,
            {
              bottom: bottomOffset + 220,
              right: rightOffset,
              opacity: animValue,
              transform: [
                {
                  scale: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.7, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={toggleDuty}
            style={[
              styles.dutyPill,
              { backgroundColor: onDuty ? '#ecfdf5' : '#fef2f2', borderColor: onDuty ? '#a7f3d0' : '#fecaca' },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: onDuty ? '#10b981' : '#ef4444' }]} />
            <Text style={[styles.dutyText, { color: onDuty ? '#065f46' : '#991b1b' }]}>
              {onDuty ? 'Status: ON DUTY' : 'Status: RESTING'}
            </Text>
            <Text style={styles.dutySubtext}>Tap to toggle</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Arc Radial Items */}
      {items.map((item, index) => {
        const angle = START_ANGLE + index * ANGLE_STEP;
        const targetX = -RADIUS * Math.cos(angle - Math.PI / 2);
        const targetY = -RADIUS * Math.sin(angle - Math.PI / 2);

        const translateX = animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, targetX],
        });

        const translateY = animValue.interpolate({
          inputRange: [0, 1],
          outputRange: [0, targetY],
        });

        const scale = animValue.interpolate({
          inputRange: [0, 0.4, 1],
          outputRange: [0, 0.5, 1],
        });

        const opacity = animValue.interpolate({
          inputRange: [0, 0.2, 1],
          outputRange: [0, 0.8, 1],
        });

        const isActive = item.screen === currentRoute;

        return (
          <Animated.View
            key={item.id}
            pointerEvents={isOpen ? 'auto' : 'none'}
            style={[
              styles.arcItemWrapper,
              {
                bottom: bottomOffset + 6,
                right: rightOffset + 6,
                transform: [{ translateX }, { translateY }, { scale }],
                opacity,
              },
            ]}
          >
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleNavigate(item.screen, item.action)}
              style={[
                styles.arcItemButton,
                {
                  backgroundColor: item.bgColor,
                  borderColor: isActive ? item.color : '#e2e8f0',
                  borderWidth: isActive ? 2.5 : 1.5,
                },
              ]}
            >
              <Text style={styles.arcItemIcon}>{item.icon}</Text>
              {item.badge && (
                <View style={styles.itemBadge}>
                  <Text style={styles.itemBadgeText}>{item.badge}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Label Underneath Item */}
            <View style={styles.itemLabelBox}>
              <Text
                style={[
                  styles.itemLabelText,
                  { color: isActive ? item.color : '#334155', fontWeight: isActive ? '900' : '700' },
                ]}
                numberOfLines={1}
              >
                {item.name}
              </Text>
            </View>
          </Animated.View>
        );
      })}

      {/* Main Floating Arc Trigger Button */}
      <View style={[styles.triggerWrapper, { bottom: bottomOffset, right: rightOffset }]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={toggleMenu}
          style={[
            styles.triggerButton,
            { backgroundColor: isOpen ? '#0f172a' : '#1e3a8a' },
          ]}
        >
          <Animated.View
            style={{
              transform: [
                {
                  rotate: animValue.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '135deg'],
                  }),
                },
              ],
            }}
          >
            {isOpen ? (
              <Text style={styles.triggerIconClose}>✕</Text>
            ) : (
              <View style={styles.triggerIconGrid}>
                <View style={styles.gridRow}>
                  <View style={[styles.gridDot, { backgroundColor: '#38bdf8' }]} />
                  <View style={[styles.gridDot, { backgroundColor: '#34d399' }]} />
                </View>
                <View style={styles.gridRow}>
                  <View style={[styles.gridDot, { backgroundColor: '#fbbf24' }]} />
                  <View style={[styles.gridDot, { backgroundColor: '#f472b6' }]} />
                </View>
              </View>
            )}
          </Animated.View>
        </TouchableOpacity>

        {/* Pulse ring when trip tracking is active */}
        {locationService.isTripTrackingActive() && !isOpen && (
          <View pointerEvents="none" style={styles.liveRing} />
        )}
      </View>

      {/* Emergency SOS Quick Action Modal */}
      <Modal
        visible={showSosModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSosModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderIcon}>🚨</Text>
              <Text style={styles.modalTitle}>Emergency Assistance</Text>
              <Text style={styles.modalSubtitle}>Quick 1-tap roadside & fleet support</Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={triggerCallOffice}
              style={styles.sosActionButtonPrimary}
            >
              <Text style={styles.sosActionIcon}>📞</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sosActionTitle}>Call Fleet Office Hotline</Text>
                <Text style={styles.sosActionDesc}>
                  {companyPhone ? `Direct call to ${companyName} (${companyPhone})` : 'Company phone not configured'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={triggerBreakdownReport}
              style={styles.sosActionButtonSecondary}
            >
              <Text style={styles.sosActionIcon}>🛠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sosActionTitle}>Report Vehicle Breakdown</Text>
                <Text style={styles.sosActionDesc}>
                  Dispatches emergency vehicle swap & notifies fleet manager
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => Linking.openURL('tel:1912')}
              style={styles.sosActionButtonTertiary}
            >
              <Text style={styles.sosActionIcon}>🛡️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.sosActionTitle}>Sri Lanka Tourist Police</Text>
                <Text style={styles.sosActionDesc}>Dial 1912 24/7 dedicated tourist safety helpline</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowSosModal(false)}
              style={styles.modalCloseButton}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    zIndex: 9000,
  },
  triggerWrapper: {
    position: 'absolute',
    zIndex: 9999,
  },
  triggerButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#38bdf8',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
  },
  triggerIconClose: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
  },
  triggerIconGrid: {
    width: 22,
    height: 22,
    justifyContent: 'space-between',
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 33,
    borderWidth: 2.5,
    borderColor: '#10b981',
    opacity: 0.8,
  },
  arcItemWrapper: {
    position: 'absolute',
    zIndex: 9500,
    alignItems: 'center',
    width: 60,
  },
  arcItemButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  arcItemIcon: {
    fontSize: 22,
  },
  itemBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#10b981',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: '#ffffff',
  },
  itemBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  itemLabelBox: {
    marginTop: 3,
    backgroundColor: '#ffffff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  itemLabelText: {
    fontSize: 10,
    textAlign: 'center',
  },
  dutyPillContainer: {
    position: 'absolute',
    zIndex: 9500,
  },
  dutyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  dutyText: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginRight: 6,
  },
  dutySubtext: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalHeaderIcon: {
    fontSize: 36,
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    marginTop: 2,
  },
  sosActionButtonPrimary: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.5,
    borderColor: '#bfdbfe',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sosActionButtonSecondary: {
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#fde68a',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sosActionButtonTertiary: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sosActionIcon: {
    fontSize: 26,
    marginRight: 14,
  },
  sosActionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  sosActionDesc: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    fontWeight: '500',
  },
  modalCloseButton: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#475569',
    fontWeight: '800',
    fontSize: 14,
  },
});

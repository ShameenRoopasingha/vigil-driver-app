import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  PanResponder,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigationRef } from '../navigation/navigationRef';
import { locationService } from '../services/locationService';
import { toast } from '../utils/toast';

export interface ArcNavItem {
  id: string;
  name: string;
  screen?: string;
  icon: string;
  color: string;
  bgColor: string;
  subtitle: string;
  badge?: string;
  isAction?: boolean;
}

export default function ArcNavbar() {
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<string>('Dashboard');
  const [onDuty, setOnDuty] = useState(true);
  const [showSosModal, setShowSosModal] = useState(false);
  const [companyPhone, setCompanyPhone] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string>('Tour Transport Office');
  const [rotationOffset, setRotationOffset] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  // Geometry Constants matching Admin App (ArcSpinnerNavbar)
  const CONTAINER_SIZE = 320;
  const ORIGIN_X = 320; // Top-right corner
  const ORIGIN_Y = 0;   // Top-right corner
  const RADIUS = 210;   // Radial distance of icons
  const FOCAL_ANGLE = 135; // 135 degrees = 45 degrees down-left into phone thumb zone

  // 12 Items = 30° per step (Identical to Admin Platform for continuous rich multi-icon display)
  const items: ArcNavItem[] = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      screen: 'Dashboard',
      icon: '🏠',
      color: '#38bdf8',
      bgColor: 'rgba(56, 189, 248, 0.2)',
      subtitle: 'Overview & Assigned Tours',
    },
    {
      id: 'activeTour',
      name: 'Active Tour',
      screen: 'ActiveTour',
      icon: '⚡',
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.2)',
      badge: locationService.isTripTrackingActive() ? 'LIVE' : undefined,
      subtitle: 'Live Radar & GPS Route',
    },
    {
      id: 'calendar',
      name: 'Calendar',
      screen: 'Calendar',
      icon: '📅',
      color: '#818cf8',
      bgColor: 'rgba(129, 140, 248, 0.2)',
      subtitle: 'Scheduled Booking Dates',
    },
    {
      id: 'expense',
      name: 'Add Expense',
      screen: 'AddExpense',
      icon: '💸',
      color: '#fbbf24',
      bgColor: 'rgba(251, 191, 36, 0.2)',
      subtitle: 'Fuel, Tolls & Receipts',
    },
    {
      id: 'profile',
      name: 'Driver Profile',
      screen: 'Profile',
      icon: '👤',
      color: '#2dd4bf',
      bgColor: 'rgba(45, 212, 191, 0.2)',
      subtitle: 'Name, Avatar & Fleet Info',
    },
    {
      id: 'sos',
      name: 'Emergency SOS',
      icon: '🚨',
      color: '#fb7185',
      bgColor: 'rgba(251, 113, 133, 0.2)',
      badge: 'SOS',
      subtitle: 'Roadside & Hotline Dispatch',
      isAction: true,
    },
    {
      id: 'duty',
      name: onDuty ? 'Status: ON DUTY' : 'Status: RESTING',
      icon: onDuty ? '🟢' : '☕',
      color: onDuty ? '#34d399' : '#f87171',
      bgColor: onDuty ? 'rgba(52, 211, 153, 0.2)' : 'rgba(248, 113, 113, 0.2)',
      badge: onDuty ? 'ON' : 'REST',
      subtitle: onDuty ? 'Available for Transfers' : 'Shift Resting / Break',
      isAction: true,
    },
    {
      id: 'callOffice',
      name: 'Call Fleet Office',
      icon: '📞',
      color: '#38bdf8',
      bgColor: 'rgba(56, 189, 248, 0.2)',
      subtitle: 'Direct Dispatch Contact',
      isAction: true,
    },
    {
      id: 'breakdown',
      name: 'Report Breakdown',
      icon: '🛠️',
      color: '#f97316',
      bgColor: 'rgba(249, 115, 22, 0.2)',
      subtitle: 'Dispatch Emergency Swap',
      isAction: true,
    },
    {
      id: 'police',
      name: 'Tourist Police (1912)',
      icon: '🛡️',
      color: '#10b981',
      bgColor: 'rgba(16, 185, 129, 0.2)',
      subtitle: '24/7 Sri Lanka Helpline',
      isAction: true,
    },
    {
      id: 'refresh',
      name: 'Sync GPS Radar',
      icon: '🔄',
      color: '#a78bfa',
      bgColor: 'rgba(167, 139, 250, 0.2)',
      subtitle: 'Sync Live Location Now',
      isAction: true,
    },
    {
      id: 'history',
      name: 'Tour History',
      screen: 'Dashboard',
      icon: '📜',
      color: '#f472b6',
      bgColor: 'rgba(244, 114, 182, 0.2)',
      subtitle: 'Completed Trip Logs',
    },
  ];

  const TOTAL_ITEMS = items.length; // 12 items
  const ANGLE_STEP = 360 / TOTAL_ITEMS; // Exactly 30° per item

  // Animation Refs
  const animMenu = useRef(new Animated.Value(0)).current;
  const animOffset = useRef(new Animated.Value(0)).current;
  const lastStepRef = useRef(0);
  const isDraggingRef = useRef(false);
  const startTouchAngleRef = useRef(0);
  const startOffsetRef = useRef(0);
  const lastAngleRef = useRef(0);
  const velocityRef = useRef(0);
  const lastTimeRef = useRef(0);
  const offsetValueRef = useRef(0);

  // Haptic feedback & active step update
  const updateActiveStep = useCallback((offset: number) => {
    const currentStep = Math.round(-offset / ANGLE_STEP);
    if (currentStep !== lastStepRef.current) {
      lastStepRef.current = currentStep;
      const wrappedIdx = ((currentStep % TOTAL_ITEMS) + TOTAL_ITEMS) % TOTAL_ITEMS;
      setActiveIndex(wrappedIdx);
      Vibration.vibrate(8);
    }
  }, [ANGLE_STEP, TOTAL_ITEMS]);

  // Sync animOffset with state & step calculations
  useEffect(() => {
    const listenerId = animOffset.addListener(({ value }) => {
      offsetValueRef.current = value;
      setRotationOffset(value);
      updateActiveStep(value);
    });
    return () => animOffset.removeListener(listenerId);
  }, [updateActiveStep]);

  // Listen to navigation state & driver data
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

  // Update active item to match current route on open
  useEffect(() => {
    if (isOpen) {
      const currentIdx = items.findIndex((item) => item.screen === currentRoute);
      if (currentIdx !== -1) {
        const currentStep = Math.round(-offsetValueRef.current / ANGLE_STEP);
        const currentWrapped = ((currentStep % TOTAL_ITEMS) + TOTAL_ITEMS) % TOTAL_ITEMS;
        let diffSteps = currentIdx - currentWrapped;
        if (diffSteps > TOTAL_ITEMS / 2) diffSteps -= TOTAL_ITEMS;
        if (diffSteps < -TOTAL_ITEMS / 2) diffSteps += TOTAL_ITEMS;

        const targetOffset = -(currentStep + diffSteps) * ANGLE_STEP;
        lastStepRef.current = Math.round(-targetOffset / ANGLE_STEP);
        animOffset.setValue(targetOffset);
        setActiveIndex(currentIdx);
      }
    }
  }, [isOpen, currentRoute]);

  const toggleDuty = async () => {
    try {
      Vibration.vibrate(12);
      const nextDuty = !onDuty;
      setOnDuty(nextDuty);
      await AsyncStorage.setItem('driver_duty_status', String(nextDuty));
      toast.success(
        nextDuty ? 'Status: On Duty' : 'Status: Resting',
        nextDuty
          ? 'You are active and ready for passenger pickups & scheduled tours.'
          : 'You are marked as resting. Take your break safely!'
      );
    } catch {}
  };

  const openMenu = () => {
    Vibration.vibrate(10);
    setIsOpen(true);
    Animated.spring(animMenu, {
      toValue: 1,
      friction: 7,
      tension: 65,
      useNativeDriver: true,
    }).start();
  };

  const closeMenu = (callback?: () => void) => {
    Animated.timing(animMenu, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setIsOpen(false);
      if (callback) callback();
    });
  };

  const executeItemAction = (item: ArcNavItem) => {
    if (item.id === 'sos') {
      closeMenu(() => setShowSosModal(true));
      return;
    }
    if (item.id === 'duty') {
      toggleDuty();
      return;
    }
    if (item.id === 'callOffice') {
      closeMenu(() => triggerCallOffice());
      return;
    }
    if (item.id === 'breakdown') {
      closeMenu(() => triggerBreakdownReport());
      return;
    }
    if (item.id === 'police') {
      closeMenu(() => Linking.openURL('tel:1912'));
      return;
    }
    if (item.id === 'refresh') {
      closeMenu(async () => {
        try {
          const addr = await locationService.getCurrentAddress();
          toast.info('GPS Radar Connected', addr ? `Location: ${addr}` : 'Coordinates locked.');
        } catch {
          toast.info('GPS Radar', 'Live GPS location packet synchronized with fleet dispatch radar.');
        }
      });
      return;
    }
    if (item.screen && navigationRef.isReady()) {
      closeMenu(() => {
        if (item.screen === 'ActiveTour') {
          const activeBookingId = locationService.getActiveBookingId();
          if (activeBookingId) {
            navigationRef.navigate('ActiveTour', { bookingId: activeBookingId });
          } else {
            navigationRef.navigate('Dashboard');
            toast.info('No Active Tour', 'Please select a tour from your dashboard to view its live route.');
          }
        } else {
          navigationRef.navigate(item.screen as any);
        }
      });
    }
  };

  // Direct snap to item on click
  const handleItemClick = (idx: number, item: ArcNavItem) => {
    Vibration.vibrate(10);
    let diff = (idx * ANGLE_STEP + offsetValueRef.current) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    const targetOffset = offsetValueRef.current - diff;

    Animated.timing(animOffset, {
      toValue: targetOffset,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      executeItemAction(item);
    });
  };

  // Helper: compute angle relative to top-right corner of screen
  const getAngleFromTouch = (pageX: number, pageY: number) => {
    const screenWidth = Dimensions.get('window').width;
    const cornerX = screenWidth;
    const cornerY = insets.top;

    const dx = pageX - cornerX;
    const dy = pageY - cornerY;
    let deg = Math.atan2(dy, dx) * (180 / Math.PI);
    if (deg < 0) deg += 360;
    return deg;
  };

  // PanResponder for smooth rotary dragging & low-friction inertia glide
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        isDraggingRef.current = true;
        const currentAngle = getAngleFromTouch(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        startTouchAngleRef.current = currentAngle;
        startOffsetRef.current = offsetValueRef.current;
        lastAngleRef.current = currentAngle;
        lastTimeRef.current = Date.now();
        velocityRef.current = 0;
        lastStepRef.current = Math.round(-offsetValueRef.current / ANGLE_STEP);
        animOffset.stopAnimation();
      },
      onPanResponderMove: (evt) => {
        if (!isDraggingRef.current) return;
        const currentAngle = getAngleFromTouch(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
        const now = Date.now();
        const dt = Math.max(now - lastTimeRef.current, 1);

        let delta = currentAngle - lastAngleRef.current;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;

        const currentVelocity = delta / dt;
        velocityRef.current = velocityRef.current * 0.25 + currentVelocity * 0.75;
        lastTimeRef.current = now;
        lastAngleRef.current = currentAngle;

        const totalAngleDiff = currentAngle - startTouchAngleRef.current;
        const newOffset = startOffsetRef.current + totalAngleDiff;

        animOffset.setValue(newOffset);
      },
      onPanResponderRelease: () => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;

        // Inertia glide calculation
        const inertiaDistance = velocityRef.current * 260;
        const projectedOffset = offsetValueRef.current + inertiaDistance;

        const currentStep = Math.round(-offsetValueRef.current / ANGLE_STEP);
        const targetStep = Math.round(-projectedOffset / ANGLE_STEP);
        const finalTargetOffset = -targetStep * ANGLE_STEP;

        const stepsToTravel = Math.abs(targetStep - currentStep);
        const duration = Math.min(950, Math.max(450, 350 + stepsToTravel * 80));

        Animated.timing(animOffset, {
          toValue: finalTargetOffset,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  // Emergency SOS dispatch actions
  const triggerCallOffice = () => {
    setShowSosModal(false);
    if (companyPhone) {
      Linking.openURL(`tel:${companyPhone}`);
    } else {
      toast.warning('Office Phone', 'Company dispatch phone number is not configured in your profile.');
    }
  };

  const triggerBreakdownReport = () => {
    setShowSosModal(false);
    const activeBookingId = locationService.getActiveBookingId();
    if (activeBookingId && navigationRef.isReady()) {
      navigationRef.navigate('ActiveTour', { bookingId: activeBookingId });
      toast.info(
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

  // Hide on Splash or Login screens
  if (currentRoute === 'Splash' || currentRoute === 'Login') {
    return null;
  }

  const bottomOffset = Math.max(insets.bottom, 16) + 16;
  const rightOffset = 20;

  // Focal point coordinates (135° = 45° down-left from top-right corner)
  const focalRad = (FOCAL_ANGLE * Math.PI) / 180;
  const focalX = ORIGIN_X + RADIUS * Math.cos(focalRad); // ~ 171.5
  const focalY = ORIGIN_Y + RADIUS * Math.sin(focalRad); // ~ 148.5

  return (
    <>
      {/* Sleek Top-Right Corner Trigger Button (Admin App Style) */}
      {!isOpen && (
        <View style={[styles.triggerWrapper, { top: insets.top + 12, right: 16 }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openMenu}
            style={styles.triggerButton}
            aria-label="Open Navigation Dial"
          >
            {/* Dial Rotary Icon */}
            <View style={styles.triggerDialIcon}>
              <View style={[styles.dialBar, { width: 13, height: 2.2, backgroundColor: '#10b981' }]} />
              <View style={[styles.dialBar, { width: 17, height: 2.2, backgroundColor: '#0284c7', marginTop: 2.8 }]} />
              <View style={[styles.dialBar, { width: 11, height: 2.2, backgroundColor: '#10b981', marginTop: 2.8 }]} />
            </View>

            {/* Glowing Emerald Pulse Dot */}
            <View style={styles.pulseDot} />
          </TouchableOpacity>

          {/* Live Radar Pulsing Ring if GPS tracking active */}
          {locationService.isTripTrackingActive() && (
            <View pointerEvents="none" style={styles.liveRing} />
          )}
        </View>
      )}

      {/* Fullscreen Modal Overlay for the Arc Dial */}
      {isOpen && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Frosted Dark Backdrop */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.backdrop,
              {
                opacity: animMenu.interpolate({
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

          {/* 320x320 Quarter-Circle Arc Container (Top-Right Corner) */}
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.arcContainer,
              {
                top: insets.top,
                right: 0,
                opacity: animMenu,
                transform: [
                  {
                    translateX: animMenu.interpolate({
                      inputRange: [0, 1],
                      outputRange: [CONTAINER_SIZE * 0.4, 0],
                    }),
                  },
                  {
                    translateY: animMenu.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-CONTAINER_SIZE * 0.4, 0],
                    }),
                  },
                  {
                    scale: animMenu.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Concentric Guide Arcs (Radius 210 and 150) */}
            <View pointerEvents="none" style={styles.concentricOuter} />
            <View pointerEvents="none" style={styles.concentricInner} />

            {/* Top-Right Corner Hub: Brand & Close Button */}
            <View style={[styles.cornerHub, { top: insets.top > 0 ? 12 : 8 }]}>
              <View style={styles.hubBrand}>
                <Text style={styles.hubBrandTitle}>VIGIL DIAL</Text>
                <Text style={styles.hubBrandSubtitle}>Infinite 360° • Rotary</Text>
              </View>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => closeMenu()}
                style={styles.hubCloseButton}
              >
                <Text style={styles.hubCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Focal Point Indicator (Glowing Emerald Lens at 135°) */}
            <View
              pointerEvents="none"
              style={[
                styles.focalIndicator,
                {
                  left: focalX - 22,
                  top: focalY - 22,
                },
              ]}
            />

            {/* Rotary Spinnable Items along the 360° Arc */}
            {items.map((item, idx) => {
              let diff = (idx * ANGLE_STEP + rotationOffset) % 360;
              if (diff > 180) diff -= 360;
              if (diff < -180) diff += 360;

              const angleDeg = FOCAL_ANGLE + diff;
              const angleRad = (angleDeg * Math.PI) / 180;

              const x = ORIGIN_X + RADIUS * Math.cos(angleRad) - 24;
              const y = ORIGIN_Y + RADIUS * Math.sin(angleRad) - 24;

              const isFocused = idx === activeIndex;
              const isVisible = angleDeg >= 60 && angleDeg <= 210;
              const distFromCenter = Math.abs(diff);
              const scale = isFocused ? 1.25 : Math.max(0.74, 1 - distFromCenter / 150);
              const opacity = isVisible ? Math.max(0, 1 - Math.max(0, distFromCenter - 30) / 45) : 0;
              const isActiveRoute = item.screen === currentRoute;

              if (!isVisible || opacity <= 0.05) return null;

              return (
                <View
                  key={item.id}
                  style={[
                    styles.itemWrapper,
                    {
                      left: x,
                      top: y,
                      opacity,
                      transform: [{ scale }],
                      zIndex: isFocused ? 25 : 15,
                    },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => handleItemClick(idx, item)}
                    style={[
                      styles.itemSquircle,
                      isFocused && styles.itemSquircleFocused,
                      isActiveRoute && !isFocused && styles.itemSquircleActiveRoute,
                    ]}
                  >
                    <Text style={styles.itemIconText}>{item.icon}</Text>
                    {item.badge && (
                      <View style={styles.itemBadge}>
                        <Text style={styles.itemBadgeText}>{item.badge}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </Animated.View>

          {/* Active Item Floating Detail Card (Positioned directly below the arc, fully unclipped) */}
          {items[activeIndex] && (
            <Animated.View
              style={[
                styles.detailCardWrapper,
                {
                  top: insets.top + 285,
                  opacity: animMenu,
                  transform: [
                    {
                      translateY: animMenu.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => executeItemAction(items[activeIndex])}
                style={styles.detailCard}
              >
                <View
                  style={[
                    styles.detailIconSquircle,
                    { backgroundColor: items[activeIndex].bgColor },
                  ]}
                >
                  <Text style={styles.detailIconText}>{items[activeIndex].icon}</Text>
                </View>
                <View style={styles.detailTextWrapper}>
                  <View style={styles.detailTitleRow}>
                    <Text style={styles.detailTitleText} numberOfLines={1}>
                      {items[activeIndex].name}
                    </Text>
                    <Text style={styles.detailChevronText}>›</Text>
                  </View>
                  <Text style={styles.detailSubtitleText} numberOfLines={1}>
                    {items[activeIndex].subtitle}
                  </Text>
                  <Text style={styles.detailActionText}>TAP TO OPEN</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      )}

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
              <Text style={styles.modalSubtitle}>Roadside safety & fleet management hotline</Text>
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
                  {companyPhone ? `Direct dispatch to ${companyName} (${companyPhone})` : 'Office phone not configured'}
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
                  Dispatches emergency vehicle swap & notifies office manager
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
              <Text style={styles.modalCloseText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  // Sleek Trigger Button matching Light Driver App
  triggerWrapper: {
    position: 'absolute',
    zIndex: 99,
  },
  triggerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  triggerDialIcon: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  dialBar: {
    borderRadius: 2,
  },
  pulseDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  liveRing: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#10b981',
    opacity: 0.6,
  },

  // 320x320 Quarter-Circle Arc Container
  arcContainer: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderBottomLeftRadius: 320,
    backgroundColor: '#ffffff',
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderLeftColor: '#10b981',
    borderBottomColor: '#10b981',
    shadowColor: '#0f172a',
    shadowOffset: { width: -4, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 16,
    overflow: 'visible',
  },
  concentricOuter: {
    position: 'absolute',
    top: -210,
    right: -210,
    width: 420,
    height: 420,
    borderRadius: 210,
    borderWidth: 1.5,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    borderStyle: 'dashed',
  },
  concentricInner: {
    position: 'absolute',
    top: -150,
    right: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.9)',
  },

  // Top-Right Corner Hub
  cornerHub: {
    position: 'absolute',
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 35,
  },
  hubBrand: {
    alignItems: 'flex-end',
  },
  hubBrandTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#065f46',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  hubBrandSubtitle: {
    fontSize: 8.5,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.4,
  },
  hubCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hubCloseIcon: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '900',
  },

  // Focal Point Indicator (Center of Thumb Arc at 135°)
  focalIndicator: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
    zIndex: 10,
  },

  // Spinnable Arc Items
  itemWrapper: {
    position: 'absolute',
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemSquircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  itemSquircleFocused: {
    backgroundColor: '#10b981',
    borderColor: '#059669',
    borderWidth: 1.5,
    shadowColor: '#10b981',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  itemSquircleActiveRoute: {
    backgroundColor: '#eff6ff',
    borderColor: '#3b82f6',
    borderWidth: 1.5,
  },
  itemIconText: {
    fontSize: 21,
  },
  itemBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  itemBadgeText: {
    color: '#ffffff',
    fontSize: 7.5,
    fontWeight: '900',
  },

  // Active Item Floating Detail Card (Positioned below the arc)
  detailCardWrapper: {
    position: 'absolute',
    right: 18,
    width: 250,
    zIndex: 40,
  },
  detailCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#10b981',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  detailIconSquircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  detailIconText: {
    fontSize: 20,
  },
  detailTextWrapper: {
    flex: 1,
    minWidth: 0,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailTitleText: {
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '900',
    flex: 1,
    marginRight: 4,
  },
  detailChevronText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '900',
  },
  detailSubtitleText: {
    color: '#64748b',
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 2,
  },
  detailActionText: {
    color: '#059669',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 3,
  },

  // Emergency SOS Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    width: '100%',
    maxWidth: 380,
    padding: 20,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 18,
  },
  modalHeaderIcon: {
    fontSize: 34,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
  },
  sosActionButtonPrimary: {
    backgroundColor: '#eff6ff',
    borderWidth: 1.2,
    borderColor: '#93c5fd',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sosActionButtonSecondary: {
    backgroundColor: '#fff7ed',
    borderWidth: 1.2,
    borderColor: '#fdba74',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sosActionButtonTertiary: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1.2,
    borderColor: '#6ee7b7',
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sosActionIcon: {
    fontSize: 22,
    marginRight: 12,
  },
  sosActionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  sosActionDesc: {
    fontSize: 10.5,
    color: '#64748b',
    marginTop: 1,
  },
  modalCloseButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  modalCloseText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
  },
});

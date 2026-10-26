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
import { WebView } from 'react-native-webview';
import { navigationRef } from '../navigation/navigationRef';
import { locationService } from '../services/locationService';
import { toast } from '../utils/toast';
import { useTheme } from '../context/ThemeContext';

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

// Crisp mechanical watch ratchet "tiki-tiki" sound synthesizer (identical to Admin App ArcSpinnerNavbar)
const AUDIO_HTML = `
<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<script>
  var audioCtx = null;
  function getAudioCtx() {
    try {
      if (!audioCtx) {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) audioCtx = new AudioContextClass();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
    } catch(e) {}
    return audioCtx;
  }
  window.playTick = function() {
    try {
      var ctx = getAudioCtx();
      if (!ctx) return;
      var now = ctx.currentTime;
      var osc1 = ctx.createOscillator();
      var gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(4800, now);
      osc1.frequency.exponentialRampToValueAtTime(3200, now + 0.007);
      gain1.gain.setValueAtTime(0.09, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.007);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.008);

      var osc2 = ctx.createOscillator();
      var gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(6500, now + 0.003);
      osc2.frequency.exponentialRampToValueAtTime(4400, now + 0.009);
      gain2.gain.setValueAtTime(0, now);
      gain2.gain.setValueAtTime(0.06, now + 0.003);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.009);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.003);
      osc2.stop(now + 0.010);
    } catch(e) {}
  };
  document.addEventListener('touchstart', function() { getAudioCtx(); }, { once: true });
</script>
</head>
<body style="background:transparent;margin:0;padding:0;"></body>
</html>
`;

export default function ArcNavbar() {
  const insets = useSafeAreaInsets();
  const { isDark, colors, toggleTheme } = useTheme();

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

  // 12 Items = exactly 30° per step for seamless 360° wheel (matching Admin App)
  const items: ArcNavItem[] = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      screen: 'Dashboard',
      icon: '🏠',
      color: isDark ? '#38bdf8' : '#0284c7',
      bgColor: isDark ? 'rgba(56, 189, 248, 0.2)' : 'rgba(2, 132, 199, 0.15)',
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
      color: isDark ? '#818cf8' : '#4f46e5',
      bgColor: isDark ? 'rgba(129, 140, 248, 0.2)' : 'rgba(79, 70, 229, 0.15)',
      subtitle: 'Scheduled Booking Dates',
    },
    {
      id: 'expense',
      name: 'Add Expense',
      screen: 'AddExpense',
      icon: '💸',
      color: isDark ? '#fbbf24' : '#d97706',
      bgColor: isDark ? 'rgba(251, 191, 36, 0.2)' : 'rgba(217, 119, 6, 0.15)',
      subtitle: 'Fuel, Tolls & Receipts',
    },
    {
      id: 'profile',
      name: 'Driver Profile',
      screen: 'Profile',
      icon: '👤',
      color: isDark ? '#2dd4bf' : '#0d9488',
      bgColor: isDark ? 'rgba(45, 212, 191, 0.2)' : 'rgba(13, 148, 136, 0.15)',
      subtitle: 'Name, Avatar & Fleet Info',
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
      id: 'callOffice',
      name: 'Call Fleet Office',
      icon: '📞',
      color: isDark ? '#38bdf8' : '#0284c7',
      bgColor: isDark ? 'rgba(56, 189, 248, 0.2)' : 'rgba(2, 132, 199, 0.15)',
      subtitle: 'Direct Dispatch Contact',
      isAction: true,
    },
    {
      id: 'breakdown',
      name: 'Report Breakdown',
      icon: '🛠️',
      color: '#E8732A',
      bgColor: 'rgba(232, 115, 42, 0.2)',
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
      color: isDark ? '#a78bfa' : '#7c3aed',
      bgColor: isDark ? 'rgba(167, 139, 250, 0.2)' : 'rgba(124, 58, 237, 0.15)',
      subtitle: 'Sync Live Location Now',
      isAction: true,
    },
  ];

  const TOTAL_ITEMS = items.length;
  const ANGLE_STEP = 360 / TOTAL_ITEMS;

  // Animations
  const [animMenu] = useState(() => new Animated.Value(0));
  const [animOffset] = useState(() => new Animated.Value(0));
  const audioWebviewRef = useRef<WebView>(null);
  const lastStepRef = useRef(0);
  const isDraggingRef = useRef(false);
  const startTouchAngleRef = useRef(0);
  const startOffsetRef = useRef(0);
  const lastAngleRef = useRef(0);
  const velocityRef = useRef(0);
  const lastTimeRef = useRef(0);
  const offsetValueRef = useRef(0);

  // Play mechanical watch ratchet "tiki-tiki" sound (identical to Admin App)
  const playTickSound = useCallback(() => {
    try {
      audioWebviewRef.current?.injectJavaScript('window.playTick && window.playTick(); true;');
    } catch {}
  }, []);

  // Update step, active index, sound and haptic vibration
  const updateActiveStep = useCallback((offset: number) => {
    const currentStep = Math.round(-offset / ANGLE_STEP);
    if (currentStep !== lastStepRef.current) {
      lastStepRef.current = currentStep;
      const wrappedIdx = ((currentStep % TOTAL_ITEMS) + TOTAL_ITEMS) % TOTAL_ITEMS;
      setActiveIndex(wrappedIdx);
      playTickSound();
      Vibration.vibrate(8);
    }
  }, [ANGLE_STEP, TOTAL_ITEMS, playTickSound]);

  // Sync animOffset with state & step calculations
  useEffect(() => {
    const listenerId = animOffset.addListener(({ value }) => {
      offsetValueRef.current = value;
      setRotationOffset(value);
      updateActiveStep(value);
    });
    return () => animOffset.removeListener(listenerId);
  }, [updateActiveStep, animOffset]);

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

  const toggleDuty = async () => {
    try {
      playTickSound();
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
    playTickSound();
    Vibration.vibrate(10);

    // Auto-center current route on opening along shortest circular path (Admin App parity)
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
      setRotationOffset(targetOffset);
      setActiveIndex(currentIdx);
    }

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
      duration: 220,
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

  // Direct snap to item on click along shortest circular path (Admin App parity)
  const handleItemClick = (idx: number, item: ArcNavItem) => {
    playTickSound();
    Vibration.vibrate(10);

    let diff = (idx * ANGLE_STEP + offsetValueRef.current) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    const targetOffset = offsetValueRef.current - diff;

    Animated.timing(animOffset, {
      toValue: targetOffset,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      closeMenu(() => {
        executeItemAction(item);
      });
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
  // Configured to allow child clicks to pass through without being blocked!
  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6;
      },
      onMoveShouldSetPanResponderCapture: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 6 || Math.abs(gestureState.dy) > 6;
      },
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
      onPanResponderRelease: (evt, gestureState) => {
        if (!isDraggingRef.current) return;
        isDraggingRef.current = false;

        // Direct tap detection on the radial wheel
        const totalMovement = Math.hypot(gestureState.dx, gestureState.dy);
        if (totalMovement < 8) {
          const touchAngle = getAngleFromTouch(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
          const screenWidth = Dimensions.get('window').width;
          const cornerX = screenWidth;
          const cornerY = insets.top;
          const dist = Math.hypot(evt.nativeEvent.pageX - cornerX, evt.nativeEvent.pageY - cornerY);

          if (dist >= RADIUS - 50 && dist <= RADIUS + 50) {
            let closestIdx = -1;
            let minDiff = Infinity;
            for (let i = 0; i < TOTAL_ITEMS; i++) {
              let diff = (i * ANGLE_STEP + offsetValueRef.current) % 360;
              if (diff > 180) diff -= 360;
              if (diff < -180) diff += 360;
              const itemAngle = FOCAL_ANGLE + diff;
              const angleDiff = Math.abs(((itemAngle - touchAngle + 180) % 360) - 180);
              if (angleDiff < minDiff) {
                minDiff = angleDiff;
                closestIdx = i;
              }
            }
            if (closestIdx !== -1 && minDiff < ANGLE_STEP * 0.75) {
              handleItemClick(closestIdx, items[closestIdx]);
              return;
            }
          }
        }

        // Low-friction inertia glide calculation (Admin App parity: velocity * 280)
        const inertiaDistance = velocityRef.current * 280;
        const projectedOffset = offsetValueRef.current + inertiaDistance;

        const currentStep = Math.round(-offsetValueRef.current / ANGLE_STEP);
        const targetStep = Math.round(-projectedOffset / ANGLE_STEP);
        const finalTargetOffset = -targetStep * ANGLE_STEP;

        const stepsToTravel = Math.abs(targetStep - currentStep);
        const duration = Math.min(1000, Math.max(450, 350 + stepsToTravel * 90));

        Animated.timing(animOffset, {
          toValue: finalTargetOffset,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start();
      },
    })
  );

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

  // Focal point coordinates (135° = 45° down-left from top-right corner)
  const focalRad = (FOCAL_ANGLE * Math.PI) / 180;
  const focalX = ORIGIN_X + RADIUS * Math.cos(focalRad); // ~ 171.5
  const focalY = ORIGIN_Y + RADIUS * Math.sin(focalRad); // ~ 148.5

  return (
    <>
      {/* Hidden Web Audio Ratchet Synthesizer (Zero overhead, instant mechanical click) */}
      <View style={{ width: 0, height: 0, opacity: 0, position: 'absolute' }}>
        <WebView
          ref={audioWebviewRef}
          originWhitelist={['*']}
          source={{ html: AUDIO_HTML }}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          androidLayerType="software"
        />
      </View>

      {/* Sleek Top-Right Corner Trigger Button with Day/Night Theming */}
      {!isOpen && (
        <View style={[styles.triggerWrapper, { top: insets.top + 10, right: 16 }]}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={openMenu}
            style={[
              styles.triggerButton,
              {
                backgroundColor: colors.triggerBg,
                borderColor: colors.triggerBorder,
                shadowColor: isDark ? '#000000' : '#0f172a',
              },
            ]}
            aria-label="Open Navigation Dial"
          >
            {/* Dial Rotary Bars in High-Contrast Day/Night Tokens */}
            <View style={styles.triggerDialIcon}>
              <View style={[styles.dialBar, { width: 14, height: 2.2, backgroundColor: colors.dialBarColor }]} />
              <View style={[styles.dialBar, { width: 18, height: 2.2, backgroundColor: colors.primary, marginTop: 2.8 }]} />
              <View style={[styles.dialBar, { width: 12, height: 2.2, backgroundColor: colors.dialBarColor, marginTop: 2.8 }]} />
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
        <View style={[StyleSheet.absoluteFill, { zIndex: 10002, elevation: 25 }]} pointerEvents="box-none">
          {/* Frosted Backdrop (Tapping closes menu) */}
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.backdrop,
              {
                backgroundColor: colors.modalOverlay,
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
                backgroundColor: colors.navBackground,
                borderLeftColor: colors.navBorder,
                borderBottomColor: colors.navBorder,
                shadowColor: isDark ? '#000000' : '#0f172a',
                opacity: animMenu,
                transform: [
                  {
                    translateX: animMenu.interpolate({
                      inputRange: [0, 1],
                      outputRange: [CONTAINER_SIZE * 0.35, 0],
                    }),
                  },
                  {
                    translateY: animMenu.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-CONTAINER_SIZE * 0.35, 0],
                    }),
                  },
                  {
                    scale: animMenu.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Concentric Guide Arcs (Outer Radius 210 dashed, Inner Radius 150) */}
            <View
              pointerEvents="none"
              style={[
                styles.concentricOuter,
                { borderColor: colors.navConcentricOuter },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.concentricInner,
                { borderColor: colors.navConcentricInner },
              ]}
            />

            {/* Top-Right Corner Hub: Brand, Quick 1-Tap Day/Night Switcher & Close Button */}
            <View style={[styles.cornerHub, { top: 10 }]}>
              <View style={styles.hubBrand}>
                <Text style={[styles.hubBrandTitle, { color: isDark ? '#34d399' : '#065f46' }]}>VIGIL DIAL</Text>
                <Text style={[styles.hubBrandSubtitle, { color: isDark ? '#94a3b8' : '#64748b' }]}>
                  {isDark ? 'NIGHT COCKPIT' : 'DAY ALABASTER'}
                </Text>
              </View>

              {/* Quick 1-Tap Day/Night Theme Toggle */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => {
                  playTickSound();
                  Vibration.vibrate(10);
                  toggleTheme();
                  toast.info(
                    isDark ? '☀️ Day Mode Active' : '🌙 Night Mode Active',
                    isDark ? 'Alabaster daylight theme activated.' : 'Obsidian cockpit night vision activated.'
                  );
                }}
                style={[
                  styles.hubThemeButton,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#e2e8f0',
                  },
                ]}
                aria-label="Toggle Theme"
              >
                <Text style={{ fontSize: 13 }}>{isDark ? '🌙' : '☀️'}</Text>
              </TouchableOpacity>

              {/* Close Button */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => closeMenu()}
                style={[
                  styles.hubCloseButton,
                  {
                    backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#e2e8f0',
                  },
                ]}
              >
                <Text style={[styles.hubCloseIcon, { color: colors.textPrimary }]}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Focal Point Indicator (Glowing Emerald Lens at 135°) */}
            <View
              pointerEvents="none"
              style={[
                styles.focalIndicator,
                {
                  left: focalX - 20,
                  top: focalY - 20,
                  borderColor: colors.accent,
                  backgroundColor: colors.accentGlow,
                },
              ]}
            />

            {/* Rotary Spinnable Items along the 360° Infinite Arc */}
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
              const scale = isFocused ? 1.25 : Math.max(0.76, 1 - distFromCenter / 145);
              const opacity = isVisible ? Math.max(0, 1 - Math.max(0, distFromCenter - 28) / 45) : 0;
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
                    activeOpacity={0.7}
                    onPress={() => handleItemClick(idx, item)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={[
                      styles.itemSquircle,
                      {
                        backgroundColor: colors.squircleBg,
                        borderColor: colors.squircleBorder,
                      },
                      isFocused && [
                        styles.itemSquircleFocused,
                        {
                          backgroundColor: colors.squircleFocusedBg,
                          borderColor: colors.squircleFocusedBorder,
                        },
                      ],
                      isActiveRoute && !isFocused && [
                        styles.itemSquircleActiveRoute,
                        {
                          backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)',
                          borderColor: colors.accent,
                        },
                      ],
                    ]}
                  >
                    <Text style={[styles.itemIconText, isFocused && { color: '#ffffff' }]}>
                      {item.icon}
                    </Text>
                    {item.badge && (
                      <View style={[styles.itemBadge, { backgroundColor: item.badge === 'LIVE' ? '#10b981' : colors.primary }]}>
                        <Text style={styles.itemBadgeText}>{item.badge}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Active Item Floating Detail Card (Positioned at bottom-left corner of Arc, Admin App Parity) */}
            {items[activeIndex] && (
              <View style={styles.detailCardContainer} pointerEvents="box-none">
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    closeMenu(() => {
                      executeItemAction(items[activeIndex]);
                    });
                  }}
                  style={[
                    styles.detailCard,
                    {
                      backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.96)',
                      borderColor: isDark ? 'rgba(16, 185, 129, 0.45)' : 'rgba(16, 185, 129, 0.45)',
                      shadowColor: isDark ? '#000000' : '#0f172a',
                    },
                  ]}
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
                      <Text
                        style={[styles.detailTitleText, { color: colors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {items[activeIndex].name}
                      </Text>
                      <Text style={[styles.detailChevronText, { color: isDark ? '#34d399' : '#059669' }]}>›</Text>
                    </View>
                    <Text
                      style={[styles.detailSubtitleText, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {items[activeIndex].subtitle}
                    </Text>
                    <Text style={[styles.detailActionText, { color: isDark ? '#34d399' : '#059669' }]}>
                      TAP TO OPEN
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </View>
      )}

      {/* Emergency SOS Quick Action Modal with Day/Night Support */}
      <Modal
        visible={showSosModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSosModal(false)}
      >
        <View style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: colors.modalBg,
                borderColor: colors.modalBorder,
                shadowColor: isDark ? '#000000' : '#0f172a',
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeaderIcon}>🚨</Text>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Emergency Assistance</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                Roadside safety & fleet management hotline
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={triggerCallOffice}
              style={[
                styles.sosActionButtonPrimary,
                {
                  backgroundColor: isDark ? '#111827' : '#eff6ff',
                  borderColor: isDark ? 'rgba(56, 189, 248, 0.4)' : '#93c5fd',
                },
              ]}
            >
              <Text style={styles.sosActionIcon}>📞</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sosActionTitle, { color: colors.textPrimary }]}>Call Fleet Office Hotline</Text>
                <Text style={[styles.sosActionDesc, { color: colors.textSecondary }]}>
                  {companyPhone ? `Direct dispatch to ${companyName} (${companyPhone})` : 'Office phone not configured'}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={triggerBreakdownReport}
              style={[
                styles.sosActionButtonSecondary,
                {
                  backgroundColor: isDark ? '#111827' : '#fff7ed',
                  borderColor: isDark ? 'rgba(232, 115, 42, 0.4)' : '#fdba74',
                },
              ]}
            >
              <Text style={styles.sosActionIcon}>🛠️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sosActionTitle, { color: colors.textPrimary }]}>Report Vehicle Breakdown</Text>
                <Text style={[styles.sosActionDesc, { color: colors.textSecondary }]}>
                  Dispatches emergency vehicle swap & notifies office manager
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                setShowSosModal(false);
                Linking.openURL('tel:1912');
              }}
              style={[
                styles.sosActionButtonTertiary,
                {
                  backgroundColor: isDark ? '#111827' : '#ecfdf5',
                  borderColor: isDark ? 'rgba(16, 185, 129, 0.4)' : '#6ee7b7',
                },
              ]}
            >
              <Text style={styles.sosActionIcon}>🛡️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sosActionTitle, { color: colors.textPrimary }]}>Tourist Police Hotline (1912)</Text>
                <Text style={[styles.sosActionDesc, { color: colors.textSecondary }]}>
                  Toll-free 24/7 dedicated tourist safety helpline
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => setShowSosModal(false)}
              style={[
                styles.modalCloseButton,
                {
                  backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#e2e8f0',
                },
              ]}
            >
              <Text style={[styles.modalCloseText, { color: colors.textPrimary }]}>Close Emergency Menu</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  triggerWrapper: {
    position: 'absolute',
    zIndex: 9999,
    elevation: 20,
  },
  triggerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
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
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    shadowOffset: { width: -4, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 25,
    zIndex: 10003,
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
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  hubBrandSubtitle: {
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  hubThemeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hubCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hubCloseIcon: {
    fontSize: 12,
    fontWeight: '900',
  },

  // Focal Point Indicator (Center of Thumb Arc at 135°)
  focalIndicator: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 6,
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
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  itemSquircleFocused: {
    borderWidth: 1.8,
    shadowColor: '#10b981',
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 8,
  },
  itemSquircleActiveRoute: {
    borderWidth: 1.6,
  },
  itemIconText: {
    fontSize: 21,
  },
  itemBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  itemBadgeText: {
    color: '#ffffff',
    fontSize: 7.5,
    fontWeight: '900',
  },

  // Active Item Floating Detail Card (Positioned at bottom-left corner of Arc, Admin App Parity)
  detailCardContainer: {
    position: 'absolute',
    left: 18,
    bottom: 18,
    width: 255,
    zIndex: 40,
    elevation: 26,
  },
  detailCard: {
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 11,
    flexDirection: 'row',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
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
    fontSize: 13.5,
    fontWeight: '900',
    flex: 1,
    marginRight: 4,
  },
  detailChevronText: {
    fontSize: 16,
    fontWeight: '900',
  },
  detailSubtitleText: {
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 2,
  },
  detailActionText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginTop: 3,
  },

  // Emergency SOS Modal
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 22,
    borderWidth: 1.5,
    width: '100%',
    maxWidth: 380,
    padding: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
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
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
  sosActionButtonPrimary: {
    borderWidth: 1.2,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sosActionButtonSecondary: {
    borderWidth: 1.2,
    borderRadius: 14,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sosActionButtonTertiary: {
    borderWidth: 1.2,
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
  },
  sosActionDesc: {
    fontSize: 10.5,
    marginTop: 1,
  },
  modalCloseButton: {
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalCloseText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

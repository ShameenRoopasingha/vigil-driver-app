import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { locationService, TrackingStatus } from '../services/locationService';
import { navigationRef } from '../navigation/navigationRef';
import { colors } from '../theme';

export default function LiveLocationNotificationBar() {
  const insets = useSafeAreaInsets();
  
  const [currentRoute, setCurrentRoute] = useState<string>(() => {
    try {
      if (navigationRef.isReady()) {
        return navigationRef.getCurrentRoute()?.name || '';
      }
    } catch {}
    return '';
  });

  const [status, setStatus] = useState<TrackingStatus>({
    isTracking: false,
    isMoving: false,
    activeBookingId: null,
    currentSpeed: 0,
    lastPingTime: null,
    pendingOfflineCount: 0,
    lastError: null,
  });

  useEffect(() => {
    const updateRoute = () => {
      if (navigationRef.isReady()) {
        const route = navigationRef.getCurrentRoute();
        if (route?.name && route.name !== currentRoute) {
          setCurrentRoute(route.name);
        }
      }
    };

    updateRoute();
    const interval = setInterval(updateRoute, 300);

    const unsubscribeNav = navigationRef.addListener?.('state', () => {
      updateRoute();
    });

    return () => {
      clearInterval(interval);
      if (typeof unsubscribeNav === 'function') {
        unsubscribeNav();
      }
    };
  }, [currentRoute]);

  useEffect(() => {
    const unsubscribe = locationService.subscribeStatus((st) => {
      setStatus(st);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // NEVER show on ActiveTour screen (the active tour screen has its own rich status banner)
  // NEVER show on Splash or Login
  if (!status.isTracking || currentRoute === 'ActiveTour' || currentRoute === 'Splash' || currentRoute === 'Login') {
    return null;
  }

  const handlePress = () => {
    const bookingId = status.activeBookingId || locationService.getActiveBookingId();
    if (bookingId && navigationRef.isReady()) {
      navigationRef.navigate('ActiveTour', { bookingId });
    }
  };

  const speedText = status.currentSpeed > 5
    ? `Moving • ${Math.round(status.currentSpeed)} km/h`
    : 'Stationary / Parked';

  return (
    <View style={[styles.container, { paddingTop: Math.max(insets.top, 8) }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={handlePress}
        style={styles.touchable}
      >
        <View style={styles.leftRow}>
          <View style={styles.logoWrapper}>
            <Image 
              source={require('../../assets/logo-icon.png')} 
              style={{ width: 20, height: 20 }} 
              resizeMode="contain" 
            />
          </View>
          <View style={styles.pulseDotWrapper}>
            <View style={styles.pulseDotRing} />
            <View style={styles.pulseDot} />
          </View>
          <View style={styles.textColumn}>
            <Text style={styles.titleText}>VIGIL LIVE RADAR</Text>
            <Text style={styles.subtitleText}>
              {speedText} • {status.pendingOfflineCount > 0 ? `📦 ${status.pendingOfflineCount} cached` : 'Synced with office'}
            </Text>
          </View>
        </View>

        <View style={styles.viewBadge}>
          <Text style={styles.viewBadgeText}>Tour →</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0D0D0D', // Midnight Obsidian Base
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(232, 115, 42, 0.45)', // Signature Matte Orange hairline
    zIndex: 9990,
    elevation: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 14,
    paddingRight: 64, // Clears the ArcNavbar trigger button in top-right corner
    paddingVertical: 10,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  logoWrapper: {
    width: 28,
    height: 28,
    backgroundColor: '#1A1B1C',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#2E3035',
  },
  pulseDotWrapper: {
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  pulseDotRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(16, 185, 129, 0.35)',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.telemetry.moving,
  },
  textColumn: {
    flex: 1,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  subtitleText: {
    color: colors.night.mutedForeground,
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 1,
  },
  viewBadge: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 10,
    shadowColor: colors.primary[500],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 3,
  },
  viewBadgeText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
});

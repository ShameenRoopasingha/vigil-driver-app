import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { locationService, TrackingStatus } from '../services/locationService';
import { RootStackParamList } from '../../App';

export default function LiveLocationNotificationBar() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
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
    const unsubscribe = locationService.subscribeStatus((st) => {
      setStatus(st);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  if (!status.isTracking) {
    return null;
  }

  const handlePress = () => {
    const bookingId = status.activeBookingId || locationService.getActiveBookingId();
    if (bookingId) {
      navigation.navigate('ActiveTour', { bookingId });
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
          <Image 
            source={require('../../assets/logo-icon.png')} 
            style={{ width: 22, height: 22, marginRight: 8 }} 
            resizeMode="contain" 
          />
          <View style={styles.pulseDotWrapper}>
            <View style={styles.pulseDotRing} />
            <View style={styles.pulseDot} />
          </View>
          <View style={styles.textColumn}>
            <Text style={styles.titleText}>VIGIL Live Radar Active</Text>
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
    backgroundColor: '#064e3b', // Deep emerald green
    borderBottomWidth: 1,
    borderBottomColor: '#059669',
    zIndex: 9999,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  touchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
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
    backgroundColor: 'rgba(52, 211, 153, 0.4)',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#34d399', // Bright emerald dot
  },
  textColumn: {
    flex: 1,
  },
  titleText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  subtitleText: {
    color: '#a7f3d0',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  viewBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#34d399',
  },
  viewBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
});

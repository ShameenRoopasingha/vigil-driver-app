import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';

const OFFLINE_STORAGE_KEY = '@offline_gps_breadcrumbs';
const NOTIFICATION_ID = 'vigil_live_location_tracking';
const CHANNEL_ID = 'vigil_live_tracking_channel';

async function setupNotificationChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Live GPS Location Tracking',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250],
      lightColor: '#059669',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      showBadge: true,
      sound: null,
      enableVibrate: false,
    });
  }
}

async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    return finalStatus === 'granted';
  } catch (e) {
    console.warn('Error checking notification permission:', e);
    return false;
  }
}

export interface LocationPing {
  lat: number;
  lon: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
  battery?: number | null;
  timestamp: string;
}

export interface TrackingStatus {
  isTracking: boolean;
  isMoving: boolean;
  lastPingTime: Date | null;
  pendingOfflineCount: number;
  lastError: string | null;
}

class DriverLocationService {
  private isTracking: boolean = false;
  private activeBookingId: string | null = null;
  private locationSubscription: Location.LocationSubscription | null = null;
  private timerId: any = null;
  private lastSentTime: number = 0;
  private currentSpeed: number = 0;
  private latestLocation: Location.LocationObject | null = null;
  private statusListeners: Array<(status: TrackingStatus) => void> = [];
  private lastError: string | null = null;
  private offlineCount: number = 0;

  constructor() {
    this.refreshOfflineCount();
  }

  // Subscribe to tracking status updates in UI
  public subscribeStatus(listener: (status: TrackingStatus) => void) {
    this.statusListeners.push(listener);
    this.notifyStatus();
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notifyStatus() {
    const status: TrackingStatus = {
      isTracking: this.isTracking,
      isMoving: this.currentSpeed > 5,
      lastPingTime: this.lastSentTime ? new Date(this.lastSentTime) : null,
      pendingOfflineCount: this.offlineCount,
      lastError: this.lastError,
    };
    this.statusListeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.error('Error in status listener:', err);
      }
    });
  }

  private async refreshOfflineCount() {
    try {
      const stored = await AsyncStorage.getItem(OFFLINE_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.offlineCount = Array.isArray(parsed) ? parsed.length : 0;
      } else {
        this.offlineCount = 0;
      }
    } catch {
      this.offlineCount = 0;
    }
    this.notifyStatus();
  }

  // Request permissions and start live tracking for ongoing booking
  public async startTripTracking(bookingId: string): Promise<boolean> {
    try {
      this.activeBookingId = bookingId;
      this.lastError = null;

      // 1. Request foreground permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        this.lastError = 'Location permission was denied by user';
        this.notifyStatus();
        return false;
      }

      this.isTracking = true;
      this.notifyStatus();

      // 2. Start high-accuracy watchPosition
      this.locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 5000,
          distanceInterval: 10, // 10 meters threshold
        },
        (loc) => {
          this.handleNewLocation(loc);
        }
      );

      // 3. Kick off adaptive transmitter loop
      this.scheduleNextPing();

      // 4. Show persistent notification in Android notification bar
      await this.showTrackingNotification(bookingId);

      // 5. Try flushing any remaining offline queue from previous sessions
      this.flushOfflineQueue();

      return true;
    } catch (err: any) {
      console.error('Failed to start location tracking:', err);
      this.lastError = err?.message || 'Failed to start GPS tracking';
      this.isTracking = false;
      this.notifyStatus();
      return false;
    }
  }

  // Cleanly stop location tracking when trip ends
  public async stopTripTracking(): Promise<void> {
    this.isTracking = false;
    this.activeBookingId = null;

    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    // Dismiss status bar notification
    await this.hideTrackingNotification();

    this.notifyStatus();
  }

  // Notification Bar Helpers
  private async showTrackingNotification(bookingId: string) {
    try {
      await setupNotificationChannel();
      const hasPerm = await requestNotificationPermission();
      if (!hasPerm) return;

      await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_ID,
        content: {
          title: '📍 Currently Sharing Live Location',
          body: 'Active Tour: GPS radar is live and sharing location with office dispatch.',
          data: { bookingId },
          sticky: true,
          autoDismiss: false,
          color: '#059669',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });
    } catch (e) {
      console.warn('Failed to display tracking notification:', e);
    }
  }

  private async updateTrackingNotification() {
    if (!this.isTracking) return;
    try {
      const speedText = this.currentSpeed > 5
        ? `Moving • ${Math.round(this.currentSpeed)} km/h`
        : 'Stationary / Parked';

      await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_ID,
        content: {
          title: '📍 Currently Sharing Live Location',
          body: `Active Tour • ${speedText} • Synced with office`,
          data: { bookingId: this.activeBookingId },
          sticky: true,
          autoDismiss: false,
          color: '#059669',
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });
    } catch {
      // Ignore background notification update errors
    }
  }

  private async hideTrackingNotification() {
    try {
      await Notifications.dismissNotificationAsync(NOTIFICATION_ID);
      await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID);
    } catch (e) {
      console.warn('Failed to hide tracking notification:', e);
    }
  }

  private handleNewLocation(loc: Location.LocationObject) {
    this.latestLocation = loc;
    // Speed in m/s converted to km/h (speed can be null or negative)
    const rawSpeed = loc.coords.speed;
    const speedKmh = rawSpeed && rawSpeed > 0 ? rawSpeed * 3.6 : 0;
    this.currentSpeed = speedKmh;
    this.notifyStatus();
  }

  // Adaptive interval: 20 seconds when moving (> 5 km/h), 60 seconds when stationary
  private scheduleNextPing() {
    if (!this.isTracking) return;

    if (this.timerId) {
      clearTimeout(this.timerId);
    }

    const intervalMs = this.currentSpeed > 5 ? 20000 : 60000;

    this.timerId = setTimeout(async () => {
      await this.transmitCurrentPosition();
      this.scheduleNextPing();
    }, intervalMs);
  }

  // Transmit location or cache offline if network fails
  private async transmitCurrentPosition() {
    if (!this.isTracking) return;

    // If we haven't received a position yet, query the current position
    let coords = this.latestLocation?.coords;
    if (!coords) {
      try {
        const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = cur.coords;
        this.latestLocation = cur;
      } catch {
        // Can't acquire GPS fix
      }
    }

    if (!coords) return;

    const speedKmh = coords.speed && coords.speed > 0 ? coords.speed * 3.6 : 0;
    const ping: LocationPing = {
      lat: coords.latitude,
      lon: coords.longitude,
      heading: coords.heading && coords.heading >= 0 ? coords.heading : null,
      speed: Math.round(speedKmh * 10) / 10,
      accuracy: coords.accuracy || null,
      timestamp: new Date().toISOString(),
    };

    try {
      // Send single ping
      const res = await apiClient.post('/driver/location', {
        bookingId: this.activeBookingId,
        ...ping,
      });

      if (res.data?.success) {
        this.lastSentTime = Date.now();
        this.lastError = null;
        this.notifyStatus();
        this.updateTrackingNotification();

        // Flush offline queue if any points are pending
        await this.flushOfflineQueue();
      } else {
        throw new Error(res.data?.error || 'Server rejected ping');
      }
    } catch (err: any) {
      // Offline / Network Failure -> Cache locally
      console.warn('Network offline or error transmitting GPS, caching breadcrumb locally:', err?.message);
      await this.savePointOffline(ping);
      this.lastError = 'Offline - Location cached locally';
      this.notifyStatus();
    }
  }

  // Save breadcrumb into local AsyncStorage
  private async savePointOffline(ping: LocationPing) {
    try {
      const stored = await AsyncStorage.getItem(OFFLINE_STORAGE_KEY);
      let list: LocationPing[] = stored ? JSON.parse(stored) : [];
      if (!Array.isArray(list)) list = [];

      list.push(ping);
      // Limit offline cache to 1000 points (~10 hours of continuous moving)
      if (list.length > 1000) {
        list = list.slice(list.length - 1000);
      }

      await AsyncStorage.setItem(OFFLINE_STORAGE_KEY, JSON.stringify(list));
      this.offlineCount = list.length;
      this.notifyStatus();
    } catch (err) {
      console.error('Failed to cache point offline:', err);
    }
  }

  // Flush cached points in batch to backend
  private async flushOfflineQueue() {
    try {
      const stored = await AsyncStorage.getItem(OFFLINE_STORAGE_KEY);
      if (!stored) return;

      const list: LocationPing[] = JSON.parse(stored);
      if (!Array.isArray(list) || list.length === 0) return;

      // Send batch to server
      const res = await apiClient.post('/driver/location', {
        bookingId: this.activeBookingId,
        batch: list,
      });

      if (res.data?.success) {
        // Clear queue on success
        await AsyncStorage.removeItem(OFFLINE_STORAGE_KEY);
        this.offlineCount = 0;
        this.notifyStatus();
      }
    } catch (err) {
      console.warn('Offline queue flush postponed (still offline):', err);
    }
  }
}

export const locationService = new DriverLocationService();

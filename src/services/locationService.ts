import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../api/client';

const OFFLINE_STORAGE_KEY = '@offline_gps_breadcrumbs';

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

      // 4. Try flushing any remaining offline queue from previous sessions
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

    this.notifyStatus();
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

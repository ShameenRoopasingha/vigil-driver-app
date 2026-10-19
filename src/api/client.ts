import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigationRef } from '../navigation/navigationRef';

// Replace with your local machine's IP address if testing on a physical device or emulator.
// Connecting directly to the live Vercel backend
const API_URL = 'https://vigil-pos.vercel.app/api'; 

export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: 15000, // 15-second request timeout to prevent indefinite hangs
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('driverToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    // 1. Handle HTTP 401 Unauthorized (Expired or Revoked Token)
    if (error.response?.status === 401) {
      console.warn('[API Client] Unauthorized request (401). Clearing driver session...');
      try {
        await AsyncStorage.multiRemove(['driverToken', 'driverUser', 'driverData']);
        if (navigationRef.isReady()) {
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        }
      } catch (storageErr) {
        console.error('[API Client] Error clearing token on 401:', storageErr);
      }
    }

    // 2. Format user-friendly network and timeout errors
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      error.friendlyMessage = 'Connection timed out. Please check your mobile signal and try again.';
    } else if (!error.response) {
      error.friendlyMessage = 'No network connection. Please check your mobile data or Wi-Fi settings.';
    } else if (error.response?.data?.error) {
      error.friendlyMessage = error.response.data.error;
    } else {
      error.friendlyMessage = 'Server error. Please try again shortly.';
    }

    return Promise.reject(error);
  }
);

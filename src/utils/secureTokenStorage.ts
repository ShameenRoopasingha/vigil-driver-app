import AsyncStorage from '@react-native-async-storage/async-storage';

const DRIVER_TOKEN_KEY = 'driverToken';

type SecureStoreLike = {
  getItemAsync?: (key: string) => Promise<string | null>;
  setItemAsync?: (key: string, value: string) => Promise<void>;
  deleteItemAsync?: (key: string) => Promise<void>;
};

function getNativeSecureStore(): SecureStoreLike | null {
  try {
    // Load dynamically so OTA bundles stay compatible even before native rebuild includes expo-secure-store.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-secure-store') as SecureStoreLike;
    if (mod && typeof mod.getItemAsync === 'function' && typeof mod.setItemAsync === 'function') {
      return mod;
    }
  } catch {
    // Native module not bundled in current binary; fallback cleanly.
  }
  return null;
}

export async function setDriverToken(token: string): Promise<void> {
  const store = getNativeSecureStore();
  if (store?.setItemAsync) {
    await store.setItemAsync(DRIVER_TOKEN_KEY, token);
    await AsyncStorage.removeItem(DRIVER_TOKEN_KEY);
    return;
  }
  await AsyncStorage.setItem(DRIVER_TOKEN_KEY, token);
}

export async function getDriverToken(): Promise<string | null> {
  const store = getNativeSecureStore();
  if (store?.getItemAsync) {
    const secureVal = await store.getItemAsync(DRIVER_TOKEN_KEY);
    if (secureVal) {
      return secureVal;
    }
    const legacy = await AsyncStorage.getItem(DRIVER_TOKEN_KEY);
    if (legacy && store.setItemAsync) {
      await store.setItemAsync(DRIVER_TOKEN_KEY, legacy);
      await AsyncStorage.removeItem(DRIVER_TOKEN_KEY);
      return legacy;
    }
    return null;
  }
  return AsyncStorage.getItem(DRIVER_TOKEN_KEY);
}

export async function clearDriverToken(): Promise<void> {
  const store = getNativeSecureStore();
  if (store?.deleteItemAsync) {
    await store.deleteItemAsync(DRIVER_TOKEN_KEY).catch(() => {});
  }
  await AsyncStorage.removeItem(DRIVER_TOKEN_KEY);
}

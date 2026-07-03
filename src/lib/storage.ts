/**
 * Small async key-value store: SecureStore on device, localStorage on web
 * (SecureStore has no web implementation; web is only our dev preview).
 */
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(key, value);
    } catch {}
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      window.localStorage.removeItem(key);
    } catch {}
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

/**
 * Push notifications (master plan §7.6). The device registers its Expo push
 * token with rpc_register_push_token; the notify-fanout Edge Function sends to
 * it by the user's preferences. Remote push doesn't work in Expo Go (Android,
 * since SDK 53), so this only runs in development and store builds; in Expo Go
 * and the demo the in-app inbox is unchanged.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { ENV, usesSupabase } from '@/constants/env';

import { rpc } from './supabase';
import { failResult, okResult, type Result } from './types';

/** True where remote push can work: a development or store build talking to Supabase. */
export const pushAvailable = () => usesSupabase() && Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient && !!ENV.easProjectId;

/** Asks permission, gets the Expo token and registers it. Safe to call on every sign-in. */
export async function registerForPush(): Promise<Result<string | null>> {
  if (!pushAvailable()) return okResult(null);
  try {
    const Notifications = await import('expo-notifications');
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', { name: 'Updates', importance: Notifications.AndroidImportance.DEFAULT });
      await Notifications.setNotificationChannelAsync('emergency', { name: 'Emergencies', importance: Notifications.AndroidImportance.MAX, sound: 'default' });
    }
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return okResult(null);
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId: ENV.easProjectId });
    const saved = await rpc('rpc_register_push_token', { p_token: data, p_platform: Platform.OS });
    return saved.ok ? okResult(data) : saved;
  } catch {
    return failResult('Push notifications aren’t available on this device');
  }
}

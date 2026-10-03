import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { getAccessToken, usesEmailSignIn } from '@/backend/auth';
import { ImpersonationBar } from '@/components/ui/AppBanners';
import { DialogHost } from '@/components/ui/Dialog';
import { FeatureRouteGuard } from '@/components/ui/FeatureRouteGuard';
import { ToastHost } from '@/components/ui/Toast';
import { colors } from '@/constants/theme';
import { useHydrated } from '@/hooks/useHydrated';
import { useTelemetry } from '@/hooks/useTelemetry';
import { I18nProvider, usePrefs } from '@/i18n';
import { installActionToasts } from '@/store/actionToasts';
import { useAppStore } from '@/store/useAppStore';
import { useDb } from '@/store/useDb';
import { logout } from '@/services/auth';
import { useSession } from '@/store/useSession';
import { APP_FONTS } from '@/theme/fonts';
import { keyboardScreenLayout } from '@/components/ui/Keyboard';

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 350, fade: true });

// Reports render errors (PostHog, Sentry) before offering a retry.
export { AppErrorBoundary as ErrorBoundary } from '@/components/AppErrorBoundary';

// "Guest added", "Task deleted"…: a confirmation after every change.
installActionToasts();

// Refetch stale queries when the app returns to the foreground.
AppState.addEventListener('change', (status) => {
  if (Platform.OS !== 'web') focusManager.setFocused(status === 'active');
});

export default function RootLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 5 * 60_000, gcTime: 30 * 60_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  const [fontsLoaded, fontError] = useFonts(APP_FONTS);
  // All three persisted stores must be restored before routing decisions.
  const appHydrated = useHydrated(useAppStore);
  const sessionHydrated = useHydrated(useSession);
  const dbHydrated = useHydrated(useDb);
  const prefsHydrated = useHydrated(usePrefs);
  const hydrated = appHydrated && sessionHydrated && dbHydrated && prefsHydrated;
  const role = useSession((s) => s.session?.role ?? null);
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const ready = (fontsLoaded || !!fontError) && hydrated;
  useTelemetry();

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  // Supabase builds: a device session whose tokens can no longer be refreshed signs out.
  useEffect(() => {
    if (!ready || !role || !usesEmailSignIn()) return;
    getAccessToken().then((token) => {
      if (!token) logout();
    });
  }, [ready, role]);

  if (!ready) return null;

  const isCustomer = role === 'customer';

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.white }}>
      <I18nProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenLayout={keyboardScreenLayout}
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.white },
            animation: Platform.OS === 'android' ? 'slide_from_right' : 'default',
          }}>
          {/* Signed out: welcome carousel → user type → OTP login → setup. */}
          <Stack.Protected guard={!role}>
            <Stack.Screen name="welcome" options={{ animation: 'fade' }} />
          </Stack.Protected>

          {/* Couples: questionnaire first, then the marketplace app. */}
          <Stack.Protected guard={isCustomer && !hasOnboarded}>
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          </Stack.Protected>
          <Stack.Protected guard={isCustomer && hasOnboarded}>
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="assistant" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="search" options={{ animation: 'fade', presentation: 'transparentModal' }} />
            <Stack.Screen name="profile" />
            <Stack.Screen name="edit-profile" />
            <Stack.Screen name="my-wedding" />
            <Stack.Screen name="plan" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="plan-submitted" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="guests" />
            <Stack.Screen name="seating" />
            <Stack.Screen name="budget" />
            <Stack.Screen name="website" />
            <Stack.Screen name="invitations" />
            <Stack.Screen name="registry" />
            <Stack.Screen name="boards" />
            <Stack.Screen name="compare" />
            <Stack.Screen name="deals" />
            <Stack.Screen name="contracts" />
            <Stack.Screen name="contract/[id]" />
            <Stack.Screen name="calendar" />
            <Stack.Screen name="settings" />
            <Stack.Screen name="quote/[id]" />
            <Stack.Screen name="venue/[id]" />
            <Stack.Screen name="vendor/[id]" />
            <Stack.Screen name="vendors/[category]" />
            <Stack.Screen name="collection/[id]" />
            <Stack.Screen name="idea/[id]" options={{ animation: 'fade', presentation: 'fullScreenModal' }} />
            <Stack.Screen name="story/[id]" />
            <Stack.Screen name="real-wedding/[id]" />
            <Stack.Screen name="shortlist" />
            <Stack.Screen name="checklist" />
            <Stack.Screen name="inbox/index" />
            <Stack.Screen name="inbox/[id]" />
            <Stack.Screen name="bookings" />
            <Stack.Screen name="enquiry" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="genie-checkout/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="write-review" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="info/[slug]" />
            <Stack.Screen name="tools" />
            <Stack.Screen name="tool/[id]" />
            <Stack.Screen name="celebrate" options={{ animation: 'slide_from_bottom' }} />
          </Stack.Protected>

          {/* Each business role gets a completely separate app. */}
          <Stack.Protected guard={role === 'vendor'}>
            <Stack.Screen name="business" options={{ animation: 'fade' }} />
          </Stack.Protected>
          <Stack.Protected guard={role === 'freelancer'}>
            <Stack.Screen name="freelancer" options={{ animation: 'fade' }} />
          </Stack.Protected>
          <Stack.Protected guard={role === 'platform'}>
            <Stack.Screen name="platform" options={{ animation: 'fade' }} />
          </Stack.Protected>

          {/* Shared by every signed-in role. */}
          <Stack.Protected guard={!!role}>
            <Stack.Screen name="notifications" />
          </Stack.Protected>
          <Stack.Protected guard={!role || isCustomer}>
            <Stack.Screen name="select-city" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="join-wedding" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack.Protected>
          {/* Public pages opened from invitation links and QR codes — no sign-in needed. */}
          <Stack.Screen name="w/[slug]" options={{ animation: 'fade' }} />
          <Stack.Screen name="rsvp/[code]" options={{ animation: 'fade' }} />
          {/* Terms, privacy, refunds and account deletion: store listings and gateways link here. */}
          <Stack.Screen name="legal/[doc]" />
          {/* Khalti and eSewa return here (through payment-verify); eSewa's form is posted from pay/esewa. */}
          <Stack.Screen name="pay/result" options={{ animation: 'fade', gestureEnabled: false }} />
          <Stack.Screen name="pay/esewa" options={{ animation: 'none' }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <FeatureRouteGuard />
        <ImpersonationBar />
        <ToastHost />
        <DialogHost />
      </QueryClientProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}

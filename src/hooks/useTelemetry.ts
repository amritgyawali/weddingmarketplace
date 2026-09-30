import { useSegments } from 'expo-router';
import { useEffect } from 'react';

import { identify, screen, setAnalyticsEnabled, startTelemetry } from '@/backend/telemetry';
import { routeName } from '@/backend/telemetryPayloads';
import { useSession } from '@/store/useSession';

/** Starts analytics and error reporting, and follows the signed-in account and the current screen. Root layout only. */
export function useTelemetry() {
  const route = routeName(useSegments());
  const account = useSession((s) => (s.session ? (s.accounts.find((a) => a.id === s.session!.accountId) ?? null) : null));
  const analytics = account?.prefs?.analytics !== false;

  useEffect(() => {
    startTelemetry();
  }, []);

  useEffect(() => {
    setAnalyticsEnabled(analytics);
    identify(account ? { id: account.id, role: account.role, staffRole: account.staffRole, primaryService: account.primaryService, primarySkill: account.primarySkill } : null);
  }, [account, analytics]);

  useEffect(() => {
    screen(route);
  }, [route]);
}

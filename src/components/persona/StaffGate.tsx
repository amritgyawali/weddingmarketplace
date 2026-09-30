import { router } from 'expo-router';
import type { ComponentType } from 'react';

import { EmptyBlock } from '@/components/kit';
import { ToolPage } from '@/components/toolkit/core';
import { PLATFORM_ROUTE_RULES, ROUTE_AUDIENCE } from '@/data/access';
import { useExperience } from '@/hooks/useExperience';
import { allows } from '@/services/experience';

/** What a staff member sees on a console screen their role doesn't include. */
export function NoAccess({ route, title = 'Not part of your role' }: { route: string; title?: string }) {
  return (
    <ToolPage title={title}>
      <EmptyBlock
        icon="lock-closed-outline"
        title="This screen isn’t part of your role"
        message={`It is for ${ROUTE_AUDIENCE[route] ?? 'other teams'}. Ask an admin if you need access.`}
        action="Back to Today"
        onAction={() => (router.canGoBack() ? router.back() : router.replace('/platform'))}
      />
    </ToolPage>
  );
}

/**
 * Wraps an operations screen so it only opens for staff whose permissions
 * pass its rule in `PLATFORM_ROUTE_RULES`; others get `NoAccess`. The store
 * actions behind the screen check permissions again.
 */
export function staffScreen<P extends object>(route: string, Screen: ComponentType<P>) {
  function StaffScreen(props: P) {
    const exp = useExperience();
    if (!allows(exp, PLATFORM_ROUTE_RULES[route])) return <NoAccess route={route} />;
    return <Screen {...props} />;
  }
  return StaffScreen;
}

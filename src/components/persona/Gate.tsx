import type { ReactNode } from 'react';

import { useExperience } from '@/hooks/useExperience';
import { allows } from '@/services/experience';
import type { Capability, OccasionId, Permission, When } from '@/types/persona';

/**
 * Renders its children only when the signed-in persona passes the rule.
 * `cap`, `perm` and `occasion` are shorthands for the common single checks.
 *
 *   <Gate cap="space.halls">…</Gate>
 *   <Gate perm="payout.release" fallback={<ReadOnlyNote />}>…</Gate>
 */
export function Gate({ cap, perm, occasion, when, fallback = null, children }: { cap?: Capability; perm?: Permission; occasion?: OccasionId; when?: When; fallback?: ReactNode; children: ReactNode }) {
  const exp = useExperience();
  const rule: When = { ...when, ...(cap && { capsAll: [...(when?.capsAll ?? []), cap] }), ...(perm && { perms: [...(when?.perms ?? []), perm] }), ...(occasion && { occasions: [occasion] }) };
  return <>{allows(exp, rule) ? children : fallback}</>;
}

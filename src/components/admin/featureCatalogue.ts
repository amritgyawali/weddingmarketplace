import { COUPLE_TOOLS } from '@/components/toolkit/couple';
import { FREELANCER_TOOLS } from '@/components/toolkit/freelancer';
import type { ToolDef } from '@/components/toolkit/hub';
import { PLATFORM_TOOLS } from '@/components/toolkit/platform';
import { VENDOR_TOOLS } from '@/components/toolkit/vendor';
import { featureOn, FEATURES, serviceFeature, toolFeature } from '@/data/features';
import { SERVICE_GROUPS, SERVICES } from '@/data/services';
import type { UserRole } from '@/types/platform';

export type FeatureScope = UserRole | 'all';

export interface FeatureItem {
  id: string;
  label: string;
  hint?: string;
}

const TOOLS: Record<UserRole, ToolDef[]> = { customer: COUPLE_TOOLS, vendor: VENDOR_TOOLS, freelancer: FREELANCER_TOOLS, platform: PLATFORM_TOOLS };

/** Every switch the super admin can flip for one app, grouped as the Features screen shows them. */
export function featureGroups(scope: FeatureScope): { title: string; items: FeatureItem[] }[] {
  const groups: { title: string; items: FeatureItem[] }[] = [];
  const fixed = FEATURES.filter((f) => f.role === scope);
  for (const g of [...new Set(fixed.map((f) => f.group))]) groups.push({ title: g, items: fixed.filter((f) => f.group === g).map((f) => ({ id: f.id, label: f.label, hint: f.hint })) });
  if (scope === 'customer') {
    for (const g of SERVICE_GROUPS) {
      groups.push({ title: `Marketplace: ${g.title}`, items: SERVICES.filter((s) => s.group === g.id).map((s) => ({ id: serviceFeature(s.id), label: s.name, hint: 'Hidden from browsing, search results and home shortcuts' })) });
    }
  }
  if (scope !== 'all') {
    const tools = TOOLS[scope];
    for (const g of [...new Set(tools.map((x) => x.group))]) groups.push({ title: `Tools: ${g}`, items: tools.filter((x) => x.group === g).map((x) => ({ id: toolFeature(x.id), label: x.title, hint: x.subtitle })) });
  }
  return groups;
}

const SCOPES: FeatureScope[] = ['customer', 'vendor', 'freelancer', 'platform', 'all'];

/** Every switch id across the four apps. */
export const ALL_FEATURE_IDS: string[] = [...new Set(SCOPES.flatMap((s) => featureGroups(s).flatMap((g) => g.items.map((i) => i.id))))];

/** How many switches are off right now, defaults included. */
export const hiddenFeatureCount = (flags: Record<string, boolean>) => ALL_FEATURE_IDS.filter((id) => !featureOn(flags, id)).length;

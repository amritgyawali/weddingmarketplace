import { Redirect } from 'expo-router';

import { EDITION_ROLE, editionAllows } from '@/constants/edition';
import { useSession } from '@/store/useSession';

const HOME = { vendor: '/business', freelancer: '/freelancer', platform: '/platform' } as const;

/**
 * The start URL (`/`) of a single-role app (constants/edition.ts). In the
 * all-roles app `/` is the couple's home tab, which these apps don't contain,
 * so this route sends the user to their app or to the welcome. metro.config.js
 * keeps this file out of the all-roles app, where it would clash with `(tabs)`.
 */
export default function EditionIndex() {
  const signedIn = useSession((s) => !!s.session && editionAllows(s.accounts.find((a) => a.id === s.session?.accountId)));
  if (!signedIn || !EDITION_ROLE || EDITION_ROLE === 'customer') return <Redirect href="/welcome" />;
  return <Redirect href={HOME[EDITION_ROLE]} />;
}

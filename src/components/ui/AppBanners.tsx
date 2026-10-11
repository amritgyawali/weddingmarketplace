import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, themed } from '@/constants/theme';
import { featureOn } from '@/data/features';
import { endImpersonation } from '@/services/auth';
import { useDb } from '@/store/useDb';
import { useAccount, useSession } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';

import { Text } from './Text';

/** Shown over every app while a super admin uses "Sign in as": who they are viewing, and the way back. */
export function ImpersonationBar() {
  const impersonatorId = useSession((s) => s.impersonatorId);
  const session = useSession((s) => s.session);
  const accounts = useSession((s) => s.accounts);
  const insets = useSafeAreaInsets();
  if (!impersonatorId || !session) return null;
  const viewing = accounts.find((a) => a.id === session.accountId);
  return (
    <View style={[styles.impHost, { top: insets.top + 4, pointerEvents: 'box-none' }]}>
      <Pressable onPress={endImpersonation} accessibilityRole="button" style={({ pressed }) => [styles.imp, pressed && { opacity: 0.85 }]}>
        <Ionicons name="eye-outline" size={15} color={colors.onDark} />
        <Text size={12} weight="semibold" color={colors.onDark} numberOfLines={1} style={{ flexShrink: 1 }}>
          Viewing as {viewing?.businessName ?? viewing?.name ?? 'user'}
        </Text>
        <Text size={12} weight="bold" color={colors.warningOnDark}>
          Back to admin
        </Text>
      </Pressable>
    </View>
  );
}

const TONE = themed(() => ({
  info: { bg: colors.bgSoft, fg: colors.primary, icon: 'information-circle-outline' },
  success: { bg: colors.successSoft, fg: colors.success, icon: 'checkmark-circle-outline' },
  warning: { bg: colors.goldSoft, fg: colors.warning, icon: 'warning-outline' },
} as const));

/** Announcements a super admin pinned for this role (or everyone). Dismissed ones stay hidden on this screen visit. */
export function AnnouncementBanner({ style }: { style?: object }) {
  const t = useRoleTheme();
  const account = useAccount();
  const announcements = useDb((s) => s.announcements);
  const flags = useDb((s) => s.featureFlags);
  const [hidden, setHidden] = useState<string[]>([]);
  if (!featureOn(flags, 'app.announcements')) return null;
  const list = (announcements ?? []).filter((a) => a.active && (a.audience === 'all' || a.audience === account.role) && !hidden.includes(a.id));
  if (!list.length) return null;
  return (
    <View style={[{ gap: 8 }, style]}>
      {list.slice(0, 3).map((a) => {
        const tone = TONE[a.tone];
        return (
          <View key={a.id} style={[styles.ann, { backgroundColor: tone.bg, borderColor: `${tone.fg}33`, borderRadius: t.cardRadius }]}>
            <Ionicons name={tone.icon} size={20} color={tone.fg} style={{ marginTop: 1 }} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text size={14} weight="semibold" color={tone.fg}>
                {a.title}
              </Text>
              {!!a.body && (
                <Text size={13} color={t.c.text}>
                  {a.body}
                </Text>
              )}
            </View>
            <Pressable onPress={() => setHidden((h) => [...h, a.id])} hitSlop={10} accessibilityLabel="Dismiss">
              <Ionicons name="close" size={18} color={tone.fg} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  impHost: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 200 },
  imp: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.wine, borderWidth: 1, borderColor: colors.goldLine, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, maxWidth: '92%' },
  ann: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderWidth: 1 },
}));

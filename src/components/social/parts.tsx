import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Avatar } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { photo } from '@/constants/images';
import { colors, socialColors, themed } from '@/constants/theme';
import { NETWORK_BY_ID } from '@/data/social';
import { socialSettingsFor } from '@/store/db/social';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Account, SocialMedia, SocialMessage, SocialNetwork } from '@/types/platform';
import { formatShortDate, formatTime, toISODate } from '@/utils/format';

/** "Tue 2 Mangsir · 7:30 PM" for a timestamp. */
export const whenLabel = (iso: string) => `${formatShortDate(toISODate(new Date(iso)))} · ${formatTime(iso)}`;

/** Image source for a post or message attachment. */
export const mediaSource = (m: SocialMedia) => (m.uri ? { uri: m.uri } : m.image ? photo(m.image) : undefined);

/**
 * The signed-in business's social data. Selects the raw arrays and filters in
 * render, so the selectors stay stable.
 */
export function useSocialWorkspace(account: Account) {
  const accounts = useDb((s) => s.socialAccounts);
  const threads = useDb((s) => s.socialThreads);
  const messages = useDb((s) => s.socialMessages);
  const posts = useDb((s) => s.socialPosts);
  const settings = useDb((s) => s.socialSettings);
  const mine = threads.filter((t) => t.ownerId === account.id);
  const ids = new Set(mine.map((t) => t.id));
  return {
    accounts: accounts.filter((a) => a.ownerId === account.id),
    threads: mine.sort((a, b) => b.lastAt.localeCompare(a.lastAt)),
    messages: messages.filter((m) => ids.has(m.threadId)),
    posts: posts.filter((p) => p.ownerId === account.id),
    settings: socialSettingsFor(settings, account.id),
  };
}

/** Counts for entry points (Business tab, sidebar, home card): networks connected, unread, scheduled and failed posts. */
export function useSocialSummary(account: Account) {
  const accounts = useDb((s) => s.socialAccounts);
  const threads = useDb((s) => s.socialThreads);
  const posts = useDb((s) => s.socialPosts);
  const mine = accounts.filter((a) => a.ownerId === account.id && a.status !== 'disconnected');
  const own = posts.filter((p) => p.ownerId === account.id);
  return {
    connected: mine.length,
    networks: mine.map((a) => a.network),
    expired: mine.filter((a) => a.status === 'expired').length,
    unread: threads.filter((t) => t.ownerId === account.id).reduce((s, t) => s + t.unread, 0),
    scheduled: own.filter((p) => p.status === 'scheduled').length,
    failed: own.filter((p) => p.status === 'failed' || p.status === 'partial').length,
  };
}

/** The current time, refreshed every `every` ms, so time-based states (reply windows) move on while a screen stays open. */
export function useNow(every = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(id);
  }, [every]);
  return now;
}

/** Messages of one thread in order (stable selector, filtered in render). */
export function useThreadMessages(threadId: string): SocialMessage[] {
  const messages = useDb((s) => s.socialMessages);
  return messages.filter((m) => m.threadId === threadId);
}

/** The network's own mark in its colour. */
export function NetworkIcon({ network, size = 18, muted }: { network: SocialNetwork; size?: number; muted?: boolean }) {
  const t = useRoleTheme();
  return <Ionicons name={NETWORK_BY_ID[network].icon} size={size} color={muted ? t.c.subtle : socialColors[network]} accessibilityLabel={NETWORK_BY_ID[network].label} />;
}

/** Initials avatar with the network's mark in the corner. */
export function ContactAvatar({ name, network, size = 42 }: { name: string; network: SocialNetwork; size?: number }) {
  const t = useRoleTheme();
  return (
    <View style={{ width: size, height: size }}>
      <Avatar name={name.replace(/^@/, '')} size={size} />
      <View style={[styles.badge, { backgroundColor: t.c.surface, borderColor: t.c.border }]}>
        <NetworkIcon network={network} size={12} />
      </View>
    </View>
  );
}

/** Selectable chip with a network mark (filters, composer). */
export function NetworkChip({ network, label, selected, onPress, count, disabled }: { network?: SocialNetwork; label: string; selected: boolean; onPress: () => void; count?: number; disabled?: boolean }) {
  const t = useRoleTheme();
  return (
    <Pressable
      onPress={() => {
        triggerHaptic('selection');
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: selected ? t.c.textStrong : t.c.border, backgroundColor: selected ? t.c.surfaceAlt : t.c.surface, opacity: disabled ? 0.55 : pressed ? 0.7 : 1 },
      ]}>
      {network && <NetworkIcon network={network} size={15} muted={disabled} />}
      <Text size={14} weight={selected ? 'semibold' : 'regular'} color={selected ? t.c.textStrong : t.c.text}>
        {label}
      </Text>
      {!!count && (
        <Text size={12} weight="semibold" color={t.c.primary}>
          {count}
        </Text>
      )}
    </Pressable>
  );
}

/** Small square thumbnail of the first photo of a post. */
export function PostThumb({ media, size = 56, style }: { media: SocialMedia[]; size?: number; style?: StyleProp<ViewStyle> }) {
  const t = useRoleTheme();
  const first = media[0];
  const src = first ? mediaSource(first) : undefined;
  return (
    <View style={[{ width: size, height: size, borderRadius: 6, overflow: 'hidden', backgroundColor: t.c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }, style]}>
      {src ? <Photo source={src} style={{ width: size, height: size }} contentFit="cover" /> : <Ionicons name="text-outline" size={size * 0.4} color={t.c.subtle} />}
      {first?.kind === 'video' && (
        <View style={styles.play}>
          <Ionicons name="play" size={14} color={colors.onDark} />
        </View>
      )}
      {media.length > 1 && (
        <View style={[styles.count, { backgroundColor: t.c.surface }]}>
          <Text size={10} weight="semibold" color={t.c.textStrong}>
            {media.length}
          </Text>
        </View>
      )}
    </View>
  );
}

/** One tick sent, two delivered, two in the primary colour read; a warning when it failed. */
export function DeliveryTicks({ status }: { status?: SocialMessage['status'] }) {
  const t = useRoleTheme();
  if (!status) return null;
  if (status === 'failed') return <Ionicons name="alert-circle" size={13} color={t.c.danger} accessibilityLabel="Not sent" />;
  if (status === 'sending') return <Ionicons name="time-outline" size={13} color={t.c.subtle} accessibilityLabel="Sending" />;
  return <Ionicons name={status === 'sent' ? 'checkmark' : 'checkmark-done'} size={14} color={status === 'read' ? t.c.primary : t.c.subtle} accessibilityLabel={status} />;
}

/** Thin label used on threads ("Price asked"). */
export function LabelTag({ label }: { label: string }) {
  const t = useRoleTheme();
  return (
    <View style={[styles.tag, { borderColor: t.c.border, backgroundColor: t.c.surfaceAlt }]}>
      <Text size={11} color={t.c.text} lineHeight={15}>
        {label}
      </Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  badge: { position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  play: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center' },
  count: { position: 'absolute', right: 3, top: 3, borderRadius: 4, paddingHorizontal: 4 },
  tag: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 0 },
}));

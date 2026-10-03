import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/IconButton';
import { LanguageSwitch } from '@/components/ui/LanguageSwitch';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER } from '@/constants/theme';
import { useExperience } from '@/hooks/useExperience';
import { useFeatures, useLinkOn } from '@/hooks/useFeatures';
import { goToCoupleTab, useOpenMyWedding } from '@/hooks/useOpenMyWedding';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { logout } from '@/services/auth';
import { selectUnreadCount, useAppStore } from '@/store/useAppStore';
import { useInbox } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useTour } from '@/store/useTour';
import { confirm } from '@/utils/confirm';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const ICON = colors.textBody;

type IconName = ComponentProps<typeof Ionicons>['name'];

interface MenuItem {
  label: string;
  icon: ReactNode;
  href?: Href;
  onPress?: () => void;
  badge?: number;
}

export default function ProfileMenuScreen() {
  const insets = useSafeAreaInsets();
  const profile = useAppStore((s) => s.profile);
  const unread = useAppStore(selectUnreadCount);
  const bookings = useAppStore((s) => s.bookings.filter((b) => b.status !== 'cancelled').length);
  const account = useAccount();
  const { quotes, project } = useCustomerWorkspace(account.id);
  const exp = useExperience();
  const wedding = !project || exp.occasion?.id === 'wedding';
  const has = (m: 'guests' | 'invitations' | 'website') => exp.caps.has(`plan.${m}`);
  const awaitingQuotes = quotes.filter((q) => q.status === 'sent' || q.status === 'viewed').length;
  const unreadNotifications = useInbox(account).filter((n) => !n.read).length;
  const on = useFeatures();
  const linkOn = useLinkOn();
  const openMyWedding = useOpenMyWedding();
  const replayTour = useTour((s) => s.replay);
  /** Back to home, where the tour starts again. */
  const showTour = () => {
    replayTour('couple');
    goToCoupleTab('/');
  };

  const icon = (name: IconName) => <Ionicons name={name} size={21} color={ICON} />;
  const menu: { title: string; items: MenuItem[] }[] = [
    {
      title: wedding ? 'Your wedding' : `Your ${exp.vocab.noun}`,
      items: [
        { label: wedding ? 'My Wedding' : exp.vocab.planTitle, icon: icon('heart-outline'), onPress: openMyWedding, badge: awaitingQuotes },
        ...(has('guests') ? [{ label: 'Guests & RSVP', icon: icon('people-outline'), href: '/guests' as Href }] : []),
        { label: 'Budget', icon: icon('wallet-outline'), href: '/budget' },
        { label: 'Checklist', icon: icon('checkbox-outline'), href: '/checklist' },
        ...(on('couple.tools') ? [{ label: 'All planning tools', icon: icon('construct-outline'), href: '/tools' as Href }] : []),
        ...(on('couple.celebrate') ? [{ label: 'Plan another celebration', icon: icon('add-circle-outline'), href: '/celebrate' as Href }] : []),
      ],
    },
    {
      title: 'Bookings and messages',
      items: [
        { label: 'Messages', icon: icon('chatbubble-outline'), href: '/inbox', badge: unread },
        { label: 'Notifications', icon: icon('notifications-outline'), href: '/notifications', badge: unreadNotifications },
        { label: 'Enquiries & bookings', icon: icon('receipt-outline'), href: '/bookings', badge: bookings },
        { label: 'Shortlist', icon: icon('bookmark-outline'), href: '/shortlist' },
        { label: 'Deals & offers', icon: icon('pricetags-outline'), href: '/deals' },
      ],
    },
    {
      title: 'Help',
      items: [
        ...(wedding && on('tab.customer.genie') ? [{ label: 'Planner packages', icon: icon('clipboard-outline'), href: '/genie' as Href }] : []),
        ...(on('couple.tour') ? [{ label: 'How Vivah works (tour)', icon: icon('compass-outline'), onPress: showTour }] : []),
        ...(on('couple.help') ? [{ label: 'Quick help', icon: icon('chatbubble-ellipses-outline'), href: '/assistant' as Href }] : []),
        { label: 'Contact support', icon: icon('call-outline'), href: { pathname: '/info/[slug]', params: { slug: 'support' } } },
      ],
    },
    {
      title: 'More',
      items: [
        { label: 'Join a wedding', icon: icon('enter-outline'), href: '/join-wedding' },
        { label: 'Write a review', icon: icon('create-outline'), href: '/write-review' },
        { label: 'Settings', icon: icon('settings-outline'), href: '/settings' },
        { label: 'About Vivah', icon: icon('information-circle-outline'), href: { pathname: '/info/[slug]', params: { slug: 'information' } } },
      ],
    },
  ];
  // Rows for switched-off features (extras a super admin hasn't turned on) disappear.
  const sections = menu.map((m) => ({ ...m, items: m.items.filter((i) => !i.href || linkOn(i.href)) })).filter((m) => m.items.length);

  const confirmSignOut = () =>
    confirm('Log out?', 'Your shortlist, checklist and wedding plan stay saved for when you sign back in.', 'Log out', logout);

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: GUTTER - 4 }}>
        <BackButton />
      </View>
      <Pressable onPress={() => router.push('/edit-profile')} style={styles.profile} accessibilityRole="button" accessibilityLabel="View profile">
        <View style={styles.avatar}>
          {profile.name ? (
            <Text size={20} weight="semibold" color={colors.textBody}>
              {profile.name
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </Text>
          ) : (
            <Ionicons name="person" size={30} color={colors.textSubtle} style={{ marginTop: 8 }} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text size={19} weight="semibold" color={colors.heading}>
            {profile.name || 'Guest'}
          </Text>
          <Text size={14} color={colors.textMuted}>
            Edit profile
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
      </Pressable>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        {sections.map((section) => (
          <View key={section.title}>
            <Text size={13} weight="medium" color={colors.textMuted} style={styles.sectionTitle}>
              {section.title}
            </Text>
            {section.items.map((item, i) => (
              <Pressable
                key={item.label}
                onPress={item.onPress ?? (() => item.href && router.push(item.href))}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bgSoft }]}>
                <View style={styles.icon}>{item.icon}</View>
                <View style={[styles.rowBody, i < section.items.length - 1 && styles.rowBorder]}>
                  <Text size={16} color={colors.text}>
                    {item.label}
                  </Text>
                  {!!item.badge && (
                    <View style={styles.badge}>
                      <Text size={12} weight="semibold" color={colors.white} lineHeight={15}>
                        {item.badge}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        ))}
        <View style={styles.langRow}>
          <Ionicons name="language-outline" size={21} color={ICON} />
          <Text size={16} color={colors.text} style={{ flex: 1 }}>
            Language
          </Text>
          <LanguageSwitch compact />
        </View>
        <Pressable onPress={confirmSignOut} style={styles.logout} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          <Text size={16} weight="medium" color={colors.danger}>
            Log out
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: GUTTER - 4, paddingVertical: 14, marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: GUTTER - 4,
    paddingTop: 22,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: GUTTER },
  icon: { width: 24, alignItems: 'flex-start', justifyContent: 'center' },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingRight: GUTTER,
    marginLeft: 14,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  sectionTitle: { paddingHorizontal: GUTTER, paddingTop: 22, paddingBottom: 4 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: GUTTER, paddingTop: 26 },
});

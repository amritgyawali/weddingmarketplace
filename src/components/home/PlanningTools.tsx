import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ShortlistIllustration } from '@/components/ui/Icons';
import { PressableScale } from '@/components/ui/PressableScale';
import { NewBadge, SectionHeader } from '@/components/ui/SectionHeader';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER, radius } from '@/constants/theme';
import { CHECKLIST_TOTAL } from '@/data/checklist';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { selectShortlistCount, useAppStore } from '@/store/useAppStore';
import { useAccount } from '@/store/useSession';
import { daysUntil, formatLongDate } from '@/utils/format';

function ToolCard({
  bg,
  onPress,
  label,
  children,
}: {
  bg: string;
  onPress: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <PressableScale onPress={onPress} accessibilityLabel={label} style={[styles.card, { backgroundColor: bg }]}>
      {children}
    </PressableScale>
  );
}

export function PlanningTools() {
  const shortlistCount = useAppStore(selectShortlistCount);
  const done = useAppStore((s) => s.completedTasks.length);
  const weddingDate = useAppStore((s) => s.weddingDate);
  const bookings = useAppStore((s) => s.bookings.length);
  const account = useAccount();
  const { quotes } = useCustomerWorkspace(account.id);
  const awaitingQuotes = quotes.filter((q) => q.status === 'sent' || q.status === 'viewed').length;

  return (
    <View style={styles.section}>
      <SectionHeader title="Wedding Planning tools" badge={<NewBadge />} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <ToolCard bg="#FDEFF4" label="My Wedding plan" onPress={() => router.push('/my-wedding')}>
          <Text size={18} lineHeight={25} color={colors.text}>
            Your{'\n'}wedding plan
          </Text>
          <View style={styles.link}>
            <Text size={14} weight="semibold" color={awaitingQuotes ? colors.primary : colors.text}>
              {awaitingQuotes ? `${awaitingQuotes} quote${awaitingQuotes > 1 ? 's' : ''} to review` : 'Quotes, payments & run sheet'}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
          </View>
        </ToolCard>

        <ToolCard bg={colors.toolBlue} label="Your shortlisted vendors" onPress={() => router.push('/shortlist')}>
          <Text size={18} lineHeight={25} color={colors.text}>
            Your{'\n'}shortlisted vendors
          </Text>
          <View style={styles.link}>
            <Text size={14} weight="semibold" color={colors.text}>
              {shortlistCount ? `${shortlistCount} saved` : 'Browse vendors'}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
          </View>
          <View style={styles.illustration}>
            <ShortlistIllustration size={70} />
          </View>
        </ToolCard>

        <ToolCard bg={colors.toolWarm} label="Your wedding checklist" onPress={() => router.push('/checklist')}>
          <Text size={18} lineHeight={25} color={colors.text}>
            Your{'\n'}wedding checklist
          </Text>
          <View>
            <Text size={22} weight="bold" color={colors.primary}>
              {done}
              <Text size={16} color={colors.textMuted}>
                /{CHECKLIST_TOTAL}
              </Text>
            </Text>
            <Text size={15} color={colors.text}>
              tasks done
            </Text>
          </View>
        </ToolCard>

        <ToolCard bg="#F4F1FB" label="Your wedding date" onPress={() => router.push('/edit-profile')}>
          <Text size={18} lineHeight={25} color={colors.text}>
            Your{'\n'}wedding countdown
          </Text>
          {weddingDate ? (
            <View>
              <Text size={22} weight="bold" color="#6D4BC4">
                {Math.max(0, daysUntil(weddingDate))}
                <Text size={16} color={colors.textMuted}>
                  {' '}days
                </Text>
              </Text>
              <Text size={14} color={colors.text}>
                {formatLongDate(weddingDate)}
              </Text>
            </View>
          ) : (
            <View style={styles.link}>
              <Text size={14} weight="semibold" color={colors.text}>
                Add wedding date
              </Text>
              <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
            </View>
          )}
        </ToolCard>

        <ToolCard bg="#EEF7F1" label="My bookings" onPress={() => router.push('/bookings')}>
          <Text size={18} lineHeight={25} color={colors.text}>
            Your{'\n'}bookings & enquiries
          </Text>
          <View style={styles.link}>
            <Text size={14} weight="semibold" color={colors.text}>
              {bookings ? `${bookings} active` : 'Nothing yet'}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textMuted} />
          </View>
        </ToolCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingTop: 30 },
  row: { paddingHorizontal: GUTTER, gap: 14 },
  card: {
    width: 202,
    height: 142,
    borderRadius: radius.lg,
    padding: 14,
    paddingLeft: 12,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  link: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  illustration: { position: 'absolute', right: 10, bottom: 8 },
});

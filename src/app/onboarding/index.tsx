import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { ChoiceChips, KButton, KField } from '@/components/kit';
import { ChoiceRow, OnboardingFrame, type Crumb } from '@/components/onboarding/OnboardingStep';
import { Calendar } from '@/components/ui/Calendar';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { colors } from '@/constants/theme';
import { CITIES, ONBOARDING_CITIES } from '@/data/cities';
import { EVENT_TYPE_BY_ID, GUEST_BANDS, bandFor, bsMonthLabel, isPeakSeason, type GuestBand } from '@/data/events';
import { findService } from '@/data/services';
import { logout } from '@/services/auth';
import { estimateTotal } from '@/services/planner';
import { useAppStore } from '@/store/useAppStore';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import type { Role } from '@/types';
import { addDays, daysUntil, formatLakhRange, formatLongDate, formatShortDate } from '@/utils/format';

type StepId = 'you' | 'date' | 'city' | 'guests' | 'budget' | 'review';
const STEPS: StepId[] = ['you', 'date', 'city', 'guests', 'budget', 'review'];
const QUESTIONS = STEPS.length - 1;

const ROLES: { id: Role; title: string; short: string; caption: string }[] = [
  { id: 'bride', title: 'I’m the bride', short: 'Bride', caption: 'Planning my own wedding' },
  { id: 'groom', title: 'I’m the groom', short: 'Groom', caption: 'Planning my own wedding' },
  { id: 'other', title: 'I’m planning for family', short: 'Planning for family', caption: 'Parent, sibling or relative' },
];

const GUEST_NOTES: Record<GuestBand, string> = {
  '<100': 'Close family and friends',
  '100-300': 'An intimate celebration',
  '300-500': 'Most valley weddings',
  '500-1000': 'Both families and the whole tole',
  '1000+': 'A grand bhoj',
};

const BUDGETS = [
  { id: 'u10', title: 'Under 10 lakh', value: 800_000 },
  { id: '10-25', title: '10 – 25 lakh', value: 1_800_000 },
  { id: '25-50', title: '25 – 50 lakh', value: 3_800_000 },
  { id: '50-100', title: '50 lakh – 1 crore', value: 7_500_000 },
  { id: '100+', title: 'Over 1 crore', value: 12_000_000 },
  { id: 'unsure', title: 'Not sure yet', value: null, caption: 'Your coordinator will help you set one' },
] as const;
type BudgetId = (typeof BUDGETS)[number]['id'];

/** What most couples book; the review step lets them change it. */
const DEFAULT_SERVICES = ['venue', 'catering', 'photography', 'videography', 'decoration', 'makeup'];
const WEDDING_SERVICES = EVENT_TYPE_BY_ID.WEDDING.suggestedServices;
const MORE_CITIES = CITIES.filter((c) => (c.group === 'popular' || c.group === 'international') && !(ONBOARDING_CITIES as readonly string[]).includes(c.name)).map((c) => c.name);

const budgetFor = (value: number | null): BudgetId | null => {
  if (value === null) return null;
  return BUDGETS.find((b) => b.value === value)?.id ?? null;
};

/**
 * First run for couples: five short questions, one per screen, then a review
 * card. "Build our plan" turns the answers into a coordinated wedding project.
 */
export default function CoupleOnboarding() {
  const account = useAccount();
  const first = account.name.split(' ')[0] || 'there';
  const stored = useAppStore.getState();
  const saveWeddingBasics = useAppStore((s) => s.saveWeddingBasics);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const submitPlan = useDb((s) => s.submitPlan);

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [role, setRole] = useState<Role | null>(stored.role);
  const [partner, setPartner] = useState(stored.profile.partnerName);
  const [date, setDate] = useState<string | null>(stored.weddingDate);
  const [dateLater, setDateLater] = useState(false);
  const [city, setCity] = useState<string | null>(null);
  const [moreCities, setMoreCities] = useState(false);
  const [guests, setGuests] = useState<GuestBand | null>(stored.guests ? bandFor(stored.guests) : null);
  const [budget, setBudget] = useState<BudgetId | null>(budgetFor(stored.budget));
  const [services, setServices] = useState<string[]>(DEFAULT_SERVICES);
  const [busy, setBusy] = useState(false);
  const advancing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const id = STEPS[step];
  const guestCount = GUEST_BANDS.find((b) => b.id === guests)?.value ?? 300;
  const budgetValue = BUDGETS.find((b) => b.id === budget)?.value ?? null;
  const partnerFirst = role !== 'other' ? partner.trim().split(' ')[0] : '';
  const names = partnerFirst ? `${first} & ${partnerFirst}` : role === 'other' ? 'Our family wedding' : `${first}’s wedding`;
  const [estLo, estHi] = estimateTotal(DEFAULT_SERVICES, guestCount, 2);

  const goTo = (next: number) => {
    if (advancing.current) clearTimeout(advancing.current);
    advancing.current = null;
    setDirection(next >= step ? 1 : -1);
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)));
  };
  /** Single-choice answers move on by themselves after the selection registers. */
  const answerAndAdvance = (apply: () => void) => {
    apply();
    if (advancing.current) clearTimeout(advancing.current);
    advancing.current = setTimeout(() => goTo(step + 1), 260);
  };
  const jump = (target: StepId) => goTo(STEPS.indexOf(target));

  const answered: Record<StepId, boolean> = {
    you: !!role,
    date: !!date || dateLater,
    city: !!city,
    guests: !!guests,
    budget: !!budget,
    review: true,
  };

  const roleLabel = ROLES.find((r) => r.id === role)?.short;
  const crumbs: Crumb[] = [];
  if (roleLabel && step > 0) crumbs.push({ label: partnerFirst ? names : roleLabel, step: STEPS.indexOf('you') });
  if (step > 1 && answered.date) crumbs.push({ label: date ? formatShortDate(date) : 'Date to be fixed', step: STEPS.indexOf('date') });
  if (step > 2 && city) crumbs.push({ label: city, step: STEPS.indexOf('city') });
  if (step > 3 && guests) crumbs.push({ label: `${GUEST_BANDS.find((b) => b.id === guests)!.label} guests`, step: STEPS.indexOf('guests') });

  const finish = async (withPlan: boolean) => {
    saveWeddingBasics({
      role,
      weddingDate: date,
      ...(city ? { city } : {}),
      guests: guestCount,
      budget: budgetValue,
      partnerName: partnerFirst ? partner.trim() : '',
    });
    if (withPlan && city) {
      setBusy(true);
      await new Promise((r) => setTimeout(r, 600));
      submitPlan(account, {
        eventTypes: ['WEDDING', 'RECEPTION'],
        city,
        dates: { WEDDING: date, RECEPTION: date ? addDays(date, 1) : null },
        guests: guestCount,
        services,
        budgetMode: budgetValue ? 'overall' : 'undecided',
        budgetTotal: budgetValue ?? undefined,
        serviceBudgets: {},
        styles: {},
        notes: '',
        inspiration: [],
        partnerName: partnerFirst ? partner.trim() : undefined,
      });
      triggerHaptic('success');
    }
    completeOnboarding();
    // The guard flips to the couple app; open the new wedding once it has mounted.
    if (withPlan) setTimeout(() => router.push('/my-wedding'), 80);
  };

  const onBack = () => (step === 0 ? logout() : goTo(step - 1));

  const next = <KButton label="Continue" size="lg" disabled={!answered[id]} onPress={() => goTo(step + 1)} />;

  switch (id) {
    case 'you':
      return (
        <OnboardingFrame
          stepKey={id}
          direction={direction}
          current={step}
          total={QUESTIONS}
          onBack={onBack} onCrumb={goTo}
          crumbs={[]}
          title={`Namaste, ${first}. Who’s getting married?`}
          subtitle="Five quick questions and we’ll set up your wedding. Nothing is final; change anything later."
          footer={next}>
          {ROLES.map((r, i) => (
            <ChoiceRow key={r.id} index={i} title={r.title} caption={r.caption} selected={role === r.id} onPress={() => setRole(r.id)} />
          ))}
          {(role === 'bride' || role === 'groom') && (
            <Animated.View entering={FadeInDown.duration(260)} style={{ marginTop: 10 }}>
              <KField label="Your partner’s name (optional)" value={partner} onChangeText={setPartner} placeholder={role === 'bride' ? 'e.g. Sujan' : 'e.g. Aakriti'} autoCapitalize="words" returnKeyType="next" onSubmitEditing={() => goTo(step + 1)} />
            </Animated.View>
          )}
        </OnboardingFrame>
      );

    case 'date': {
      const days = date ? daysUntil(date) : 0;
      return (
        <OnboardingFrame
          stepKey={id}
          direction={direction}
          current={step}
          total={QUESTIONS}
          onBack={onBack} onCrumb={goTo}
          crumbs={crumbs}
          title="When is the wedding?"
          subtitle="Pick the main ceremony day. Mehendi and reception dates can come later."
          footer={next}>
          <View style={styles.card}>
            <Calendar
              value={date}
              onChange={(d) => {
                triggerHaptic('selection');
                setDate(d);
                setDateLater(false);
              }}
            />
          </View>
          {date && (
            <Animated.View key={date} entering={FadeIn.duration(220)} style={styles.dateNote}>
              <Text size={15} weight="semibold" color={colors.heading}>
                {formatLongDate(date)} · {bsMonthLabel(date)}
              </Text>
              <Text size={13} color={colors.textMuted}>
                {days} days from today.
                {isPeakSeason(date) ? ' Peak season: popular venues book 6–9 months ahead.' : ' Off-peak dates often get better prices.'}
              </Text>
            </Animated.View>
          )}
          <ChoiceRow
            title="We haven’t fixed a date yet"
            caption="Waiting for the pandit’s sait is fine"
            selected={dateLater}
            onPress={() =>
              answerAndAdvance(() => {
                setDateLater(true);
                setDate(null);
              })
            }
          />
        </OnboardingFrame>
      );
    }

    case 'city':
      return (
        <OnboardingFrame stepKey={id} direction={direction} current={step} total={QUESTIONS} onBack={onBack} onCrumb={goTo} crumbs={crumbs} title="Where will it be?" subtitle="We’ll show venues and vendors who work there." footer={next}>
          <View style={styles.grid}>
            {ONBOARDING_CITIES.map((name, i) => (
              <ChoiceRow key={name} compact index={i} title={name} caption={CITIES.find((c) => c.name === name)?.state} selected={city === name} onPress={() => answerAndAdvance(() => setCity(name))} />
            ))}
          </View>
          {moreCities ? (
            <Animated.View entering={FadeInDown.duration(240)} style={{ gap: 8, marginTop: 6 }}>
              <Text size={13} weight="medium" color={colors.textMuted}>
                More cities and destination spots
              </Text>
              <ChoiceChips options={MORE_CITIES} selected={city ? [city] : []} onToggle={(c) => answerAndAdvance(() => setCity(c))} />
            </Animated.View>
          ) : (
            <Pressable onPress={() => setMoreCities(true)} hitSlop={8} style={styles.more} accessibilityRole="button">
              <Text size={15} weight="semibold" color={colors.primary}>
                Somewhere else
              </Text>
            </Pressable>
          )}
        </OnboardingFrame>
      );

    case 'guests':
      return (
        <OnboardingFrame stepKey={id} direction={direction} current={step} total={QUESTIONS} onBack={onBack} onCrumb={goTo} crumbs={crumbs} title="Roughly how many guests?" subtitle="A best guess is enough. It sets the catering and venue size." footer={next}>
          {GUEST_BANDS.map((b, i) => (
            <ChoiceRow key={b.id} index={i} title={b.label} caption={GUEST_NOTES[b.id]} selected={guests === b.id} onPress={() => answerAndAdvance(() => setGuests(b.id))} />
          ))}
        </OnboardingFrame>
      );

    case 'budget':
      return (
        <OnboardingFrame stepKey={id} direction={direction} current={step} total={QUESTIONS} onBack={onBack} onCrumb={goTo} crumbs={crumbs} title="And the budget, roughly?" subtitle="Only your coordinator sees this. It helps us match providers you can afford." footer={next}>
          <View style={styles.estimate}>
            <Text size={13} color={colors.textMuted}>
              Typical for {guestCount} guests in {city ?? 'Nepal'}
            </Text>
            <Text size={20} weight="bold" color={colors.heading}>
              {formatLakhRange(estLo, estHi)}
            </Text>
            <Text size={12} color={colors.textMuted}>
              Venue, catering, photo and video, decor and makeup, for the wedding and reception.
            </Text>
          </View>
          {BUDGETS.map((b, i) => (
            <ChoiceRow key={b.id} index={i} title={b.title} caption={'caption' in b ? b.caption : undefined} selected={budget === b.id} onPress={() => answerAndAdvance(() => setBudget(b.id))} />
          ))}
        </OnboardingFrame>
      );

    case 'review':
      return (
        <OnboardingFrame
          stepKey={id}
          direction={direction}
          current={QUESTIONS}
          total={QUESTIONS}
          onBack={onBack} onCrumb={goTo}
          crumbs={[]}
          title="Here’s your wedding"
          subtitle="Check the details. Tap any line to change it."
          footer={
            <>
              <KButton label="Build our plan" size="lg" loading={busy} disabled={!city || !services.length} onPress={() => finish(true)} />
              <KButton label="Just browse for now" variant="ghost" size="sm" disabled={busy} onPress={() => finish(false)} />
            </>
          }>
          <Animated.View entering={FadeInDown.duration(320)} style={styles.summary}>
            <View style={styles.summaryPhoto}>
              <Image source={photos.ideaCoupleGardenWalk} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ left: '50%', top: '40%' }} />
              <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']} style={StyleSheet.absoluteFill} />
              <View style={styles.summaryTitle}>
                <Text size={13} color="rgba(255,255,255,0.85)">
                  {date ? `${formatLongDate(date)} · ${bsMonthLabel(date)}` : 'Date to be fixed'}
                </Text>
                <Text serif size={26} weight="bold" lineHeight={34} color={colors.white} numberOfLines={2}>
                  {names}
                </Text>
              </View>
            </View>
            <SummaryRow label="Who" value={partnerFirst ? names : (roleLabel ?? '—')} onPress={() => jump('you')} />
            <SummaryRow label="When" value={date ? `${formatShortDate(date)} · ${daysUntil(date)} days to go` : 'Not fixed yet'} onPress={() => jump('date')} />
            <SummaryRow label="Where" value={city ?? 'Choose a city'} onPress={() => jump('city')} />
            <SummaryRow label="Guests" value={GUEST_BANDS.find((b) => b.id === guests)?.label ?? '—'} onPress={() => jump('guests')} />
            <SummaryRow label="Budget" value={BUDGETS.find((b) => b.id === budget)?.title ?? '—'} onPress={() => jump('budget')} last />
          </Animated.View>

          <View style={{ gap: 8, marginTop: 14 }}>
            <Text size={16} weight="bold" color={colors.heading}>
              What should we arrange?
            </Text>
            <Text size={13} color={colors.textMuted}>
              We’ve picked what most couples book. Tap to add or remove.
            </Text>
            <ChoiceChips
              options={WEDDING_SERVICES.map((s) => findService(s)?.name ?? s)}
              selected={services.map((s) => findService(s)?.name ?? s)}
              onToggle={(name) => {
                const sid = WEDDING_SERVICES.find((s) => (findService(s)?.name ?? s) === name)!;
                setServices((cur) => (cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid]));
              }}
            />
          </View>

          <View style={styles.next}>
            <Text size={14} weight="semibold" color={colors.heading}>
              What happens next
            </Text>
            <Text size={13} color={colors.textBody}>
              A coordinator is assigned straight away and calls you within 2 hours with matched venues and vendors. One quotation, no payment until you accept it.
            </Text>
          </View>
        </OnboardingFrame>
      );
  }
}

function SummaryRow({ label, value, onPress, last }: { label: string; value: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable
      onPress={() => {
        triggerHaptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. Change`}
      style={({ pressed }) => [styles.summaryRow, !last && styles.summaryRowBorder, pressed && { backgroundColor: colors.bgSoft }]}>
      <Text size={13} color={colors.textMuted} style={{ width: 64 }}>
        {label}
      </Text>
      <Text size={15} weight="semibold" color={colors.heading} style={{ flex: 1 }} numberOfLines={1}>
        {value}
      </Text>
      <Text size={13} weight="medium" color={colors.primary}>
        Change
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12 },
  dateNote: { gap: 2, paddingHorizontal: 2, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  more: { alignSelf: 'flex-start', paddingVertical: 10 },
  estimate: { backgroundColor: colors.bgSoft, borderRadius: 10, padding: 14, gap: 2, marginBottom: 6 },
  summary: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.white },
  summaryPhoto: { height: 170, justifyContent: 'flex-end' },
  summaryTitle: { padding: 16, gap: 2 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13 },
  summaryRowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  next: { gap: 4, marginTop: 16, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
});

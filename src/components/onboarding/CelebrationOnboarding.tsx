import { Photo } from '@/components/ui/Photo';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { EVENT_TYPE_BY_ID, GUEST_BANDS, bandFor, isPeakSeason, type GuestBand } from '@/data/events';
import { BUILT_IN_OCCASIONS, type OccasionDef } from '@/data/occasions';
import { relatedEvents } from '@/services/customerPlanning';
import { findService } from '@/data/services';
import { logout } from '@/services/auth';
import { estimateTotal } from '@/services/planner';
import { useAppStore } from '@/store/useAppStore';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import type { Role } from '@/types';
import type { EventType, Project } from '@/types/platform';
import { addDays, daysUntil, formatDateAlt, formatLakhRange, formatLongDate, formatShortDate } from '@/utils/format';

type StepId = 'occasion' | 'you' | 'date' | 'city' | 'guests' | 'budget' | 'services' | 'events' | 'review';
const QUESTION_STEPS: StepId[] = ['you', 'date', 'city', 'guests', 'budget', 'services', 'events', 'review'];
const QUESTIONS = QUESTION_STEPS.length - 1;

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
const GUEST_NOTES_SMALL: Record<GuestBand, string> = {
  '<100': 'Family and close friends',
  '100-300': 'Relatives, neighbours and friends',
  '300-500': 'A big family gathering',
  '500-1000': 'The whole tole',
  '1000+': 'A grand bhoj',
};

interface BudgetBand {
  id: string;
  title: string;
  value: number | null;
  caption?: string;
}
const UNSURE: BudgetBand = { id: 'unsure', title: 'Not sure yet', value: null, caption: 'Your coordinator will help you set one' };
const WEDDING_BUDGETS: BudgetBand[] = [
  { id: 'u10', title: 'Under 10 lakh', value: 800_000 },
  { id: '10-25', title: '10 – 25 lakh', value: 1_800_000 },
  { id: '25-50', title: '25 – 50 lakh', value: 3_800_000 },
  { id: '50-100', title: '50 lakh – 1 crore', value: 7_500_000 },
  { id: '100+', title: 'Over 1 crore', value: 12_000_000 },
  UNSURE,
];
/** Smaller bands for engagements, pasnis, birthdays and the rest. */
const CELEBRATION_BUDGETS: BudgetBand[] = [
  { id: 'u1', title: 'Under 1 lakh', value: 80_000 },
  { id: '1-3', title: '1 – 3 lakh', value: 200_000 },
  { id: '3-10', title: '3 – 10 lakh', value: 600_000 },
  { id: '10-25', title: '10 – 25 lakh', value: 1_800_000 },
  { id: '25+', title: 'Over 25 lakh', value: 3_500_000 },
  UNSURE,
];

const ANNIVERSARY_YEARS = ['1st', '5th', '10th', '25th', '50th', 'Another year'];
const BABY_AGES = [
  { id: 'new', title: 'Just born', caption: 'Under two weeks: time for the nwaran' },
  { id: 'months', title: '1 to 4 months old', caption: 'Nwaran done or planned; pasni is coming up' },
  { id: 'pasni', title: '5 to 7 months old', caption: 'The usual age for pasni' },
  { id: 'older', title: 'Older', caption: 'A late pasni is common too' },
] as const;
type BabyAge = (typeof BABY_AGES)[number]['id'];
const CEREMONIES: { id: 'NWARAN' | 'PASNI' | 'both'; label: string }[] = [
  { id: 'NWARAN', label: 'Nwaran (naming)' },
  { id: 'PASNI', label: 'Pasni (rice feeding)' },
  { id: 'both', label: 'Both' },
];

/** What most couples book; the review step lets them change it. */
const DEFAULT_SERVICES = ['venue', 'catering', 'photography', 'videography', 'decoration', 'makeup'];
const MORE_CITIES = CITIES.filter((c) => (c.group === 'popular' || c.group === 'international') && !(ONBOARDING_CITIES as readonly string[]).includes(c.name)).map((c) => c.name);

const first = (s: string) => s.trim().split(/\s+/)[0] ?? '';
const possessive = (name: string) => (name ? `${name}’s` : 'Our');

/**
 * The couple's first run, and "Plan another celebration": what are we
 * celebrating, then seven short questions shaped by the occasion, one per
 * screen, then a review card. Services and related functions have dedicated
 * steps. "Build our plan" turns the answers into a coordinated project.
 */
export function CelebrationOnboarding({ another = false }: { another?: boolean }) {
  const account = useAccount();
  const me = first(account.name) || 'there';
  const stored = useAppStore.getState();
  const saveWeddingBasics = useAppStore((s) => s.saveWeddingBasics);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const setActiveProject = useAppStore((s) => s.setActiveProject);
  const submitPlan = useDb((s) => s.submitPlan);
  const catalogue = useDb((s) => s.occasions);
  const occasions = (catalogue.length ? catalogue : BUILT_IN_OCCASIONS).filter((o) => o.active).sort((a, b) => a.order - b.order);
  const askOccasion = occasions.length > 1;
  const steps: StepId[] = askOccasion ? ['occasion', ...QUESTION_STEPS] : QUESTION_STEPS;

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [occasionId, setOccasionId] = useState<string>(askOccasion ? '' : (occasions[0]?.id ?? 'wedding'));
  const [role, setRole] = useState<Role | null>(another ? null : stored.role);
  const [partner, setPartner] = useState(another ? '' : stored.profile.partnerName);
  const [honouree, setHonouree] = useState('');
  const [years, setYears] = useState<string | null>(null);
  const [babyAge, setBabyAge] = useState<BabyAge | null>(null);
  const [ceremony, setCeremony] = useState<(typeof CEREMONIES)[number]['id']>('PASNI');
  const [date, setDate] = useState<string | null>(another ? null : stored.weddingDate);
  const [dateLater, setDateLater] = useState(false);
  const [city, setCity] = useState<string | null>(null);
  const [moreCities, setMoreCities] = useState(false);
  const [guests, setGuests] = useState<GuestBand | null>(!another && stored.guests ? bandFor(stored.guests) : null);
  const initialBudget = another ? null : (WEDDING_BUDGETS.find((b) => b.value !== null && b.value === stored.budget)?.id ?? null);
  const [budget, setBudget] = useState<string | null>(initialBudget);
  const [services, setServices] = useState<string[]>(DEFAULT_SERVICES);
  const [extraEvents, setExtraEvents] = useState<EventType[]>(['RECEPTION']);
  const [eventDates, setEventDates] = useState<Partial<Record<EventType, string | null>>>({});
  const [eventNames, setEventNames] = useState<Partial<Record<EventType, string>>>({});
  const [eventCities, setEventCities] = useState<Partial<Record<EventType, string>>>({});
  const [editingReview, setEditingReview] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [busy, setBusy] = useState(false);
  const advancing = useRef<ReturnType<typeof setTimeout> | null>(null);

  const occasion: OccasionDef = occasions.find((o) => o.id === occasionId) ?? occasions[0] ?? BUILT_IN_OCCASIONS[0];
  const wedding = occasion.id === 'wedding';
  const couple = wedding || occasion.id === 'engagement';
  const noun = occasion.vocab.noun;
  const budgets = wedding ? WEDDING_BUDGETS : CELEBRATION_BUDGETS;
  const serviceOptions = occasion.services;

  const id = steps[step];
  const qIndex = Math.max(0, QUESTION_STEPS.indexOf(id));
  const guestCount = GUEST_BANDS.find((b) => b.id === guests)?.value ?? (wedding ? 300 : 150);
  const budgetValue = budgets.find((b) => b.id === budget)?.value ?? null;
  const partnerFirst = couple && role !== 'other' ? first(partner) : '';
  const honoureeName = honouree.trim();

  const mainTypes: EventType[] = occasion.id === 'newborn' ? (ceremony === 'both' ? ['NWARAN', 'PASNI'] : [ceremony]) : [occasion.eventTypes[0] ?? 'OTHER'];
  const eventTypes: EventType[] = [...mainTypes, ...extraEvents.filter((t) => !mainTypes.includes(t) && relatedEvents(occasion).includes(t))];
  const title = (() => {
    if (couple) return partnerFirst ? `${me} & ${partnerFirst}` : role === 'other' ? `Our family ${noun}` : `${me}’s ${noun}`;
    const who = first(honoureeName);
    switch (occasion.id) {
      case 'anniversary':
        return `${honoureeName ? `${honoureeName}’s` : 'Our'} ${years && years !== 'Another year' ? `${years} ` : ''}anniversary`;
      case 'baby_shower':
        return `${honoureeName ? `${honoureeName}’s` : 'Our'} baby shower`;
      case 'newborn':
        return `${possessive(who)} ${ceremony === 'NWARAN' ? 'nwaran' : 'pasni'}`;
      case 'corporate':
        return honoureeName ? `${honoureeName} event` : 'Our company event';
      case 'other':
        return honoureeName || 'Our celebration';
      default:
        return `${possessive(who)} ${occasion.label.toLowerCase()}`;
    }
  })();
  const honourees: Project['honourees'] | undefined = couple
    ? undefined
    : honoureeName
      ? { kind: occasion.honourees, names: occasion.honourees === 'couple' ? honoureeName.split(/\s+(?:and|&)\s+/i) : [honoureeName], years: years ? Number(years.replace(/\D/g, '')) || undefined : undefined }
      : undefined;
  const [estLo, estHi] = estimateTotal(services, guestCount, eventTypes.length);

  const goTo = (next: number) => {
    if (advancing.current) clearTimeout(advancing.current);
    advancing.current = null;
    setDirection(next >= step ? 1 : -1);
    setStep(Math.max(0, Math.min(steps.length - 1, next)));
  };
  useEffect(() => () => { if (advancing.current) clearTimeout(advancing.current); }, []);
  const continueStep = () => {
    if (editingReview) { setEditingReview(false); goTo(steps.indexOf('review')); }
    else goTo(step + 1);
  };
  /** Single-choice answers move on by themselves after the selection registers. */
  const answerAndAdvance = (apply: () => void) => {
    apply();
    if (advancing.current) clearTimeout(advancing.current);
    if (!editingReview) advancing.current = setTimeout(() => goTo(step + 1), 260);
  };
  const jump = (target: StepId) => { setEditingReview(true); goTo(steps.indexOf(target)); };

  const pickOccasion = (o: OccasionDef) =>
    answerAndAdvance(() => {
      if (o.id !== occasionId) {
        setOccasionId(o.id);
        setExtraEvents(o.id === 'wedding' ? ['RECEPTION'] : []);
        setEventDates({});
        setEventCities({});
        setEventNames({});
        setServices(o.id === 'wedding' ? DEFAULT_SERVICES : [...o.defaultServices]);
        setBudget(o.id === 'wedding' ? initialBudget : null);
        setHonouree('');
        setYears(null);
      }
    });

  const answered: Record<StepId, boolean> = {
    occasion: !!occasionId,
    you: couple ? !!role : occasion.id === 'newborn' ? !!babyAge : occasion.id === 'other' ? honoureeName.length > 1 : true,
    date: !!date || dateLater,
    city: !!city,
    guests: !!guests,
    budget: !!budget,
    services: services.length > 0,
    events: true,
    review: true,
  };
  // What a tap on Continue says while the step is unanswered.
  const unanswered: Record<StepId, string> = {
    occasion: 'Pick what you are celebrating',
    you: couple ? 'Tell us who you are in the couple' : occasion.id === 'newborn' ? 'Pick the baby’s age' : occasion.id === 'other' ? 'Enter who the celebration is for' : 'Answer this question to continue',
    date: 'Pick a date, or choose “We haven’t fixed it yet”',
    city: 'Pick your city',
    guests: 'Pick roughly how many guests',
    budget: 'Pick a budget range',
    services: 'Pick at least one thing you need',
    events: '',
    review: '',
  };

  const roleLabel = ROLES.find((r) => r.id === role)?.short;
  const crumbs: Crumb[] = [];
  const at = (s: StepId) => steps.indexOf(s);
  if (askOccasion && step > at('occasion') && occasionId) crumbs.push({ label: occasion.label, step: at('occasion') });
  if (step > at('you')) {
    const who = couple ? (partnerFirst ? title : roleLabel) : honoureeName || undefined;
    if (who) crumbs.push({ label: who, step: at('you') });
  }
  if (step > at('date') && answered.date) crumbs.push({ label: date ? formatShortDate(date) : 'Date to be fixed', step: at('date') });
  if (step > at('city') && city) crumbs.push({ label: city, step: at('city') });
  if (step > at('guests') && guests) crumbs.push({ label: `${GUEST_BANDS.find((b) => b.id === guests)!.label} guests`, step: at('guests') });

  const finish = async (withPlan: boolean) => {
    if (busy) return;
    if (!another) {
      saveWeddingBasics({
        role: couple ? role : null,
        weddingDate: date,
        ...(city ? { city } : {}),
        guests: guestCount,
        budget: budgetValue,
        partnerName: partnerFirst ? partner.trim() : '',
      });
    }
    if (withPlan && city) {
      setBusy(true);
      await new Promise((r) => setTimeout(r, 600));
      const dates = Object.fromEntries(eventTypes.map((t, i) => [t, i === 0 ? date : eventDates[t] !== undefined ? eventDates[t] : t === 'RECEPTION' && date ? addDays(date, 1) : null]));
      const project = submitPlan(account, {
        eventTypes,
        city,
        dates,
        eventCities,
        eventNames,
        guests: guestCount,
        services,
        budgetMode: budgetValue ? 'overall' : 'undecided',
        budgetTotal: budgetValue ?? undefined,
        serviceBudgets: {},
        styles: {},
        notes: '',
        inspiration: [],
        partnerName: partnerFirst ? partner.trim() : undefined,
        occasion: occasion.id,
        honourees,
        title: wedding ? undefined : title,
      });
      setActiveProject(project.id);
      triggerHaptic('success');
    }
    if (another) {
      router.replace('/my-wedding');
      return;
    }
    completeOnboarding();
    // The guard flips to the couple app; open the new plan once it has mounted.
    if (withPlan) setTimeout(() => router.push('/my-wedding'), 80);
  };

  const onBack = () => editingReview ? (setEditingReview(false), goTo(steps.indexOf('review'))) : (step === 0 ? (another ? (router.canGoBack() ? router.back() : router.replace('/profile')) : logout()) : goTo(step - 1));

  const next = <KButton label={editingReview ? "Save changes" : "Continue"} size="lg" missing={!answered[id] && unanswered[id]} onPress={continueStep} />;
  const frame = { stepKey: `${id}-${occasion.id}`, direction, current: id === 'review' ? QUESTIONS : qIndex, total: QUESTIONS, onBack, onCrumb: goTo };

  switch (id) {
    case 'occasion':
      return (
        <OnboardingFrame
          {...frame}
          current={0}
          crumbs={[]}
          title={another ? 'What are we celebrating next?' : `Namaste, ${me}. What are we celebrating?`}
          subtitle={another ? 'Your other plans stay as they are. Switch between them from your plan.' : 'Pick one and answer seven quick questions. Nothing is final; change anything later.'}
          footer={next}>
          {occasions.map((o, i) => (
            <ChoiceRow key={o.id} index={i} title={o.label} caption={o.blurb} selected={occasionId === o.id} onPress={() => pickOccasion(o)} />
          ))}
        </OnboardingFrame>
      );

    case 'you':
      if (couple)
        return (
          <OnboardingFrame
            {...frame}
            crumbs={crumbs}
            title={wedding ? (askOccasion ? 'Who’s getting married?' : `Namaste, ${me}. Who’s getting married?`) : 'Who’s getting engaged?'}
            subtitle={askOccasion ? 'Seven quick questions and we’ll set it up.' : 'Seven quick questions and we’ll set up your wedding. Nothing is final; change anything later.'}
            footer={next}>
            {ROLES.map((r, i) => (
              <ChoiceRow key={r.id} index={i} title={r.title.replace('bride', wedding ? 'bride' : 'bride-to-be').replace('groom', wedding ? 'groom' : 'groom-to-be')} caption={wedding ? r.caption : r.caption.replace('wedding', 'engagement')} selected={role === r.id} onPress={() => setRole(r.id)} />
            ))}
            {(role === 'bride' || role === 'groom') && (
              <Animated.View entering={FadeInDown.duration(260)} style={{ marginTop: 10 }}>
                <KField label="Your partner’s name (optional)" value={partner} onChangeText={setPartner} placeholder={role === 'bride' ? 'e.g. Sujan' : 'e.g. Aakriti'} autoCapitalize="words" returnKeyType="next" onSubmitEditing={continueStep} />
              </Animated.View>
            )}
          </OnboardingFrame>
        );
      if (occasion.id === 'newborn')
        return (
          <OnboardingFrame {...frame} crumbs={crumbs} title="Tell us about the little one" subtitle="We’ll suggest the ceremony and the rituals that go with it." footer={next}>
            <KField label="Baby’s name (optional)" value={honouree} onChangeText={setHonouree} placeholder="e.g. Aarav" autoCapitalize="words" />
            <Text size={14} weight="semibold" color={colors.heading} style={{ marginTop: 10 }}>
              How old is the baby?
            </Text>
            {BABY_AGES.map((a, i) => (
              <ChoiceRow
                key={a.id}
                index={i}
                title={a.title}
                caption={a.caption}
                selected={babyAge === a.id}
                onPress={() => {
                  setBabyAge(a.id);
                  setCeremony(a.id === 'new' ? 'NWARAN' : 'PASNI');
                }}
              />
            ))}
            {babyAge && (
              <Animated.View entering={FadeInDown.duration(240)} style={{ gap: 8, marginTop: 8 }}>
                <Text size={14} weight="semibold" color={colors.heading}>
                  Which ceremony?
                </Text>
                <ChoiceChips options={CEREMONIES.map((c) => c.label)} selected={CEREMONIES.filter((c) => c.id === ceremony).map((c) => c.label)} onToggle={(l) => setCeremony(CEREMONIES.find((c) => c.label === l)!.id)} />
              </Animated.View>
            )}
          </OnboardingFrame>
        );
      return (
        <OnboardingFrame
          {...frame}
          crumbs={crumbs}
          title={
            occasion.id === 'anniversary'
              ? 'Whose anniversary is it?'
              : occasion.id === 'baby_shower'
                ? 'Who are the parents-to-be?'
                : occasion.id === 'corporate'
                  ? 'Which organisation is it for?'
                  : occasion.id === 'other'
                    ? 'What are you celebrating?'
                    : `Whose ${occasion.label.toLowerCase()} is it?`
          }
          subtitle={occasion.id === 'other' ? 'A name for the plan, like “Hajurba’s 84th” or “Griha pravesh”.' : 'Optional. We use it to name your plan.'}
          footer={next}>
          <KField
            label={occasion.id === 'other' ? 'The celebration' : occasion.honourees === 'couple' ? 'Names' : occasion.honourees === 'org' ? 'Organisation' : 'Name'}
            value={honouree}
            onChangeText={setHonouree}
            placeholder={occasion.honourees === 'couple' ? 'e.g. Hari and Sita' : occasion.honourees === 'org' ? 'e.g. Himalayan Bank' : occasion.id === 'other' ? 'e.g. Griha pravesh' : 'e.g. Aarav'}
            autoCapitalize="words"
          />
          {(occasion.id === 'anniversary' || occasion.id === 'birthday') && (
            <View style={{ gap: 8, marginTop: 10 }}>
              <Text size={14} weight="semibold" color={colors.heading}>
                {occasion.id === 'anniversary' ? 'Which anniversary?' : 'Turning (optional)'}
              </Text>
              {occasion.id === 'anniversary' ? (
                <ChoiceChips options={ANNIVERSARY_YEARS} selected={years ? [years] : []} onToggle={(y) => setYears(y === years ? null : y)} />
              ) : (
                <KField value={years ?? ''} onChangeText={(v) => setYears(v.replace(/\D/g, '').slice(0, 3) || null)} keyboardType="number-pad" placeholder="e.g. 60" accessibilityLabel="Age they are turning" />
              )}
            </View>
          )}
        </OnboardingFrame>
      );

    case 'date': {
      const days = date ? daysUntil(date) : 0;
      return (
        <OnboardingFrame
          {...frame}
          crumbs={crumbs}
          title={`When is the ${wedding ? 'wedding' : occasion.id === 'newborn' ? (ceremony === 'NWARAN' ? 'nwaran' : 'pasni') : noun}?`}
          subtitle={wedding ? 'Pick the main ceremony day. Mehendi and reception dates can come later.' : occasion.ritual ? 'Pick the day, or wait for the pandit’s sait. The sait finder in Planning tools helps.' : 'Pick the day. You can change it later.'}
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
                {formatLongDate(date)} · {formatDateAlt(date)}
              </Text>
              <Text size={13} color={colors.textMuted}>
                {days} days from today.
                {wedding ? (isPeakSeason(date) ? ' Peak season: popular venues book 6–9 months ahead.' : ' Off-peak dates often get better prices.') : isPeakSeason(date) ? ' Wedding season: book venues and caterers early.' : ''}
              </Text>
            </Animated.View>
          )}
          <ChoiceRow
            title="We haven’t fixed a date yet"
            caption={occasion.ritual ? 'Waiting for the pandit’s sait is fine' : 'You can add it later'}
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
        <OnboardingFrame {...frame} crumbs={crumbs} title="Where will it be?" subtitle="We’ll show venues and vendors who work there." footer={next}>
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
        <OnboardingFrame {...frame} crumbs={crumbs} title="Roughly how many guests?" subtitle="A best guess is enough. It sets the catering and venue size." footer={next}>
          {GUEST_BANDS.map((b, i) => (
            <ChoiceRow key={b.id} index={i} title={b.label} caption={(wedding ? GUEST_NOTES : GUEST_NOTES_SMALL)[b.id]} selected={guests === b.id} onPress={() => answerAndAdvance(() => setGuests(b.id))} />
          ))}
        </OnboardingFrame>
      );

    case 'budget':
      return (
        <OnboardingFrame {...frame} crumbs={crumbs} title="And the budget, roughly?" subtitle="Only your coordinator sees this. It helps us match providers you can afford." footer={next}>
          <View style={styles.estimate}>
            <Text size={13} color={colors.textMuted}>
              Typical for {guestCount} guests in {city ?? 'Nepal'}
            </Text>
            <Text size={20} weight="bold" color={colors.heading}>
              {formatLakhRange(estLo, estHi)}
            </Text>
            <Text size={12} color={colors.textMuted}>
              {wedding
                ? 'Venue, catering, photo and video, decor and makeup, for the wedding and reception.'
                : `${occasion.defaultServices.map((s) => findService(s)?.name ?? s).join(', ')}.`}
            </Text>
          </View>
          {budgets.map((b, i) => (
            <ChoiceRow key={b.id} index={i} title={b.title} caption={b.caption} selected={budget === b.id} onPress={() => answerAndAdvance(() => setBudget(b.id))} />
          ))}
        </OnboardingFrame>
      );

    case 'services':
      return (
        <OnboardingFrame {...frame} crumbs={crumbs} title="What should we arrange?" subtitle="Choose the services you need. You can change them later." footer={next}>
          <View style={{ gap: 8, marginTop: 14 }}>
            <Text size={13} color={colors.textMuted}>
              {wedding ? 'We’ve picked what most couples book. Tap to add or remove.' : `We’ve picked what most families book for a ${occasion.label.toLowerCase()}. Tap to add or remove.`}
            </Text>
            <ChoiceChips
              options={serviceOptions.map((s) => findService(s)?.name ?? s)}
              selected={services.map((s) => findService(s)?.name ?? s)}
              onToggle={(name) => {
                const sid = serviceOptions.find((s) => (findService(s)?.name ?? s) === name)!;
                setServices((cur) => (cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid]));
              }}
            />
          </View>

        </OnboardingFrame>
      );

    case 'events':
      return (
        <OnboardingFrame {...frame} crumbs={crumbs} title="Your events" subtitle="Check your main event and add related functions." footer={next}>
          <View style={styles.card}>
            <Text size={18} weight="bold">{EVENT_TYPE_BY_ID[eventTypes[0]].label}</Text>
            <Text>{date ? formatLongDate(date) : 'Date to be fixed'} · {city}</Text>
          </View>
          <KButton label="Add more events" variant="secondary" onPress={() => setShowEvents(!showEvents)} />
          {showEvents && relatedEvents(occasion).filter((t) => t !== eventTypes[0]).map((type) => (
            <ChoiceRow key={type} title={type === 'OTHER' ? 'Party or family gathering' : EVENT_TYPE_BY_ID[type].label} selected={extraEvents.includes(type)} onPress={() => setExtraEvents((cur) => cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type])} />
          ))}
          {eventTypes.slice(1).map((type) => (
            <View key={type} style={[styles.card, { gap: 10 }]}>
              <Text size={16} weight="bold">{EVENT_TYPE_BY_ID[type].label}</Text>
              {type === 'OTHER' && <KField label="Event name" value={eventNames[type] ?? ''} placeholder="e.g. Bachelor party" onChangeText={(name) => setEventNames((cur) => ({ ...cur, [type]: name }))} />}
              <Calendar value={eventDates[type] !== undefined ? eventDates[type]! : type === 'RECEPTION' && date ? addDays(date, 1) : null} onChange={(d) => setEventDates((cur) => ({ ...cur, [type]: d }))} />
              <KButton label="Set date later" variant="ghost" size="sm" onPress={() => setEventDates((cur) => ({ ...cur, [type]: null }))} />
              <KField label="City" value={eventCities[type] ?? city ?? ''} onChangeText={(c) => setEventCities((cur) => ({ ...cur, [type]: c }))} />
            </View>
          ))}
        </OnboardingFrame>
      );

    case 'review':
      return (
        <OnboardingFrame
          {...frame}
          crumbs={[]}
          title={`Here’s your ${wedding ? 'wedding' : noun}`}
          subtitle="Check the details. Tap any line to change it."
          footer={
            <>
              <KButton label="Build our plan" size="lg" loading={busy} missing={steps.filter((s) => !answered[s]).map((s) => unanswered[s])[0]} onPress={() => finish(true)} />
              <KButton label={another ? 'Not now' : 'Just browse for now'} variant="ghost" size="sm" disabled={busy} onPress={() => finish(false)} />
            </>
          }>
          <Animated.View entering={FadeInDown.duration(320)} style={styles.summary}>
            <View style={styles.summaryPhoto}>
              <Photo source={photos.ideaCoupleGardenWalk} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={{ left: '50%', top: '40%' }} />
              <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']} style={StyleSheet.absoluteFill} />
              <View style={styles.summaryTitle}>
                <Text size={13} color="rgba(255,255,255,0.85)">
                  {date ? `${formatLongDate(date)} · ${formatDateAlt(date)}` : 'Date to be fixed'}
                </Text>
                <Text serif size={26} weight="bold" lineHeight={34} color={colors.white} numberOfLines={2}>
                  {title}
                </Text>
              </View>
            </View>
            {askOccasion && <SummaryRow label="What" value={occasion.id === 'newborn' ? eventTypes.map((t) => EVENT_TYPE_BY_ID[t].label.replace(/ \(.*\)$/, '')).join(' and ') : occasion.label} onPress={() => jump('occasion')} />}
            <SummaryRow label="Who" value={couple ? (partnerFirst ? title : (roleLabel ?? '—')) : honoureeName || 'Add a name'} onPress={() => jump('you')} />
            <SummaryRow label="When" value={date ? `${formatShortDate(date)} · ${daysUntil(date)} days to go` : 'Not fixed yet'} onPress={() => jump('date')} />
            <SummaryRow label="Where" value={city ?? 'Choose a city'} onPress={() => jump('city')} />
            <SummaryRow label="Guests" value={GUEST_BANDS.find((b) => b.id === guests)?.label ?? '—'} onPress={() => jump('guests')} />
            <SummaryRow label="Budget" value={budgets.find((b) => b.id === budget)?.title ?? '—'} onPress={() => jump('budget')} last />
          </Animated.View>

          <SummaryRow label="Services" value={services.map((s) => findService(s)?.name ?? s).join(', ')} onPress={() => jump('services')} />
          <SummaryRow label="Functions" value={eventTypes.map((t) => (eventNames[t]?.trim() || EVENT_TYPE_BY_ID[t].label)).join(', ')} onPress={() => jump('events')} />
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

import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoiceChips, KButton, KField, showMissing } from '@/components/kit';
import { Calendar } from '@/components/ui/Calendar';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { photo, type PhotoRef } from '@/constants/images';
import { colors } from '@/constants/theme';
import { CITIES, ONBOARDING_CITIES } from '@/data/cities';
import { EVENT_TYPE_BY_ID, EVENT_TYPES, GUEST_BANDS, bandFor, isPeakSeason } from '@/data/events';
import { catalogue } from '@/data/live';
import { SERVICE_GROUPS, SERVICES, findService } from '@/data/services';
import { allocateBudget, estimateTotal, perUnitBudget, type PlanInput } from '@/services/planner';
import { useAppStore } from '@/store/useAppStore';
import { clearDraft, readDraft, saveDraft } from '@/store/drafts';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import type { EventType } from '@/types/platform';
import { formatDateAlt, formatLongDate, formatMoney, formatMoneyCompact, formatMoneyRange, parseMoney } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const STEPS = ['Event', 'Location', 'Dates', 'Guests', 'Services', 'Budget', 'Style', 'Details'] as const;

function OptionCard({ label, icon, selected, onPress, sub }: { label: string; icon?: string; selected: boolean; onPress: () => void; sub?: string }) {
  return (
    <Pressable
      onPress={() => {
        triggerHaptic('selection');
        onPress();
      }}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={[styles.option, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primarySoft : colors.white }]}>
      {icon && <Ionicons name={icon as never} size={22} color={selected ? colors.primary : colors.textMuted} />}
      <View style={{ flex: 1 }}>
        <Text size={15} weight="semibold" color={colors.heading}>
          {label}
        </Text>
        {sub && (
          <Text size={12} color={colors.textMuted}>
            {sub}
          </Text>
        )}
      </View>
      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? colors.primary : colors.border} />
    </Pressable>
  );
}

/** Everything the wizard asks, saved as a draft while it is filled in. */
interface PlanDraft {
  step: number;
  eventTypes: EventType[];
  city: string;
  area: string;
  hasVenue: boolean;
  venue: string;
  dates: Partial<Record<EventType, string | null>>;
  band: (typeof GUEST_BANDS)[number]['id'];
  exactGuests: string;
  services: string[];
  budgetMode: PlanInput['budgetMode'];
  budget: string;
  serviceBudgets: Record<string, [number, number]>;
  styles: Record<string, string[]>;
  notes: string;
  partner: string;
  inspiration: PhotoRef[];
}

/** "Plan My Wedding": one requirement → a managed wedding project. */
export default function PlanWizard() {
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const submitPlan = useDb((s) => s.submitPlan);
  const appCity = useAppStore((s) => s.city);
  const appDate = useAppStore((s) => s.weddingDate);
  const appGuests = useAppStore((s) => s.guests);
  const appBudget = useAppStore((s) => s.budget);
  const appPartner = useAppStore((s) => s.profile.partnerName);
  // A wizard left half-way is kept on the device and picks up where it stopped.
  const draftKey = `plan:${account.id}`;
  const [saved] = useState(() => readDraft<PlanDraft>(draftKey));
  const [step, setStep] = useState(saved?.step ?? 0);
  const [eventTypes, setEventTypes] = useState<EventType[]>(saved?.eventTypes ?? ['WEDDING']);
  const [city, setCity] = useState(saved?.city ?? (CITIES.some((c) => c.name === appCity) && appCity !== 'All Nepal' ? appCity : account.city || 'Kathmandu'));
  const [area, setArea] = useState(saved?.area ?? '');
  const [hasVenue, setHasVenue] = useState(saved?.hasVenue ?? false);
  const [venue, setVenue] = useState(saved?.venue ?? '');
  const [dates, setDates] = useState<Partial<Record<EventType, string | null>>>(saved?.dates ?? { WEDDING: appDate });
  const [dateFor, setDateFor] = useState<EventType>('WEDDING');
  const [band, setBand] = useState<(typeof GUEST_BANDS)[number]['id']>(saved?.band ?? (appGuests ? bandFor(appGuests) : '300-500'));
  const [exactGuests, setExactGuests] = useState(saved?.exactGuests ?? '');
  const [services, setServices] = useState<string[]>(saved?.services ?? ['venue', 'catering', 'photography', 'videography', 'decoration']);
  const [budgetMode, setBudgetMode] = useState<PlanInput['budgetMode']>(saved?.budgetMode ?? 'overall');
  const [budget, setBudget] = useState(saved?.budget ?? (appBudget ? String(appBudget) : ''));
  const [serviceBudgets, setServiceBudgets] = useState<Record<string, [number, number]>>(saved?.serviceBudgets ?? {});
  const [styles_, setStyles] = useState<Record<string, string[]>>(saved?.styles ?? {});
  const [notes, setNotes] = useState(saved?.notes ?? '');
  const [partner, setPartner] = useState(saved?.partner ?? appPartner);
  const [inspiration, setInspiration] = useState<PhotoRef[]>(saved?.inspiration ?? []);
  const [touched, setTouched] = useState(!!saved);
  const snapshot: PlanDraft = { step, eventTypes, city, area, hasVenue, venue, dates, band, exactGuests, services, budgetMode, budget, serviceBudgets, styles: styles_, notes, partner, inspiration };
  const snapshotJson = JSON.stringify(snapshot);
  useEffect(() => {
    if (touched) saveDraft(draftKey, JSON.parse(snapshotJson));
  }, [touched, draftKey, snapshotJson]);
  // Saving starts with the first change, so just opening the wizard leaves nothing behind.
  const [first] = useState(snapshotJson);
  if (!touched && snapshotJson !== first) setTouched(true);
  const [submitting, setSubmitting] = useState(false);

  const guests = Number(exactGuests) || GUEST_BANDS.find((b) => b.id === band)!.value;
  const [estLo, estHi] = estimateTotal(services, guests, eventTypes.length);
  const budgetNum = parseMoney(budget);
  const allocation = budgetMode === 'overall' && budgetNum > 0 ? allocateBudget(budgetNum, services, guests, eventTypes.length) : null;

  const toggleEvent = (id: EventType) => {
    const next = eventTypes.includes(id) ? eventTypes.filter((x) => x !== id) : [...eventTypes, id];
    if (!next.length) return showMissing('Keep at least one function selected');
    setEventTypes(next);
    // Pre-select the core services couples usually book for these functions.
    const suggested = next.flatMap((e) => EVENT_TYPE_BY_ID[e].suggestedServices.filter((s) => findService(s)?.core));
    setServices((cur) => [...new Set([...cur, ...suggested])]);
  };

  const stepMissing = [
    !eventTypes.length && 'Pick at least one function',
    !city && 'Pick your city',
    null,
    !(guests > 0) && 'Enter the number of guests',
    !services.length && 'Pick at least one service you need',
    budgetMode === 'overall' && !(budgetNum > 0) && 'Enter your overall budget, or choose to discuss it per service',
    null,
    null,
  ][step];

  const submit = async () => {
    setSubmitting(true);
    await new Promise((r) => setTimeout(r, 700));
    const project = submitPlan(account, {
      eventTypes,
      city,
      area: area.trim() || undefined,
      venueSelected: hasVenue && venue.trim() ? venue.trim() : undefined,
      dates,
      guests,
      services,
      budgetMode,
      budgetTotal: budgetMode === 'overall' ? budgetNum : undefined,
      serviceBudgets: budgetMode === 'per_service' ? serviceBudgets : {},
      styles: styles_,
      notes: notes.trim(),
      inspiration,
      partnerName: partner.trim() || undefined,
    });
    useAppStore.getState().setCity(city);
    if (project.weddingDate) useAppStore.getState().setWeddingDate(project.weddingDate);
    triggerHaptic('success');
    clearDraft(draftKey);
    setSubmitting(false);
    router.replace({ pathname: '/plan-submitted', params: { id: project.id } });
  };

  const body = () => {
    switch (step) {
      case 0:
        return (
          <View style={{ gap: 10 }}>
            <Text size={22} weight="bold" color={colors.heading}>
              What are you planning?
            </Text>
            <Text size={14} color={colors.textMuted}>
              Pick every function — we plan them together (engagement, mehendi, wedding, reception…).
            </Text>
            {EVENT_TYPES.filter((e) => e.wedding).map((e) => (
              <OptionCard key={e.id} label={e.label} icon={e.icon} selected={eventTypes.includes(e.id)} onPress={() => toggleEvent(e.id)} />
            ))}
            <Text size={13} weight="medium" color={colors.textMuted} style={{ marginTop: 8 }}>
              Other celebrations
            </Text>
            {EVENT_TYPES.filter((e) => !e.wedding).map((e) => (
              <OptionCard key={e.id} label={e.label} icon={e.icon} selected={eventTypes.includes(e.id)} onPress={() => toggleEvent(e.id)} />
            ))}
          </View>
        );
      case 1:
        return (
          <View style={{ gap: 14 }}>
            <Text size={22} weight="bold" color={colors.heading}>
              Where is it?
            </Text>
            <ChoiceChips options={[...ONBOARDING_CITIES, 'Nagarkot', 'Dhulikhel', 'Janakpur', 'Birgunj', 'Nepalgunj']} selected={[city]} onToggle={setCity} />
            <KField label="Specific area (optional)" value={area} onChangeText={setArea} placeholder="e.g. Baneshwor, Lakeside, Jhamsikhel" />
            <OptionCard label="We’ve already selected a venue" icon="business" selected={hasVenue} onPress={() => setHasVenue((v) => !v)} />
            {hasVenue && <KField label="Venue name" value={venue} onChangeText={setVenue} placeholder="e.g. Everest Grand Party Palace" />}
          </View>
        );
      case 2:
        return (
          <View style={{ gap: 12 }}>
            <Text size={22} weight="bold" color={colors.heading}>
              When?
            </Text>
            <ChoiceChips options={eventTypes.map((e) => EVENT_TYPE_BY_ID[e].label)} selected={[EVENT_TYPE_BY_ID[dateFor]?.label ?? '']} onToggle={(label) => setDateFor(EVENT_TYPES.find((e) => e.label === label)!.id)} />
            <Calendar value={dates[dateFor] ?? null} onChange={(d) => setDates((s) => ({ ...s, [dateFor]: d }))} />
            <OptionCard label="Date not confirmed yet" sub="Waiting for the pandit’s sait? No problem — we’ll plan around the season." selected={dates[dateFor] === null || dates[dateFor] === undefined} onPress={() => setDates((s) => ({ ...s, [dateFor]: null }))} />
            {eventTypes.map((e) => {
              const d = dates[e];
              return (
                <Text key={e} size={13} color={colors.text}>
                  • {EVENT_TYPE_BY_ID[e].label}: {d ? `${formatLongDate(d)} (${formatDateAlt(d)})${isPeakSeason(d) ? ' · peak season' : ''}` : 'to be confirmed'}
                </Text>
              );
            })}
          </View>
        );
      case 3:
        return (
          <View style={{ gap: 10 }}>
            <Text size={22} weight="bold" color={colors.heading}>
              How many guests?
            </Text>
            {GUEST_BANDS.map((b) => (
              <OptionCard key={b.id} label={b.label} icon="people" selected={band === b.id && !exactGuests} onPress={() => { setBand(b.id); setExactGuests(''); }} />
            ))}
            <KField label="Or an exact number" value={exactGuests} onChangeText={(v) => setExactGuests(v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="e.g. 600" />
          </View>
        );
      case 4:
        return (
          <View style={{ gap: 14 }}>
            <Text size={22} weight="bold" color={colors.heading}>
              What do you need?
            </Text>
            <Text size={14} color={colors.textMuted}>
              We’ve pre-selected what couples usually book for your functions.
            </Text>
            {SERVICE_GROUPS.map((g) => (
              <View key={g.id} style={{ gap: 8 }}>
                <Text size={13} weight="medium" color={colors.textMuted}>
                  {g.title}
                </Text>
                <View style={styles.serviceGrid}>
                  {SERVICES.filter((s) => s.group === g.id).map((s) => {
                    const on = services.includes(s.id);
                    return (
                      <Pressable
                        key={s.id}
                        onPress={() => setServices((cur) => (on ? cur.filter((x) => x !== s.id) : [...cur, s.id]))}
                        style={[styles.serviceTile, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySoft : colors.white }]}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}>
                        <Ionicons name={s.icon as never} size={20} color={on ? colors.primary : colors.textMuted} />
                        <Text size={12} weight="semibold" color={colors.heading} align="center" numberOfLines={2}>
                          {s.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        );
      case 5:
        return (
          <View style={{ gap: 12 }}>
            <Text size={22} weight="bold" color={colors.heading}>
              What’s your budget?
            </Text>
            <View style={styles.estimate}>
              <Text size={12} weight="medium" color={colors.textMuted}>
                Typical in {city} for {guests} guests
              </Text>
              <Text size={20} weight="bold" color={colors.heading}>
                {formatMoneyRange(estLo, estHi)}
              </Text>
              <Text size={12} color={colors.textMuted}>
                Based on {services.length} services across {eventTypes.length} function{eventTypes.length > 1 ? 's' : ''}.
              </Text>
            </View>
            <ChoiceChips options={['Overall budget', 'Per service', 'Not sure yet']} selected={[budgetMode === 'overall' ? 'Overall budget' : budgetMode === 'per_service' ? 'Per service' : 'Not sure yet']} onToggle={(v) => setBudgetMode(v === 'Overall budget' ? 'overall' : v === 'Per service' ? 'per_service' : 'undecided')} />
            {budgetMode === 'overall' && (
              <>
                <KField label="Overall budget" value={budget} onChangeText={setBudget} placeholder="e.g. 25 lakh, 2500000 or 2.5m" prefix="NPR" />
                {budgetNum > 0 && <Text size={12} color={colors.textMuted}>= {formatMoney(budgetNum)}</Text>}
                {allocation && (
                  <View style={{ gap: 6 }}>
                    <Text size={13} weight="bold" color={colors.heading}>
                      Suggested split
                    </Text>
                    {services.map((id) => {
                      const def = findService(id)!;
                      const [lo, hi] = perUnitBudget(id, allocation[id], guests, eventTypes.length);
                      return (
                        <View key={id} style={styles.allocRow}>
                          <Text size={13} color={colors.text} style={{ flex: 1 }}>
                            {def.name}
                          </Text>
                          <Text size={13} weight="semibold" color={colors.heading}>
                            {formatMoneyCompact(allocation[id])}
                          </Text>
                          {(def.unit === 'per plate' || def.unit === 'per person') && (
                            <Text size={11} color={colors.textMuted}>
                              ({formatMoneyRange(lo, hi)}/{def.unit.replace('per ', '')})
                            </Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </>
            )}
            {budgetMode === 'per_service' &&
              services.map((id) => {
                const def = findService(id)!;
                const cur = serviceBudgets[id];
                return (
                  <View key={id} style={{ gap: 4 }}>
                    <Text size={13} weight="semibold" color={colors.heading}>
                      {def.name} <Text size={11} color={colors.textMuted}>({def.unit})</Text>
                    </Text>
                    <View style={styles.allocRow}>
                      <View style={{ flex: 1 }}>
                        <KField placeholder={`min ${def.priceRange[0]}`} value={cur ? String(cur[0]) : ''} onChangeText={(v) => setServiceBudgets((s) => ({ ...s, [id]: [parseMoney(v) || 0, s[id]?.[1] ?? 0] }))} keyboardType="number-pad" />
                      </View>
                      <Text color={colors.textMuted}>–</Text>
                      <View style={{ flex: 1 }}>
                        <KField placeholder={`max ${Math.round(def.priceRange[0] + (def.priceRange[1] - def.priceRange[0]) * 0.4)}`} value={cur ? String(cur[1]) : ''} onChangeText={(v) => setServiceBudgets((s) => ({ ...s, [id]: [s[id]?.[0] ?? 0, parseMoney(v) || 0] }))} keyboardType="number-pad" />
                      </View>
                    </View>
                  </View>
                );
              })}
          </View>
        );
      case 6:
        return (
          <View style={{ gap: 16 }}>
            <Text size={22} weight="bold" color={colors.heading}>
              Your style
            </Text>
            {services
              .map((id) => findService(id)!)
              .filter((d) => d.styles.length > 1)
              .map((d) => (
                <View key={d.id} style={{ gap: 8 }}>
                  <Text size={14} weight="semibold" color={colors.heading}>
                    {d.name}
                  </Text>
                  <ChoiceChips options={d.styles} selected={styles_[d.id] ?? []} onToggle={(v) => setStyles((s) => ({ ...s, [d.id]: (s[d.id] ?? []).includes(v) ? s[d.id].filter((x) => x !== v) : [...(s[d.id] ?? []), v] }))} />
                </View>
              ))}
          </View>
        );
      default:
        return (
          <View style={{ gap: 14 }}>
            <Text size={22} weight="bold" color={colors.heading}>
              Anything else?
            </Text>
            <KField label="Partner’s name (optional)" value={partner} onChangeText={setPartner} placeholder="e.g. Sujan" />
            <KField
              label="Additional requirements"
              value={notes}
              onChangeText={setNotes}
              multiline
              maxLength={1000}
              placeholder="e.g. Outdoor pre-wedding near Pokhara. Bride wants natural makeup. Drone is required. Same team for engagement and wedding."
            />
            <Text size={14} weight="semibold" color={colors.heading}>
              Inspiration (tap to add)
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {catalogue.ideas().slice(0, 14).map((i) => {
                const on = inspiration.includes(i.image);
                return (
                  <Pressable key={i.id} onPress={() => setInspiration((cur) => (on ? cur.filter((x) => x !== i.image) : [...cur, i.image]))}>
                    <Photo source={photo(i.image)} style={[styles.inspo, { borderColor: on ? colors.primary : 'transparent' }]} contentFit="cover" />
                    {on && <Ionicons name="checkmark-circle" size={22} color={colors.primary} style={styles.inspoCheck} />}
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.summary}>
              <Text size={13} weight="bold" color={colors.heading}>
                Summary
              </Text>
              <Text size={13} color={colors.text}>
                {eventTypes.map((e) => EVENT_TYPE_BY_ID[e].label).join(', ')} in {city}
                {area ? ` (${area})` : ''} · {guests} guests · {services.length} services · {budgetMode === 'overall' && budgetNum ? formatMoney(budgetNum) : 'budget to discuss'}
              </Text>
            </View>
          </View>
        );
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Plan my wedding" subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`} onBack={() => (step ? setStep(step - 1) : router.back())} />
      <View style={styles.progress}>
        {STEPS.map((s, i) => (
          <View key={s} style={[styles.progressSeg, { backgroundColor: i <= step ? colors.primary : colors.border }]} />
        ))}
      </View>
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Animated.View key={step} entering={FadeInRight.duration(220)}>
            {body()}
          </Animated.View>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          {step > 0 && <KButton label="Back" variant="secondary" onPress={() => setStep(step - 1)} style={{ flex: 1 }} />}
          {step < STEPS.length - 1 ? (
            <KButton label="Continue" icon="arrow-forward" missing={stepMissing} onPress={() => setStep(step + 1)} style={{ flex: 2 }} />
          ) : (
            <KButton label="Submit requirement" icon="paper-plane" loading={submitting} onPress={submit} style={{ flex: 2 }} />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  progress: { flexDirection: 'row', gap: 4, paddingHorizontal: 20, paddingVertical: 10 },
  progressSeg: { flex: 1, height: 4, borderRadius: 2 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 8, padding: 14 },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  serviceTile: { width: '31%', borderWidth: 1, borderRadius: 8, padding: 10, alignItems: 'center', gap: 6, minHeight: 84, justifyContent: 'center' },
  estimate: { backgroundColor: colors.primaryTint, borderRadius: 8, padding: 14, gap: 2 },
  allocRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inspo: { width: 92, height: 120, borderRadius: 8, borderWidth: 3 },
  inspoCheck: { position: 'absolute', top: 6, right: 6 },
  summary: { backgroundColor: colors.bgMuted, borderRadius: 8, padding: 12, gap: 4 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 14, backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
});

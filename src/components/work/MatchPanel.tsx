import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, KButton, KField, ProgressBar, StatusPill } from '@/components/kit';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { photos } from '@/constants/images';
import { findProvider } from '@/data/providers';
import { findService } from '@/data/services';
import { MATCH_FACTORS, MATCH_WEIGHTS, rankProviders, type RankedProvider } from '@/services/matching';
import { PRICING_MODELS } from '@/services/pricing';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { MatchCandidate, PricingModel, Project, Requirement, ScoreBreakdown } from '@/types/platform';
import { formatMoney, formatMoneyCompact, formatMoneyRange } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

export function fitColor(score: number, t: ReturnType<typeof useRoleTheme>) {
  return score >= 85 ? t.c.success : score >= 70 ? t.c.info : score >= 55 ? t.c.warning : t.c.danger;
}

/** Weighted score breakdown bars (availability 30 · location 15 · …). */
export function ScoreBreakdownView({ breakdown }: { breakdown: ScoreBreakdown }) {
  const t = useRoleTheme();
  return (
    <View style={{ gap: 6 }}>
      {MATCH_FACTORS.map((f) => (
        <View key={f.key} style={styles.factor}>
          <Text size={12} color={t.c.muted} style={{ width: 140 }} numberOfLines={1}>
            {f.label}
          </Text>
          <View style={{ flex: 1 }}>
            <ProgressBar value={breakdown[f.key] / MATCH_WEIGHTS[f.key]} height={6} />
          </View>
          <Text size={12} weight="semibold" color={t.c.textStrong} style={{ width: 54, textAlign: 'right' }}>
            {breakdown[f.key]}/{MATCH_WEIGHTS[f.key]}
          </Text>
        </View>
      ))}
    </View>
  );
}

function CandidateRow({
  candidate,
  ranked,
  onOpen,
  onShortlist,
  onPropose,
  booked,
}: {
  candidate: MatchCandidate;
  ranked?: RankedProvider;
  onOpen: () => void;
  onShortlist: () => void;
  onPropose: () => void;
  booked: boolean;
}) {
  const t = useRoleTheme();
  const provider = findProvider(candidate.providerId);
  const color = fitColor(candidate.score, t);
  return (
    <View style={[styles.candidate, { borderColor: t.c.border }]}>
      <Pressable onPress={onOpen} style={styles.candidateTop} accessibilityRole="button" accessibilityLabel={`${candidate.providerName}, ${candidate.score}% fit`}>
        {provider && <Image source={photos[provider.image]} style={styles.thumb} contentFit="cover" />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text size={14} weight="bold" color={t.c.textStrong} numberOfLines={1}>
            {candidate.providerName}
          </Text>
          <Text size={12} color={t.c.muted} numberOfLines={1}>
            {provider ? `${provider.city} · ${provider.rating}★ (${provider.reviewCount}) · from ${formatMoneyCompact(provider.startingPrice)}` : ''}
          </Text>
          <View style={styles.reasons}>
            {candidate.reasons.slice(0, 2).map((r) => (
              <Text key={r} size={11} color={t.c.success} numberOfLines={1}>
                ✓ {r}
              </Text>
            ))}
            {ranked?.warnings.slice(0, 1).map((w) => (
              <Text key={w} size={11} color={t.c.warning} numberOfLines={1}>
                ! {w}
              </Text>
            ))}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={[styles.fit, { backgroundColor: `${color}1F` }]}>
            <Text size={15} weight="bold" color={color}>
              {Math.round(candidate.score)}%
            </Text>
          </View>
          {candidate.status !== 'suggested' && <StatusPill status={candidate.status} />}
        </View>
      </Pressable>
      <View style={styles.actions}>
        {candidate.status === 'suggested' && <KButton label="Shortlist" size="sm" variant="secondary" icon="bookmark-outline" onPress={onShortlist} style={{ flex: 1 }} />}
        {!booked && candidate.status !== 'declined' && candidate.status !== 'contacted' && (
          <KButton label="Check & propose" size="sm" icon="paper-plane-outline" onPress={onPropose} style={{ flex: 1.3 }} />
        )}
      </View>
    </View>
  );
}

function ProposeSheet({ project, requirement, providerId, onClose }: { project: Project; requirement: Requirement; providerId: string | null; onClose: () => void }) {
  const t = useRoleTheme();
  const proposeBooking = useDb((s) => s.proposeBooking);
  const settings = useDb((s) => s.settings);
  const provider = providerId ? findProvider(providerId) : undefined;
  const candidate = requirement.candidates.find((c) => c.providerId === providerId);
  const [price, setPrice] = useState(String(candidate?.quotedPrice ?? provider?.startingPrice ?? ''));
  const [model, setModel] = useState<PricingModel>('COMMISSION');
  const [hold, setHold] = useState(true);
  const rate = model === 'MARKUP' ? settings.markupRate : model === 'LEAD_FEE' ? settings.leadFee : settings.commissionRate;
  const amount = Number(price.replace(/\D/g, '')) || 0;
  const customer = model === 'MARKUP' ? Math.round(amount * (1 + rate)) : amount;
  const fee = model === 'MARKUP' ? customer - amount : model === 'LEAD_FEE' ? rate : Math.round(amount * rate);

  return (
    <Sheet visible={!!providerId} onClose={onClose} title="Propose booking">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 10 }} keyboardShouldPersistTaps="handled">
        <Text size={14} color={t.c.muted}>
          {provider?.name} will be asked to confirm availability for {requirement.eventIds.length} event(s). The customer sees one combined quotation.
        </Text>
        <KField label={model === 'MARKUP' ? 'Provider cost (NPR)' : 'Customer price (NPR)'} value={price} onChangeText={setPrice} keyboardType="number-pad" prefix="NPR" />
        <View style={{ gap: 6 }}>
          <Text size={13} weight="semibold" color={t.c.muted}>
            Business model
          </Text>
          <ChoiceChips options={PRICING_MODELS.filter((m) => m.id !== 'FREELANCER_MARGIN').map((m) => m.label)} selected={[PRICING_MODELS.find((m) => m.id === model)!.label]} onToggle={(label) => setModel(PRICING_MODELS.find((m) => m.label === label)!.id)} />
          <Text size={12} color={t.c.muted}>
            {PRICING_MODELS.find((m) => m.id === model)?.blurb}
          </Text>
        </View>
        <Card style={{ gap: 4 }}>
          <Row label="Customer pays" value={formatMoney(customer)} strong />
          <Row label="Provider receives" value={formatMoney(customer - fee)} />
          <Row label="Platform earns" value={`${formatMoney(fee)} (${model === 'LEAD_FEE' ? 'flat' : `${Math.round(rate * 100)}%`})`} tone={t.c.success} />
        </Card>
        <Pressable onPress={() => setHold((h) => !h)} style={styles.holdRow} accessibilityRole="checkbox" accessibilityState={{ checked: hold }}>
          <Ionicons name={hold ? 'checkbox' : 'square-outline'} size={22} color={t.c.primary} />
          <View style={{ flex: 1 }}>
            <Text size={14} weight="semibold" color={t.c.textStrong}>
              Hold the date for 7 days
            </Text>
            <Text size={12} color={t.c.muted}>
              Marks the provider’s calendar HELD so no one else books it while the customer decides.
            </Text>
          </View>
        </Pressable>
        <KButton
          label="Send booking request"
          icon="paper-plane"
          disabled={!amount}
          onPress={() => {
            proposeBooking(project.id, requirement.id, providerId!, { price: amount, model, rate, hold });
            toast(`Request sent to ${provider?.name}`, 'paper-plane');
            onClose();
          }}
        />
      </ScrollView>
    </Sheet>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  const t = useRoleTheme();
  return (
    <View style={styles.rowBetween}>
      <Text size={13} color={t.c.muted}>
        {label}
      </Text>
      <Text size={strong ? 16 : 14} weight={strong ? 'bold' : 'semibold'} color={tone ?? t.c.textStrong}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Coordinator's matching workspace for one requirement: run the engine,
 * inspect weighted fit, shortlist and send booking requests. Nothing is
 * awarded automatically.
 */
export function MatchPanel({ project, requirement }: { project: Project; requirement: Requirement }) {
  const t = useRoleTheme();
  const runMatching = useDb((s) => s.runMatching);
  const setCandidateStatus = useDb((s) => s.setCandidateStatus);
  const availability = useDb((s) => s.availability);
  const [detail, setDetail] = useState<MatchCandidate | null>(null);
  const [proposeFor, setProposeFor] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const booked = project.bookings.some((b) => b.requirementId === requirement.id && b.status !== 'CANCELLED');
  const ranked = rankProviders(project, requirement, { availability }, { limit: 40, includeExcluded: true });
  const rankedById = new Map(ranked.map((r) => [r.provider.id, r]));
  const candidates = [...requirement.candidates].sort((a, b) => b.score - a.score);
  const excluded = ranked.filter((r) => r.excluded);

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.rowBetween}>
        <Text size={13} weight="medium" color={t.c.muted}>
          {candidates.length ? `Recommended · ${candidates.length}` : 'No candidates yet'}
        </Text>
        <Pressable
          onPress={() => {
            const found = runMatching(project.id, requirement.id);
            toast(`${found.length} providers ranked`, 'git-compare');
          }}
          hitSlop={8}
          style={styles.inline}>
          <Ionicons name="refresh" size={15} color={t.c.primary} />
          <Text size={13} weight="semibold" color={t.c.primary}>
            {candidates.length ? 'Re-run matching' : 'Run matching'}
          </Text>
        </Pressable>
      </View>
      {candidates.slice(0, showAll ? undefined : 4).map((c) => (
        <CandidateRow
          key={c.providerId}
          candidate={c}
          ranked={rankedById.get(c.providerId)}
          booked={booked}
          onOpen={() => setDetail(c)}
          onShortlist={() => setCandidateStatus(project.id, requirement.id, c.providerId, 'shortlisted')}
          onPropose={() => setProposeFor(c.providerId)}
        />
      ))}
      {candidates.length > 4 && (
        <KButton label={showAll ? 'Show fewer' : `Show all ${candidates.length}`} variant="ghost" size="sm" onPress={() => setShowAll((v) => !v)} />
      )}
      {excluded.length > 0 && (
        <Text size={12} color={t.c.muted}>
          {excluded.length} provider(s) excluded — {excluded.slice(0, 2).map((e) => `${e.provider.name}: ${e.excluded}`).join('; ')}
        </Text>
      )}

      <Sheet visible={!!detail} onClose={() => setDetail(null)} title={detail?.providerName}>
        {detail && (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 10 }}>
            <View style={styles.rowBetween}>
              <Text size={14} color={t.c.muted}>
                Overall fit
              </Text>
              <Text size={28} weight="bold" color={fitColor(detail.score, t)}>
                {Math.round(detail.score)}%
              </Text>
            </View>
            <ScoreBreakdownView breakdown={detail.breakdown} />
            {(rankedById.get(detail.providerId)?.reasons ?? detail.reasons).map((r) => (
              <Text key={r} size={13} color={t.c.success}>
                ✓ {r}
              </Text>
            ))}
            {rankedById.get(detail.providerId)?.warnings.map((w) => (
              <Text key={w} size={13} color={t.c.warning}>
                ! {w}
              </Text>
            ))}
            {detail.quotedPrice !== undefined && (
              <Text size={13} color={t.c.muted}>
                Estimated for this requirement: {formatMoney(detail.quotedPrice)}
                {requirement.budgetMax ? ` · budget ${formatMoneyRange(requirement.budgetMin ?? 0, requirement.budgetMax)} ${findService(requirement.serviceId)?.unit ?? ''}` : ''}
              </Text>
            )}
            {!booked && (
              <KButton
                label="Check availability & propose"
                icon="paper-plane"
                onPress={() => {
                  setProposeFor(detail.providerId);
                  setDetail(null);
                }}
              />
            )}
          </ScrollView>
        )}
      </Sheet>
      <ProposeSheet project={project} requirement={requirement} providerId={proposeFor} onClose={() => setProposeFor(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  factor: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  candidate: { borderWidth: 1, borderRadius: 8, padding: 10, gap: 10 },
  candidateTop: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  thumb: { width: 52, height: 52, borderRadius: 10 },
  reasons: { gap: 1, marginTop: 2 },
  fit: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  holdRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
});

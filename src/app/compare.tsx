import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, KButton } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { photo } from '@/constants/images';
import { colors, themed } from '@/constants/theme';
import { findProvider, type Provider } from '@/data/providers';
import { serviceName } from '@/data/services';
import { useStartChat } from '@/hooks/useChat';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { formatMoney } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const COL = 176;

interface Metric {
  label: string;
  value: (p: Provider) => string;
  score?: (p: Provider) => number;
  best?: 'max' | 'min';
}

/** Side-by-side comparison of shortlisted venues and vendors. */
export default function CompareScreen() {
  const account = useAccount();
  const params = useLocalSearchParams<{ ids?: string }>();
  const shortlists = useDb((s) => s.shortlists);
  const reviews = useDb((s) => s.reviews);
  const packages = useDb((s) => s.packages);
  const toggleShortlist = useDb((s) => s.toggleShortlist);
  const startChat = useStartChat();
  const saved = (shortlists[account.id] ?? []).map((e) => findProvider(e.providerId)).filter((p): p is Provider => !!p);
  const [picked, setPicked] = useState<string[]>(() => (params.ids ? params.ids.split(',') : saved.slice(0, 3).map((p) => p.id)));
  const chosen = picked.map((id) => findProvider(id)).filter((p): p is Provider => !!p);
  const services = [...new Set(saved.map((p) => p.serviceId))];

  const ratingOf = (p: Provider) => {
    const mine = reviews.filter((r) => r.targetId === p.id && r.status === 'published');
    return mine.length ? (mine.reduce((s, r) => s + r.overall, 0) + p.rating * p.reviewCount) / (mine.length + p.reviewCount) : p.rating;
  };
  const cheapestPkg = (p: Provider) => packages.filter((k) => k.providerId === p.id && k.active).sort((a, b) => a.price - b.price)[0];

  const METRICS: Metric[] = [
    { label: 'Service', value: (p) => serviceName(p.serviceId) },
    { label: 'Starting price', value: (p) => `${formatMoney(p.startingPrice)} ${p.priceUnit}`, score: (p) => p.startingPrice, best: 'min' },
    { label: 'Rating', value: (p) => `★ ${ratingOf(p).toFixed(1)} (${p.reviewCount})`, score: (p) => ratingOf(p), best: 'max' },
    { label: 'Experience', value: (p) => `${p.experienceYears} yrs · ${p.completedProjects} weddings`, score: (p) => p.completedProjects, best: 'max' },
    { label: 'Based in', value: (p) => `${p.locality ? `${p.locality}, ` : ''}${p.city}` },
    { label: 'Travels', value: (p) => (p.travels ? `Yes · ${p.serviceAreas.slice(0, 3).join(', ')}` : 'Local only') },
    { label: 'Capacity', value: (p) => (p.capacity ? `${p.capacity.min}–${p.capacity.max} guests` : '—'), score: (p) => p.capacity?.max ?? 0, best: 'max' },
    { label: 'Styles', value: (p) => p.styles.slice(0, 3).join(', ') || '—' },
    { label: 'Languages', value: (p) => p.languages.join(', ') },
    { label: 'Instant booking', value: (p) => (p.instantBook ? 'Yes' : 'On request') },
    { label: 'Verified', value: (p) => (p.verification === 'VERIFIED' ? '✓ Verified' : 'Pending') },
    { label: 'Package from', value: (p) => (cheapestPkg(p) ? `${formatMoney(cheapestPkg(p)!.price)} · ${cheapestPkg(p)!.title}` : '—') },
    { label: 'Your status', value: (p) => ((shortlists[account.id] ?? []).find((e) => e.providerId === p.id)?.status ?? 'not saved').replace(/_/g, ' ') },
  ];
  const winner = (m: Metric) => {
    if (!m.score || chosen.length < 2) return null;
    const vals = chosen.map((p) => m.score!(p));
    const target = m.best === 'min' ? Math.min(...vals) : Math.max(...vals);
    return vals.filter((v) => v === target).length === 1 ? chosen[vals.indexOf(target)].id : null;
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Compare" subtitle={`${chosen.length} of ${saved.length} shortlisted`} />
      {saved.length < 2 ? (
        <EmptyBlock icon="git-compare-outline" title="Shortlist at least two" message="Save venues or vendors with the bookmark icon, then compare prices, ratings and packages here." action="Browse vendors" onAction={() => router.navigate('/vendors')} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {services.map((sid) => (
              <View key={sid} style={styles.group}>
                <Text size={12} weight="medium" color={colors.textMuted}>
                  {serviceName(sid)}
                </Text>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {saved
                    .filter((p) => p.serviceId === sid)
                    .map((p) => {
                      const on = picked.includes(p.id);
                      return (
                        <Pressable key={p.id} onPress={() => setPicked((cur) => (on ? cur.filter((x) => x !== p.id) : [...cur, p.id].slice(-4)))} style={[styles.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primarySoft : colors.white }]}>
                          <Text size={12} weight="semibold" color={on ? colors.primary : colors.text} numberOfLines={1}>
                            {p.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                </View>
              </View>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View style={{ paddingHorizontal: 16 }}>
              <View style={styles.row}>
                <View style={styles.labelCol} />
                {chosen.map((p) => (
                  <View key={p.id} style={[styles.col, { gap: 6 }]}>
                    <Photo source={photo(p.image)} style={styles.image} contentFit="cover" />
                    <Text size={14} weight="bold" color={colors.textStrong} numberOfLines={2}>
                      {p.name}
                    </Text>
                  </View>
                ))}
              </View>
              {METRICS.map((m, i) => {
                const best = winner(m);
                return (
                  <View key={m.label} style={[styles.row, i % 2 === 0 && { backgroundColor: colors.white }]}>
                    <View style={styles.labelCol}>
                      <Text size={12} weight="semibold" color={colors.textMuted}>
                        {m.label}
                      </Text>
                    </View>
                    {chosen.map((p) => (
                      <View key={p.id} style={[styles.col, styles.cell]}>
                        {best === p.id && <Ionicons name="trophy" size={12} color={colors.crown} />}
                        <Text size={13} weight={best === p.id ? 'bold' : 'regular'} color={best === p.id ? colors.textStrong : colors.text}>
                          {m.value(p)}
                        </Text>
                      </View>
                    ))}
                  </View>
                );
              })}
              <View style={styles.row}>
                <View style={styles.labelCol} />
                {chosen.map((p) => (
                  <View key={p.id} style={[styles.col, { gap: 6, paddingTop: 10 }]}>
                    <KButton label="Chat" icon="chatbubble-outline" size="sm" onPress={() => startChat({ id: p.id, name: p.name, image: p.image })} />
                    <KButton label="Details" size="sm" variant="secondary" onPress={() => router.push(p.kind === 'venue' ? { pathname: '/venue/[id]', params: { id: p.id } } : { pathname: '/vendor/[id]', params: { id: p.id } })} />
                    <KButton label="Remove" size="sm" variant="ghost" onPress={() => { toggleShortlist(account.id, p.id); setPicked((cur) => cur.filter((x) => x !== p.id)); }} />
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
          {chosen.length < 2 && (
            <Card style={{ margin: 16 }}>
              <Text size={13} color={colors.textMuted}>
                Pick two to four from your shortlist above to compare them side by side.
              </Text>
            </Card>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSoft },
  chips: { padding: 16, gap: 14 },
  group: { gap: 6 },
  chip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7, maxWidth: 180 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  labelCol: { width: 110, paddingVertical: 10, paddingRight: 8, justifyContent: 'center' },
  col: { width: COL, paddingHorizontal: 8 },
  cell: { paddingVertical: 10, flexDirection: 'row', gap: 4, alignItems: 'flex-start' },
  image: { width: COL - 16, height: 96, borderRadius: 8 },
}));

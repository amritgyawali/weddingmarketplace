import Ionicons from '@expo/vector-icons/Ionicons';
import { Photo } from '@/components/ui/Photo';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, KButton, KField } from '@/components/kit';
import { RegistryCard } from '@/components/planner/RegistryCard';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { PaymentSheet } from '@/components/work/Payments';
import { photo } from '@/constants/images';
import { colors, themed } from '@/constants/theme';
import { useLayout } from '@/hooks/useLayout';
import { exportCalendar } from '@/services/exporters';
import { useDb } from '@/store/useDb';
import type { RegistryItem, WeddingWebsite } from '@/types/platform';
import { daysUntil, formatClock, formatDateAlt, formatLongDate } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

/**
 * The couple's chosen look. The site is always light (it is the couple's
 * printed-invitation style, not the viewer's app theme), so every text and
 * card colour comes from here: `muted` is at least 5 : 1 on `bg` and `soft`.
 */
const TEMPLATE: Record<WeddingWebsite['template'], { bg: string; ink: string; soft: string; muted: string; card: string; line: string }> = {
  classic: { bg: '#FFFDF8', ink: '#2B2118', soft: '#F6EFE3', muted: '#5F5248', card: '#FFFFFF', line: '#E8DCCB' },
  himalayan: { bg: '#F7FAFC', ink: '#10263A', soft: '#E7EEF5', muted: '#44566A', card: '#FFFFFF', line: '#D6E0EA' },
  floral: { bg: '#FFF8FA', ink: '#3A1D28', soft: '#FCE9EF', muted: '#6A4752', card: '#FFFFFF', line: '#F0D6DF' },
  minimal: { bg: '#FFFFFF', ink: '#111111', soft: '#F3F3F3', muted: '#555555', card: '#FFFFFF', line: '#E2E2E2' },
};

function Section({ title, theme, serif, accent, children }: { title: string; theme: (typeof TEMPLATE)['classic']; serif?: string; accent: string; children: ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text size={22} weight="bold" color={theme.ink} style={{ fontFamily: serif }} align="center">
        {title}
      </Text>
      <View style={[styles.rule, { backgroundColor: accent }]} />
      {children}
    </View>
  );
}

/** A small text link in the couple's accent colour (the app's ghost button would follow the viewer's dark mode). */
function SiteLink({ label, icon, color, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={8} style={({ pressed }) => [styles.link, pressed && { opacity: 0.6 }]}>
      <Ionicons name={icon} size={16} color={color} />
      <Text size={14} weight="semibold" color={color}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Public couple website — schedule, story, travel, FAQ, gallery, registry and RSVP. */
export default function WeddingSite() {
  const insets = useSafeAreaInsets();
  const { wide } = useLayout();
  const { slug, preview } = useLocalSearchParams<{ slug: string; preview?: string }>();
  const site = useDb((s) => s.websites.find((w) => w.slug === slug));
  const project = useDb((s) => (site ? s.projects.find((p) => p.id === site.projectId) : undefined));
  const allRegistry = useDb((s) => s.registry);
  const registry = site ? allRegistry.filter((r) => r.projectId === site.projectId) : [];
  const recordView = useDb((s) => s.recordWebsiteView);
  const contribute = useDb((s) => s.contribute);
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [gift, setGift] = useState<RegistryItem | null>(null);
  const [giver, setGiver] = useState('');
  const [note, setNote] = useState('');
  const [giverTried, setGiverTried] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  useEffect(() => {
    if (slug && !preview) recordView(slug);
  }, [slug, preview, recordView]);

  if (!site || !project || (!site.published && !preview)) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 40 }]}>
        <Ionicons name="globe-outline" size={44} color={colors.textSubtle} />
        <Text size={20} weight="bold" color={colors.textStrong}>
          This wedding website isn’t available
        </Text>
        <Text size={14} color={colors.textMuted} align="center">
          The link may be mistyped, or the couple hasn’t published it yet.
        </Text>
        <KButton label="Go back" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    );
  }

  const theme = TEMPLATE[site.template];
  // The couple's 'Elegant serif' option uses Martel, the app's display serif.
  const serif = site.font === 'serif' ? 'Martel_700Bold' : undefined;
  const days = daysUntil(project.weddingDate);
  const events = project.events.filter((e) => !e.private && e.status !== 'cancelled').sort((a, b) => (a.date ?? '9').localeCompare(b.date ?? '9'));

  if (site.password && !unlocked && !preview) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 40, backgroundColor: theme.bg }]}>
        <Ionicons name="lock-closed-outline" size={40} color={site.accent} />
        <Text size={24} weight="bold" color={theme.ink} style={{ fontFamily: serif }}>
          {site.headline}
        </Text>
        <Text size={14} color={theme.muted} align="center">
          This website is private. Enter the password from your invitation.
        </Text>
        <View style={{ alignSelf: 'stretch' }}>
          <KField value={password} onChangeText={setPassword} placeholder="Password" secureTextEntry />
        </View>
        <KButton label="Enter" style={{ alignSelf: 'stretch', backgroundColor: site.accent, borderColor: site.accent }} onPress={() => (password.trim().toLowerCase() === site.password!.toLowerCase() ? setUnlocked(true) : toast('That password doesn’t match. Check your invitation and try again', 'lock-closed'))} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <View>
          <Photo source={photo(site.cover)} style={{ width: '100%', height: wide ? 460 : 380 }} contentFit="cover" />
          <View style={[styles.veil, { paddingTop: insets.top + 12 }]}>
            {preview ? (
              <Pressable onPress={() => router.back()} style={styles.previewBar}>
                <Ionicons name="eye-outline" size={14} color="#fff" />
                <Text size={12} weight="bold" color="#fff">
                  {site.published ? 'Preview · tap to close' : 'Preview, not published yet · tap to close'}
                </Text>
              </Pressable>
            ) : (
              <View />
            )}
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text size={13} weight="bold" color="#fff">
                We’re getting married
              </Text>
              <Text size={40} weight="bold" color="#fff" align="center" style={{ fontFamily: serif }}>
                {site.headline}
              </Text>
              <Text size={15} color="#fff">
                {formatLongDate(project.weddingDate)} · {formatDateAlt(project.weddingDate)}
              </Text>
              <Text size={14} color="rgba(255,255,255,0.9)">
                {project.city}, Nepal
              </Text>
              {days >= 0 && (
                <View style={[styles.count, { borderColor: 'rgba(255,255,255,0.6)' }]}>
                  <Text size={13} weight="bold" color="#fff">
                    {days === 0 ? 'Today is the day!' : `${days} days to go`}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={[styles.body, wide && { maxWidth: 760, alignSelf: 'center', width: '100%' }]}>
          {site.sections.rsvp && (
            <Card style={{ gap: 10, backgroundColor: theme.soft, borderColor: theme.soft }}>
              <Text size={18} weight="bold" color={theme.ink} style={{ fontFamily: serif }}>
                RSVP
              </Text>
              <Text size={13} color={theme.muted}>
                Enter the code from your invitation{site.rsvpDeadline ? ` — kindly reply by ${formatLongDate(site.rsvpDeadline)}` : ''}.
              </Text>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <KField value={code} onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="Invitation code" autoCapitalize="characters" />
                </View>
                <KButton label="RSVP" missing={code.length < 4 && (code ? 'Invitation codes have at least 4 letters or numbers' : 'Enter the code from your invitation')} onPress={() => router.push({ pathname: '/rsvp/[code]', params: { code } })} style={{ backgroundColor: site.accent, borderColor: site.accent }} />
              </View>
            </Card>
          )}

          {site.sections.story && !!site.story && (
            <Section theme={theme} serif={serif} accent={site.accent} title="Our story">
              <Text size={15} color={theme.ink} lineHeight={24} align="center">
                {site.story}
              </Text>
            </Section>
          )}

          {site.sections.schedule && events.length > 0 && (
            <Section theme={theme} serif={serif} accent={site.accent} title="Celebrations">
              {events.map((e) => (
                <Card key={e.id} style={{ gap: 4, backgroundColor: theme.card, borderColor: theme.line }}>
                  <Text size={17} weight="bold" color={theme.ink} style={{ fontFamily: serif }}>
                    {e.name}
                  </Text>
                  <Text size={14} color={theme.ink}>
                    {e.date ? `${formatLongDate(e.date)} · ${formatClock(e.startTime)}` : 'Date to be announced'}
                  </Text>
                  <Text size={13} color={theme.muted}>
                    {e.venue}, {e.city}
                  </Text>
                  <View style={[styles.row, { marginTop: 6 }]}>
                    <SiteLink label="Map" icon="navigate-outline" color={site.accent} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${e.venue} ${e.city}`)}`)} />
                    {e.date && (
                      <SiteLink
                        label="Add to calendar"
                        icon="calendar-outline"
                        color={site.accent}
                        onPress={() => exportCalendar([{ title: `${site.headline} — ${e.name}`, date: e.date!, time: e.startTime, durationHours: 5, location: `${e.venue}, ${e.city}` }], `${site.slug}-${e.type.toLowerCase()}`)}
                      />
                    )}
                  </View>
                </Card>
              ))}
            </Section>
          )}

          {site.sections.dressCode && !!site.dressCode && (
            <Section theme={theme} serif={serif} accent={site.accent} title="Dress code">
              <Text size={15} color={theme.ink} lineHeight={23} align="center">
                {site.dressCode}
              </Text>
            </Section>
          )}

          {site.sections.travel && !!site.travel && (
            <Section theme={theme} serif={serif} accent={site.accent} title="Travel & stay">
              <Text size={15} color={theme.ink} lineHeight={23}>
                {site.travel}
              </Text>
            </Section>
          )}

          {site.sections.gallery && site.gallery.length > 0 && (
            <Section theme={theme} serif={serif} accent={site.accent} title="Gallery">
              <View style={styles.gallery}>
                {site.gallery.map((g) => (
                  <Photo key={g} source={photo(g)} style={[styles.photo, { width: wide ? '32%' : '48.5%' }]} contentFit="cover" />
                ))}
              </View>
            </Section>
          )}

          {site.sections.registry && registry.length > 0 && (
            <Section theme={theme} serif={serif} accent={site.accent} title="Gifts">
              <Text size={14} color={theme.muted} align="center">
                Your presence is the greatest gift. If you’d like to bless us further, here are a few ideas.
              </Text>
              {registry.map((r) => (
                <RegistryCard key={r.id} item={r} accent={site.accent} onContribute={() => setGift(r)} />
              ))}
            </Section>
          )}

          {site.sections.faq && site.faqs.length > 0 && (
            <Section theme={theme} serif={serif} accent={site.accent} title="Questions">
              {site.faqs.map((f) => (
                <View key={f.q} style={{ gap: 4 }}>
                  <Text size={15} weight="bold" color={theme.ink}>
                    {f.q}
                  </Text>
                  <Text size={14} color={theme.muted} lineHeight={21}>
                    {f.a}
                  </Text>
                </View>
              ))}
            </Section>
          )}

          <Text size={12} color={theme.muted} align="center">
            Made on Vivah
          </Text>
        </View>
      </ScrollView>

      {gift && (
        <View style={[StyleSheet.absoluteFill, { pointerEvents: 'box-none' }]}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} onPress={() => setGift(null)} />
          <View style={[styles.giftCard, { paddingBottom: insets.bottom + 16 }]}>
            <Text size={18} weight="bold" color={colors.textStrong}>
              {gift.title}
            </Text>
            <KField label="Your name" required value={giver} onChangeText={setGiver} placeholder="From…" error={giverTried && giver.trim().length < 2 ? 'Enter your name so the couple knows who sent it' : null} />
            <KField label="Message (optional)" value={note} onChangeText={setNote} multiline maxLength={300} placeholder="Blessings for the couple" />
            <KButton label="Continue to payment" missing={giver.trim().length < 2 && 'Enter your name so the couple knows who sent it'} onMissing={() => setGiverTried(true)} onPress={() => setPayOpen(true)} style={{ backgroundColor: site.accent, borderColor: site.accent }} />
            <KButton label="Cancel" variant="ghost" onPress={() => setGift(null)} />
          </View>
        </View>
      )}
      <PaymentSheet
        visible={payOpen && !!gift}
        title={gift ? `Gift · ${gift.title}` : 'Gift'}
        amount={gift ? Math.max(1_000, (gift.price ?? 0) || 5_000) : 0}
        allowPartial
        onClose={() => setPayOpen(false)}
        onPay={(method, amount) => {
          if (!gift) return;
          contribute(gift.id, giver.trim(), amount, method, note.trim() || undefined);
          setPayOpen(false);
          setGift(null);
          setGiver('');
          setNote('');
          toast('Thank you for your blessing', 'heart');
        }}
      />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  center: { flex: 1, alignItems: 'center', gap: 12, paddingHorizontal: 24, backgroundColor: colors.bgSoft },
  veil: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'space-between', padding: 18 },
  previewBar: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  count: { marginTop: 8, borderWidth: 1, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 6 },
  body: { padding: 18, gap: 28 },
  rule: { width: 48, height: 2, alignSelf: 'center', borderRadius: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingRight: 12 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  photo: { aspectRatio: 1, borderRadius: 8 },
  giftCard: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
}));

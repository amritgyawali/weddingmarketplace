import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Photo } from '@/components/ui/Photo';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Card, ChoiceChips, KButton, KField, SectionTitle } from '@/components/kit';
import { ToolScreen, toolStyles } from '@/components/planner/ToolScreen';
import { Calendar } from '@/components/ui/Calendar';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast } from '@/components/ui/Toast';
import { photos, type PhotoKey } from '@/constants/images';
import { colors } from '@/constants/theme';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Project, WeddingWebsite } from '@/types/platform';
import { addDays, formatLongDate, uid } from '@/utils/format';
import { shareMessage, sitePath, webUrl } from '@/utils/links';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const TEMPLATES: { id: WeddingWebsite['template']; label: string; cover: PhotoKey; accent: string }[] = [
  { id: 'himalayan', label: 'Himalayan', cover: 'venueCliffside', accent: '#1F4E79' },
  { id: 'classic', label: 'Classic', cover: 'decorMandapNight', accent: '#9A6B1F' },
  { id: 'floral', label: 'Floral', cover: 'decorMandapFloral', accent: '#B8325A' },
  { id: 'minimal', label: 'Minimal', cover: 'ideaCoupleGardenWalk', accent: '#222222' },
];
const ACCENTS = ['#B8325A', '#C2185B', '#9A6B1F', '#1F4E79', '#2E7D32', '#6A1B9A', '#D84315', '#222222'];
const PHOTO_CHOICES: PhotoKey[] = ['ideaCoupleGardenWalk', 'ideaBrideParasol', 'ideaCeremonyHands', 'ideaReceptionToast', 'decorMandapFloral', 'decorMandapNight', 'venueCliffside', 'venueResortSunset', 'venueOutdoorMandap', 'venueGardenEstate', 'mehndiHands', 'makeupBridePortrait'];
const SECTION_LABELS: Record<keyof WeddingWebsite['sections'], string> = {
  rsvp: 'RSVP',
  story: 'Our story',
  schedule: 'Celebrations & schedule',
  dressCode: 'Dress code',
  travel: 'Travel & stay',
  gallery: 'Photo gallery',
  registry: 'Gift registry',
  faq: 'FAQ',
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, 'weds')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

function defaultSite(project: Project): WeddingWebsite {
  const first = project.customerName.split(' ')[0];
  const partner = project.partnerName?.split(' ')[0];
  const headline = partner ? `${first} & ${partner}` : project.title;
  return {
    projectId: project.id,
    slug: slugify(partner ? `${first} weds ${partner}` : project.title),
    template: 'himalayan',
    accent: '#B8325A',
    font: 'serif',
    headline,
    story: '',
    cover: 'ideaCoupleGardenWalk',
    gallery: ['ideaBrideParasol', 'ideaCoupleGardenWalk', 'decorMandapFloral'],
    sections: { schedule: true, travel: true, faq: true, registry: true, rsvp: true, gallery: true, dressCode: true, story: true },
    travel: '',
    dressCode: 'Traditional — saree, kurta, daura suruwal and dhaka topi are all welcome.',
    faqs: [{ q: 'Can I bring a plus-one?', a: 'Your invitation shows how many seats are reserved for you.' }],
    rsvpDeadline: addDays(project.weddingDate, -21),
    rsvpQuestions: [],
    published: false,
    searchable: false,
    views: 0,
    updatedAt: new Date().toISOString(),
  };
}

function Builder({ project, readOnly }: { project: Project; readOnly: boolean }) {
  const t = useRoleTheme();
  const saved = useDb((s) => s.websites.find((w) => w.projectId === project.id));
  const websites = useDb((s) => s.websites);
  const taken = websites.filter((w) => w.projectId !== project.id).map((w) => w.slug);
  const saveWebsite = useDb((s) => s.saveWebsite);
  const [site, setSite] = useState<WeddingWebsite>(saved ?? defaultSite(project));
  const [dirty, setDirty] = useState(!saved);
  const [deadlineOpen, setDeadlineOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const set = (patch: Partial<WeddingWebsite>) => {
    setSite((s) => ({ ...s, ...patch }));
    setDirty(true);
  };
  const slugError = !/^[a-z0-9-]{4,40}$/.test(site.slug) ? 'Use 4–40 lowercase letters, numbers or dashes' : taken.includes(site.slug) ? 'That address is taken — try another' : null;
  const url = webUrl(sitePath(site.slug));

  const save = (publish?: boolean) => {
    if (slugError) return toast(slugError, 'alert-circle');
    const next = { ...site, published: publish ?? site.published };
    saveWebsite(next);
    setSite(next);
    setDirty(false);
    toast(publish === true ? 'Website published' : publish === false ? 'Website unpublished' : 'Changes saved', 'globe');
  };

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <Card style={[toolStyles.row, { borderColor: site.published ? t.c.success : t.c.border }]}>
          <Ionicons name={site.published ? 'globe' : 'globe-outline'} size={26} color={site.published ? t.c.success : t.c.muted} />
          <View style={{ flex: 1 }}>
            <Text size={15} weight="bold" color={t.c.textStrong}>
              {site.published ? 'Live' : 'Draft — only you can see it'}
            </Text>
            <Text size={12} color={t.c.muted} numberOfLines={1}>
              {url}
            </Text>
            {saved && (
              <Text size={11} color={t.c.muted}>
                {saved.views} visits · updated {formatLongDate(saved.updatedAt)}
              </Text>
            )}
          </View>
          {site.published && <KButton label="Share" icon="share-social-outline" size="sm" variant="secondary" onPress={() => setShareOpen(true)} />}
        </Card>

        <SectionTitle title="Design" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {TEMPLATES.map((tp) => (
            <Pressable key={tp.id} disabled={readOnly} onPress={() => set({ template: tp.id, accent: tp.accent })} style={[styles.template, { borderColor: site.template === tp.id ? t.c.primary : t.c.border }]}>
              <Photo source={photos[tp.cover]} style={styles.templateImg} contentFit="cover" />
              <Text size={13} weight="semibold" color={t.c.textStrong} style={{ padding: 8 }}>
                {tp.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={toolStyles.wrap}>
          {ACCENTS.map((a) => (
            <Pressable key={a} disabled={readOnly} onPress={() => set({ accent: a })} accessibilityLabel={`Accent ${a}`} style={[styles.swatch, { backgroundColor: a, borderColor: site.accent === a ? t.c.textStrong : 'transparent' }]} />
          ))}
        </View>
        <ChoiceChips options={['Elegant serif', 'Modern sans']} selected={[site.font === 'serif' ? 'Elegant serif' : 'Modern sans']} onToggle={(v) => set({ font: v === 'Elegant serif' ? 'serif' : 'sans' })} />

        <SectionTitle title="Content" />
        <KField label="Headline" value={site.headline} onChangeText={(v) => set({ headline: v })} editable={!readOnly} />
        <KField label="Web address" value={site.slug} onChangeText={(v) => set({ slug: v.toLowerCase().replace(/[^a-z0-9-]/g, '') })} prefix="vivah.app/w/" error={slugError} editable={!readOnly} autoCapitalize="none" />
        <KField label="Our story" value={site.story} onChangeText={(v) => set({ story: v })} multiline placeholder="How you met, the proposal, what you’re excited about…" editable={!readOnly} />
        <Text size={13} weight="semibold" color={t.c.muted}>
          Cover photo
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {PHOTO_CHOICES.map((p) => (
            <Pressable key={p} disabled={readOnly} onPress={() => set({ cover: p })}>
              <Photo source={photos[p]} style={[styles.thumb, { borderColor: site.cover === p ? t.c.primary : 'transparent' }]} contentFit="cover" />
            </Pressable>
          ))}
        </ScrollView>
        <Text size={13} weight="semibold" color={t.c.muted}>
          Gallery ({site.gallery.length})
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {PHOTO_CHOICES.map((p) => {
            const on = site.gallery.includes(p);
            return (
              <Pressable key={p} disabled={readOnly} onPress={() => set({ gallery: on ? site.gallery.filter((x) => x !== p) : [...site.gallery, p] })}>
                <Photo source={photos[p]} style={[styles.thumb, { borderColor: on ? t.c.primary : 'transparent', opacity: on ? 1 : 0.55 }]} contentFit="cover" />
                {on && <Ionicons name="checkmark-circle" size={20} color={t.c.primary} style={styles.check} />}
              </Pressable>
            );
          })}
        </ScrollView>
        <KField label="Dress code" value={site.dressCode} onChangeText={(v) => set({ dressCode: v })} multiline editable={!readOnly} />
        <KField label="Travel & stay" value={site.travel} onChangeText={(v) => set({ travel: v })} multiline placeholder="Airport distance, parking, hotel blocks, janti bus timings…" editable={!readOnly} />

        <SectionTitle title="Sections" />
        <Card padded={false}>
          {(Object.keys(SECTION_LABELS) as (keyof WeddingWebsite['sections'])[]).map((k, i) => (
            <View key={k} style={[toolStyles.between, styles.toggleRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
              <Text size={14} color={t.c.text}>
                {SECTION_LABELS[k]}
              </Text>
              <Toggle value={site.sections[k]} onValueChange={(v) => set({ sections: { ...site.sections, [k]: v } })} accessibilityLabel={SECTION_LABELS[k]} />
            </View>
          ))}
        </Card>

        <SectionTitle title="FAQ" action={readOnly ? undefined : 'Add'} onAction={() => set({ faqs: [...site.faqs, { q: '', a: '' }] })} />
        {site.faqs.map((f, i) => (
          <Card key={i} style={{ gap: 8 }}>
            <KField placeholder="Question" value={f.q} onChangeText={(v) => set({ faqs: site.faqs.map((x, j) => (j === i ? { ...x, q: v } : x)) })} editable={!readOnly} />
            <KField placeholder="Answer" value={f.a} onChangeText={(v) => set({ faqs: site.faqs.map((x, j) => (j === i ? { ...x, a: v } : x)) })} multiline editable={!readOnly} />
            {!readOnly && <KButton label="Remove" variant="ghost" size="sm" icon="trash-outline" onPress={() => set({ faqs: site.faqs.filter((_, j) => j !== i) })} />}
          </Card>
        ))}

        <SectionTitle title="RSVP settings" />
        <Card style={{ gap: 10 }}>
          <Pressable onPress={() => !readOnly && setDeadlineOpen(true)} style={toolStyles.between}>
            <Text size={14} color={t.c.text}>
              Reply by
            </Text>
            <Text size={14} weight="semibold" color={t.c.primary}>
              {site.rsvpDeadline ? formatLongDate(site.rsvpDeadline) : 'No deadline'}
            </Text>
          </Pressable>
          <Text size={13} weight="semibold" color={t.c.muted}>
            Extra questions for guests
          </Text>
          {site.rsvpQuestions.map((q) => (
            <View key={q.id} style={toolStyles.between}>
              <Text size={14} color={t.c.text} style={{ flex: 1 }}>
                {q.kind === 'song' ? 'Song request: ' : ''}
                {q.q}
              </Text>
              {!readOnly && (
                <Pressable onPress={() => set({ rsvpQuestions: site.rsvpQuestions.filter((x) => x.id !== q.id) })} hitSlop={8} accessibilityLabel="Remove question">
                  <Ionicons name="close-circle" size={20} color={t.c.muted} />
                </Pressable>
              )}
            </View>
          ))}
          {!readOnly && (
            <>
              <View style={toolStyles.row}>
                <View style={{ flex: 1 }}>
                  <KField placeholder="e.g. Will you need a hotel room?" value={question} onChangeText={setQuestion} />
                </View>
                <KButton
                  label="Add"
                  size="sm"
                  missing={!question.trim() && 'Type the question for your guests first'}
                  onPress={() => {
                    set({ rsvpQuestions: [...site.rsvpQuestions, { id: uid('q'), q: question.trim(), kind: 'text' }] });
                    setQuestion('');
                  }}
                />
              </View>
              {!site.rsvpQuestions.some((q) => q.kind === 'song') && (
                <KButton label="Add song request" icon="musical-notes-outline" variant="ghost" size="sm" onPress={() => set({ rsvpQuestions: [...site.rsvpQuestions, { id: uid('q'), q: 'Which song will get you on the dance floor?', kind: 'song' }] })} />
              )}
            </>
          )}
        </Card>

        <SectionTitle title="Privacy" />
        <Card style={{ gap: 10 }}>
          <KField label="Password (optional)" value={site.password ?? ''} onChangeText={(v) => set({ password: v || undefined })} placeholder="Leave empty for an open website" editable={!readOnly} />
          <View style={toolStyles.between}>
            <Text size={14} color={t.c.text} style={{ flex: 1 }}>
              Let people find it by searching our names
            </Text>
            <Toggle value={site.searchable} onValueChange={(v) => set({ searchable: v })} accessibilityLabel="Searchable" />
          </View>
        </Card>
      </ScrollView>

      {!readOnly && (
        <View style={[styles.footer, { backgroundColor: t.c.surface, borderTopColor: t.c.border }]}>
          <KButton
            label="Preview"
            icon="eye-outline"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => {
              saveWebsite({ ...site, published: saved?.published ?? false });
              setDirty(false);
              router.push({ pathname: '/w/[slug]', params: { slug: site.slug, preview: '1' } });
            }}
          />
          {site.published ? (
            <KButton label={dirty ? 'Publish changes' : 'Unpublish'} variant={dirty ? 'primary' : 'ghost'} style={{ flex: 1.3 }} onPress={() => save(dirty ? true : false)} />
          ) : (
            <KButton label="Publish website" icon="rocket-outline" style={{ flex: 1.3 }} onPress={() => save(true)} />
          )}
        </View>
      )}

      <Sheet visible={deadlineOpen} onClose={() => setDeadlineOpen(false)} title="RSVP deadline">
        <View style={{ paddingHorizontal: 16 }}>
          <Calendar
            value={site.rsvpDeadline ?? null}
            onChange={(iso) => {
              set({ rsvpDeadline: iso });
              setDeadlineOpen(false);
            }}
          />
        </View>
      </Sheet>
      <Sheet visible={shareOpen} onClose={() => setShareOpen(false)} title="Share your website">
        <View style={{ paddingHorizontal: 20, gap: 14, alignItems: 'center' }}>
          <View style={styles.qr}>
            <QRCode value={url} size={180} color={site.accent} />
          </View>
          <Text size={13} color={t.c.muted} align="center">
            Print this QR on your invitation cards so guests can open the website and RSVP.
          </Text>
          <View style={[toolStyles.row, { alignSelf: 'stretch' }]}>
            <KButton
              label="Copy link"
              icon="copy-outline"
              variant="secondary"
              style={{ flex: 1 }}
              onPress={async () => {
                await Clipboard.setStringAsync(url);
                toast('Link copied');
              }}
            />
            <KButton label="Share" icon="share-social-outline" style={{ flex: 1 }} onPress={() => shareMessage(`Our wedding website 💍 ${site.headline}`, url)} />
          </View>
        </View>
      </Sheet>
    </>
  );
}

/** Wedding website builder: templates, story, schedule, travel, FAQ, registry, RSVP questions, privacy and publishing. */
export default function WebsiteScreen() {
  return (
    <ToolScreen title="Wedding website" subtitle={(p) => p.title}>
      {(project, { readOnly }) => <Builder project={project} readOnly={readOnly} />}
    </ToolScreen>
  );
}

const styles = StyleSheet.create({
  template: { width: 128, borderRadius: 8, borderWidth: 2, overflow: 'hidden', backgroundColor: colors.white },
  templateImg: { width: '100%', height: 90 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 3 },
  thumb: { width: 76, height: 76, borderRadius: 8, borderWidth: 2 },
  check: { position: 'absolute', top: 4, right: 4 },
  toggleRow: { paddingHorizontal: 14, paddingVertical: 10 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, padding: 14, paddingBottom: 26, borderTopWidth: StyleSheet.hairlineWidth },
  qr: { padding: 16, backgroundColor: '#fff', borderRadius: 10 },
});

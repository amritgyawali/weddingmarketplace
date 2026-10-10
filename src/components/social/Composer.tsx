import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Photo } from '@/components/ui/Photo';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, KButton, KField, SectionTitle, Segmented } from '@/components/kit';
import { Calendar } from '@/components/ui/Calendar';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast, toastError } from '@/components/ui/Toast';
import { cloudMediaReady, uploadMedia } from '@/backend/media';
import { saveSocialPostLive, sendSocialPostLive, socialLive, syncSocialFromServer } from '@/backend/social';
import { photo } from '@/constants/images';
import { NETWORK_BY_ID, NETWORKS } from '@/data/social';
import { useExperience } from '@/hooks/useExperience';
import { useLayout } from '@/hooks/useLayout';
import { bestHourFromHistory, captionFor, checkPost, hashtagsIn, nextBestSlots, postReady, suggestHashtags } from '@/services/social';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { SocialMedia, SocialNetwork, SocialPost } from '@/types/platform';
import { formatDateAlt, formatLongDate, formatNumber, toISODate, uid } from '@/utils/format';

import { ConnectSheet } from './ConnectSheet';
import { mediaSource, NetworkChip, NetworkIcon, useSocialWorkspace, whenLabel } from './parts';
import { PostPreview } from './Posts';

/** Back to where the composer was opened from, or to the posts list when it was opened directly (web link, refresh). */
const leave = () => (router.canGoBack() ? router.back() : router.replace({ pathname: '/business/social', params: { tab: 'posts' } }));

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** Local date + "HH:MM" → ISO timestamp, or null when the time isn't valid. */
function toIso(date: string, time: string): string | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(y, mo - 1, d, Number(m[1]), Number(m[2])).toISOString();
}

/**
 * Write once, publish everywhere: caption with per-network versions, photos
 * from the portfolio or the phone, hashtag and best-time suggestions, a check
 * against every network's rules, a live preview, then publish now, schedule
 * or keep as a draft.
 */
export function SocialComposer({ postId, at }: { postId?: string; at?: string }) {
  const t = useRoleTheme();
  const { wide } = useLayout();
  const account = useAccount();
  const exp = useExperience();
  const { accounts, posts } = useSocialWorkspace(account);
  const portfolio = useDb((s) => s.portfolio);
  const save = useDb((s) => s.saveSocialPost);
  const schedule = useDb((s) => s.scheduleSocialPost);
  const publish = useDb((s) => s.publishSocialPost);
  const existing = postId ? posts.find((p) => p.id === postId) : undefined;
  const connected = accounts.filter((a) => a.status !== 'disconnected').map((a) => a.network);

  const startAt = at ? new Date(at.length <= 16 ? `${at}:00` : at) : existing?.scheduledAt ? new Date(existing.scheduledAt) : null;
  const [caption, setCaption] = useState(existing?.caption ?? '');
  const [overrides, setOverrides] = useState<SocialPost['overrides']>(existing?.overrides ?? {});
  const [media, setMedia] = useState<SocialMedia[]>(existing?.media ?? []);
  const [networks, setNetworks] = useState<SocialNetwork[]>(existing?.networks ?? NETWORKS.filter((n) => connected.includes(n.id) && n.id !== 'whatsapp').map((n) => n.id));
  const [link, setLink] = useState(existing?.link ?? '');
  const [firstComment, setFirstComment] = useState(existing?.firstComment ?? '');
  const [campaign, setCampaign] = useState(existing?.campaign ?? '');
  const [more, setMore] = useState(!!(existing?.link || existing?.firstComment || existing?.campaign));
  const [editing, setEditing] = useState<'main' | SocialNetwork>('main');
  const [preview, setPreview] = useState<SocialNetwork | null>(null);
  const [when, setWhen] = useState<'now' | 'later'>(startAt && !Number.isNaN(startAt.getTime()) ? 'later' : 'now');
  const [date, setDate] = useState(startAt && !Number.isNaN(startAt.getTime()) ? toISODate(startAt) : toISODate(new Date()));
  const [time, setTime] = useState(startAt && !Number.isNaN(startAt.getTime()) ? hhmm(startAt) : '19:30');
  const [pickDate, setPickDate] = useState(false);
  const [library, setLibrary] = useState(false);
  const [connecting, setConnecting] = useState<SocialNetwork | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);

  const scheduledAt = when === 'later' ? toIso(date, time) : null;
  const draft = { caption, overrides, media, networks, link, scheduledAt: scheduledAt ?? undefined };
  const checks = checkPost(draft, accounts, new Date().toISOString());
  const ready = postReady(checks) && (when === 'now' || !!scheduledAt) && uploading === 0;
  const blocked = checks.find((c) => c.errors.length);
  const notReady = ready
    ? null
    : uploading > 0
      ? 'Wait for the photos to finish uploading'
      : !checks.length
        ? 'Pick at least one network to post to'
        : blocked
          ? `${NETWORK_BY_ID[blocked.network].label}: ${blocked.errors[0]}`
          : 'Pick the date and time to schedule the post';
  const text = editing === 'main' ? caption : (overrides[editing] ?? '');
  const setText = (v: string) => (editing === 'main' ? setCaption(v) : setOverrides({ ...overrides, [editing]: v }));
  const limitNets = (editing === 'main' ? networks.filter((n) => !overrides[n]?.trim()) : [editing]).map((n) => NETWORK_BY_ID[n]);
  const tightest = limitNets.sort((a, b) => a.captionLimit - b.captionLimit)[0];
  const tags = suggestHashtags({ services: exp.services, city: account.city, caption: text, date: scheduledAt ? toISODate(new Date(scheduledAt)) : toISODate(new Date()) });
  const slots = nextBestSlots(networks, new Date(), 4, bestHourFromHistory(posts));
  const shown = preview && networks.includes(preview) ? preview : networks[0];
  const own = portfolio.filter((p) => p.providerId === account.listingId);

  const toggleNetwork = (n: SocialNetwork) => {
    if (!connected.includes(n)) {
      setConnecting(n);
      return;
    }
    setNetworks(networks.includes(n) ? networks.filter((x) => x !== n) : [...networks, n]);
    if (editing === n) setEditing('main');
  };

  const pickFromPhone = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8, allowsMultipleSelection: true, selectionLimit: 10 });
    if (res.canceled) return;
    if (!cloudMediaReady()) {
      setMedia([...media, ...res.assets.map((a) => ({ id: uid('md'), kind: a.type === 'video' ? ('video' as const) : ('image' as const), uri: a.uri }))]);
      return;
    }
    // Live: the networks fetch files from a public URL, so each file goes to Cloudinary first (and into the portfolio).
    setUploading(res.assets.length);
    const added: SocialMedia[] = [];
    for (const a of res.assets) {
      const up = await uploadMedia({ uri: a.uri, mimeType: a.mimeType, fileName: a.fileName, fileSize: a.fileSize }, 'portfolio');
      if (up.ok) added.push({ id: uid('md'), kind: up.value.kind, uri: up.value.url, publicId: up.value.publicId });
      else toastError(up.error);
      setUploading((n) => Math.max(0, n - 1));
    }
    setMedia((cur) => [...cur, ...added]);
  };

  const persist = () => {
    const res = save({ id: existing?.id, caption, overrides, media, networks, link, firstComment, campaign });
    return res.id ?? null;
  };

  /** Supabase builds: the server saves, publishes or schedules, then the hub is read again. */
  const sendLive = async (go: boolean) => {
    // The networks can only fetch files that have a public URL (uploaded to Cloudinary).
    if (go && media.some((m) => !m.publicId && !(m.uri ?? '').startsWith('https://'))) {
      toastError('Some photos are only on this device. Remove them and add them again from this device or your portfolio.');
      return;
    }
    const post = { id: existing?.id ?? '', caption, overrides, media, networks, link, firstComment, campaign };
    setBusy(true);
    const r = go ? await sendSocialPostLive({ ...post, status: 'draft', results: {}, ownerId: account.id, createdAt: '', updatedAt: '' }, { at: when === 'later' ? (scheduledAt ?? undefined) : undefined }) : await saveSocialPostLive(post);
    if (r.ok) await syncSocialFromServer(account.id);
    setBusy(false);
    if (!r.ok) {
      toastError(r.error);
      return;
    }
    toast(!go ? 'Draft saved' : when === 'later' && scheduledAt ? `Scheduled for ${whenLabel(scheduledAt)}` : 'Publishing to your networks', go ? 'paper-plane' : 'document-text');
    leave();
  };

  const onDraft = () => {
    if (socialLive()) return void sendLive(false);
    if (!persist()) return;
    toast('Draft saved', 'document-text');
    leave();
  };

  const onGo = async () => {
    if (socialLive()) return sendLive(true);
    const id = persist();
    if (!id) return;
    if (when === 'later' && scheduledAt) {
      const error = schedule(id, scheduledAt);
      if (error) return;
      toast(`Scheduled for ${whenLabel(scheduledAt)}`, 'calendar');
      leave();
      return;
    }
    const error = publish(id);
    if (error) return;
    toast('Publishing to your networks', 'paper-plane');
    leave();
  };

  const editor = (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 10 }}>
        <SectionTitle title="Post to" />
        <View style={styles.wrap}>
          {NETWORKS.map((n) => (
            <NetworkChip key={n.id} network={n.id} label={connected.includes(n.id) ? n.label : `Connect ${n.label}`} selected={networks.includes(n.id)} disabled={!connected.includes(n.id)} onPress={() => toggleNetwork(n.id)} />
          ))}
        </View>
        {networks.includes('whatsapp') && (
          <Text size={12} color={t.c.muted}>
            WhatsApp posts go as a broadcast to customers who agreed to updates, using your approved template.
          </Text>
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        {networks.length > 1 && (
          <View style={{ marginHorizontal: -16, marginTop: -6 }}>
            <Segmented options={[{ id: 'main' as const, label: 'All networks' }, ...networks.map((n) => ({ id: n, label: NETWORK_BY_ID[n].label }))]} value={editing} onChange={setEditing} />
          </View>
        )}
        {editing !== 'main' && (
          <Text size={12} color={t.c.muted}>
            {overrides[editing]?.trim() ? `${NETWORK_BY_ID[editing].label} gets this version instead of the main caption.` : `Empty: ${NETWORK_BY_ID[editing].label} uses the main caption.`}
          </Text>
        )}
        <KField value={text} onChangeText={setText} multiline placeholder={editing === 'main' ? 'Write your caption. What is new, who it is for, how to book.' : `A version just for ${NETWORK_BY_ID[editing].label}`} style={{ minHeight: 140 }} />
        <View style={styles.row}>
          <Text size={12} color={tightest && text.length > tightest.captionLimit ? t.c.danger : t.c.muted} style={{ flex: 1 }}>
            {formatNumber(text.length)} characters{tightest ? ` · ${tightest.label} allows ${formatNumber(tightest.captionLimit)}` : ''} · {hashtagsIn(text).length} hashtags
          </Text>
        </View>
        {tags.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text size={12} color={t.c.muted}>
              Suggested hashtags
            </Text>
            <View style={styles.wrap}>
              {tags.map((tag) => (
                <Pressable key={tag} onPress={() => setText(`${text}${text && !/\s$/.test(text) ? ' ' : ''}${tag}`)} accessibilityRole="button" accessibilityLabel={`Add ${tag}`} style={({ pressed }) => [styles.tag, { borderColor: t.c.border, opacity: pressed ? 0.6 : 1 }]}>
                  <Text size={13} color={t.c.primary} raw>
                    {tag}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionTitle title={`Photos and videos (${media.length})`} />
        {media.length > 0 && (
          <View style={styles.wrap}>
            {media.map((m, i) => {
              const src = mediaSource(m);
              return (
                <View key={m.id} style={[styles.thumb, { backgroundColor: t.c.surfaceAlt }]}>
                  {src && <Photo source={src} style={StyleSheet.absoluteFill} contentFit="cover" />}
                  {m.kind === 'video' && <Ionicons name="videocam" size={18} color={t.c.onPrimary} style={{ position: 'absolute', left: 6, bottom: 6 }} />}
                  <Pressable onPress={() => setMedia(media.filter((x) => x.id !== m.id))} hitSlop={6} accessibilityLabel={`Remove file ${i + 1}`} style={[styles.remove, { backgroundColor: t.c.surface }]}>
                    <Ionicons name="close" size={14} color={t.c.textStrong} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
        <View style={[styles.row, { flexWrap: 'wrap' }]}>
          <KButton label="From your portfolio" size="sm" variant="secondary" icon="images-outline" onPress={() => setLibrary(true)} />
          <KButton label="From this device" size="sm" variant="secondary" icon="cloud-upload-outline" onPress={pickFromPhone} loading={uploading > 0} />
        </View>
        {cloudMediaReady() && (
          <Text size={12} color={t.c.muted}>
            {uploading > 0 ? `Uploading ${uploading} file${uploading === 1 ? '' : 's'}…` : 'Files from this device are uploaded once and also added to your portfolio.'}
          </Text>
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        <SectionTitle title="When" />
        <Segmented options={[{ id: 'now' as const, label: 'Right away' }, { id: 'later' as const, label: 'At a set time' }]} value={when} onChange={setWhen} />
        {when === 'later' && (
          <View style={{ gap: 10 }}>
            <Text size={12} color={t.c.muted}>
              Best times for the networks you picked
            </Text>
            <View style={styles.wrap}>
              {slots.map((s) => {
                const d = new Date(s.at);
                const on = date === toISODate(d) && time === hhmm(d);
                return (
                  <Pressable
                    key={s.at}
                    onPress={() => {
                      setDate(toISODate(d));
                      setTime(hhmm(d));
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${whenLabel(s.at)}: ${s.why}`}
                    style={({ pressed }) => [styles.slot, { borderColor: on ? t.c.textStrong : t.c.border, backgroundColor: on ? t.c.surfaceAlt : t.c.surface, opacity: pressed ? 0.6 : 1 }]}>
                    <Text size={13} weight="semibold" color={t.c.textStrong}>
                      {whenLabel(s.at)}
                    </Text>
                    <Text size={11} color={t.c.muted} numberOfLines={1}>
                      {s.why}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.row}>
              <Pressable onPress={() => setPickDate(!pickDate)} accessibilityRole="button" style={[styles.dateBtn, { borderColor: t.c.border, flex: 1 }]}>
                <Ionicons name="calendar-outline" size={18} color={t.c.muted} />
                <Text size={14} color={t.c.textStrong} numberOfLines={1} style={{ flex: 1 }}>
                  {formatLongDate(date)} · {formatDateAlt(date)}
                </Text>
              </Pressable>
              <View style={{ width: 96 }}>
                <KField value={time} onChangeText={setTime} placeholder="19:30" maxLength={5} keyboardType="numbers-and-punctuation" accessibilityLabel="Time" />
              </View>
            </View>
            {pickDate && (
              <Calendar
                value={date}
                onChange={(d) => {
                  setDate(d);
                  setPickDate(false);
                }}
              />
            )}
            {!scheduledAt && (
              <Text size={12} color={t.c.danger}>
                Use a 24-hour time such as 19:30.
              </Text>
            )}
          </View>
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        <Pressable onPress={() => setMore(!more)} accessibilityRole="button" style={styles.row}>
          <Text size={15} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }}>
            More options
          </Text>
          <Ionicons name={more ? 'chevron-up' : 'chevron-down'} size={18} color={t.c.muted} />
        </Pressable>
        {more && (
          <>
            <KField label="Link (Facebook)" value={link} onChangeText={setLink} placeholder="https://vivah.com.np/…" autoCapitalize="none" keyboardType="url" />
            <KField label="First comment (Facebook and Instagram)" value={firstComment} onChangeText={setFirstComment} multiline placeholder="Extra hashtags or how to book" />
            <KField label="Campaign" value={campaign} onChangeText={setCampaign} placeholder="Mangsir season" hint="Groups posts in the list and insights" />
          </>
        )}
      </Card>
    </View>
  );

  const side = (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 8 }}>
        <SectionTitle title="Checks" />
        {networks.length === 0 ? (
          <Text size={13} color={t.c.danger}>
            Pick at least one network.
          </Text>
        ) : (
          checks.map((c) => (
            <View key={c.network} style={{ gap: 3 }}>
              <View style={styles.row}>
                <NetworkIcon network={c.network} size={15} />
                <Text size={13} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }}>
                  {NETWORK_BY_ID[c.network].label}
                </Text>
                <Ionicons name={c.errors.length ? 'alert-circle' : 'checkmark-circle'} size={16} color={c.errors.length ? t.c.danger : t.c.success} />
              </View>
              {c.errors.map((e) => (
                <Text key={e} size={12} color={t.c.danger}>
                  {e}
                </Text>
              ))}
              {c.warnings.map((w) => (
                <Text key={w} size={12} color={t.c.muted}>
                  {w}
                </Text>
              ))}
            </View>
          ))
        )}
      </Card>
      {shown && (
        <View style={{ gap: 8 }}>
          {networks.length > 1 && <Segmented options={networks.map((n) => ({ id: n, label: NETWORK_BY_ID[n].label }))} value={shown} onChange={setPreview} />}
          <PostPreview post={{ caption, overrides, media, link }} network={shown} account={accounts.find((a) => a.network === shown)} />
          {captionFor({ caption, overrides }, shown) !== caption && (
            <Text size={12} color={t.c.muted}>
              Showing the {NETWORK_BY_ID[shown].label} version of the caption.
            </Text>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
        {wide ? (
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
            <View style={{ flex: 1.3 }}>{editor}</View>
            <View style={{ flex: 1 }}>{side}</View>
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {editor}
            {side}
          </View>
        )}
      </ScrollView>
      <View style={[styles.footer, { borderTopColor: t.c.border, backgroundColor: t.c.surface }]}>
        <KButton label="Save draft" variant="secondary" onPress={onDraft} missing={!caption.trim() && media.length === 0 && 'Write a caption or add a photo first'} style={{ flex: 1 }} />
        <KButton label={when === 'later' ? 'Schedule' : 'Publish now'} icon={when === 'later' ? 'calendar-outline' : 'paper-plane-outline'} onPress={onGo} missing={notReady} loading={busy} style={{ flex: 1.4 }} />
      </View>

      <Sheet visible={library} onClose={() => setLibrary(false)} title="Your portfolio">
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={[styles.wrap, { paddingHorizontal: 20, paddingBottom: 16 }]}>
          {own.length === 0 && (
            <Text size={14} color={t.c.muted}>
              Your portfolio is empty. Add photos under Business → Portfolio, or pick from this device.
            </Text>
          )}
          {own.map((p) => {
            const picked = media.some((m) => (p.uri ? m.uri === p.uri : m.image === p.image));
            const src = p.uri ? { uri: p.uri } : p.image ? photo(p.image) : undefined;
            return (
              <Pressable
                key={p.id}
                onPress={() => (picked ? setMedia(media.filter((m) => !(p.uri ? m.uri === p.uri : m.image === p.image))) : setMedia([...media, { id: uid('md'), kind: p.kind, image: p.image, uri: p.uri, publicId: p.publicId, alt: p.caption }]))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: picked }}
                accessibilityLabel={p.caption}
                style={[styles.libItem, { borderColor: picked ? t.c.primary : t.c.border }]}>
                {src && <Photo source={src} style={StyleSheet.absoluteFill} contentFit="cover" />}
                {picked && (
                  <View style={[styles.check, { backgroundColor: t.c.primary }]}>
                    <Ionicons name="checkmark" size={14} color={t.c.onPrimary} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ paddingHorizontal: 20 }}>
          <KButton label="Done" onPress={() => setLibrary(false)} />
        </View>
      </Sheet>
      <ConnectSheet network={connecting} onClose={() => setConnecting(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { borderWidth: 1, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  thumb: { width: 76, height: 76, borderRadius: 6, overflow: 'hidden' },
  remove: { position: 'absolute', right: 4, top: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  slot: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, maxWidth: 220 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, height: 46 },
  footer: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  libItem: { width: 96, height: 96, borderRadius: 6, overflow: 'hidden', borderWidth: 2 },
  check: { position: 'absolute', right: 4, top: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});

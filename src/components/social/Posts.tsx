import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, KButton, SectionTitle, Segmented, StatusPill } from '@/components/kit';
import { MonthGrid } from '@/components/work/MonthGrid';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';
import { useLayout } from '@/hooks/useLayout';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { deleteSocialPostLive, publishSocialPostLive, saveSocialPostLive } from '@/backend/social';
import { socialColors } from '@/constants/theme';
import { NETWORK_BY_ID } from '@/data/social';
import { bestHourFromHistory, captionFor, engagementOf, formatCount, nextBestSlots } from '@/services/social';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { SocialAccount, SocialNetwork, SocialPost } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { formatLongDate, timeAgo, toISODate } from '@/utils/format';

import { socialAct } from './live';
import { mediaSource, NetworkIcon, PostThumb, useSocialWorkspace, whenLabel } from './parts';

type PostView = 'all' | 'scheduled' | 'draft' | 'published' | 'failed';
const VIEWS: { id: PostView; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'draft', label: 'Drafts' },
  { id: 'published', label: 'Published' },
  { id: 'failed', label: 'Needs attention' },
];

const inView = (p: SocialPost, v: PostView) =>
  v === 'all' || (v === 'published' ? p.status === 'published' || p.status === 'partial' : v === 'failed' ? p.status === 'failed' || Object.values(p.results).some((r) => r?.status === 'failed') : p.status === v);

/** Opens the composer, for a new post or to edit a draft. */
export const composeHref = (params: { id?: string; at?: string } = {}) => ({ pathname: '/business/social/compose' as const, params });

/** Every post with its status on each network, numbers once published, and the actions that fit its state. Scrolls itself (the filter stays on top). */
export function SocialPosts() {
  const { wide } = useLayout();
  const account = useAccount();
  const { posts } = useSocialWorkspace(account);
  const [view, setView] = useState<PostView>('all');
  // Scheduled posts first, soonest at the top; then everything else, newest first.
  const list = posts
    .filter((p) => inView(p, view))
    .sort((a, b) => {
      const sa = a.status === 'scheduled' && a.scheduledAt;
      const sb = b.status === 'scheduled' && b.scheduledAt;
      if (sa && sb) return sa.localeCompare(sb);
      if (sa || sb) return sa ? -1 : 1;
      return (b.publishedAt ?? b.updatedAt).localeCompare(a.publishedAt ?? a.updatedAt);
    });
  const counts = Object.fromEntries(VIEWS.map((v) => [v.id, posts.filter((p) => inView(p, v.id)).length])) as Record<PostView, number>;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexShrink: 0 }}>
        <Segmented options={VIEWS} value={view} onChange={setView} counts={counts} />
      </View>
      <ScrollView contentContainerStyle={[{ padding: 16, gap: 10, paddingBottom: 40 }, wide && { maxWidth: 1040, width: '100%', alignSelf: 'center' }]}>
        {list.length === 0 ? (
          <EmptyBlock icon="images-outline" title="No posts here" message="Write once and publish to every connected network, now or at the best time." action="New post" onAction={() => router.push(composeHref())} />
        ) : (
          list.map((p) => <PostCard key={p.id} post={p} />)
        )}
      </ScrollView>
    </View>
  );
}

const RESULT_ICON = { queued: 'time-outline', publishing: 'sync-outline', published: 'checkmark-circle', failed: 'alert-circle' } as const;

/** One post: thumbnail, caption, where it is going or went, numbers and actions. */
export function PostCard({ post }: { post: SocialPost }) {
  const t = useRoleTheme();
  const account = useAccount();
  const publish = useDb((s) => s.publishSocialPost);
  const retry = useDb((s) => s.retrySocialPost);
  const duplicate = useDb((s) => s.duplicateSocialPost);
  const remove = useDb((s) => s.deleteSocialPost);
  const editable = post.status === 'draft' || post.status === 'scheduled' || post.status === 'failed';
  const reach = Object.values(post.results).reduce((s, r) => s + (r?.reach ?? 0), 0);
  const eng = Object.values(post.results).reduce((s, r) => s + (r ? engagementOf(r) : 0), 0);
  const when = post.status === 'scheduled' && post.scheduledAt ? `Goes out ${whenLabel(post.scheduledAt)}` : post.publishedAt ? `Published ${timeAgo(post.publishedAt)}` : `Edited ${timeAgo(post.updatedAt)}`;

  const publishNow = async () => {
    if (!(await socialAct(account.id, () => publish(post.id), () => publishSocialPostLive(post.id)))) toast('Publishing to your networks', 'paper-plane');
  };

  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.row}>
        <PostThumb media={post.media} size={64} />
        <View style={{ flex: 1, gap: 4 }}>
          <View style={styles.row}>
            <StatusPill status={post.status === 'partial' ? 'pending' : post.status === 'scheduled' ? 'planned' : post.status === 'publishing' ? 'in_progress' : post.status} label={post.status === 'partial' ? 'Partly published' : post.status.charAt(0).toUpperCase() + post.status.slice(1)} />
            {post.campaign && (
              <Text size={12} color={t.c.muted} numberOfLines={1} raw>
                {post.campaign}
              </Text>
            )}
          </View>
          <Text size={14} color={t.c.textStrong} numberOfLines={3} raw>
            {post.caption || 'No caption'}
          </Text>
          <Text size={12} color={t.c.muted}>
            {when}
          </Text>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        {post.networks.map((n) => {
          const r = post.results[n];
          return (
            <View key={n} style={styles.row}>
              <NetworkIcon network={n} size={16} />
              <Text size={13} color={t.c.text} style={{ width: 80 }}>
                {NETWORK_BY_ID[n].label}
              </Text>
              {r ? <Ionicons name={RESULT_ICON[r.status]} size={15} color={r.status === 'failed' ? t.c.danger : r.status === 'published' ? t.c.success : t.c.muted} /> : <Ionicons name="ellipse-outline" size={13} color={t.c.subtle} />}
              <Text size={12} color={r?.status === 'failed' ? t.c.danger : t.c.muted} style={{ flex: 1 }} numberOfLines={2}>
                {r?.status === 'published' ? `${formatCount(r.reach ?? 0)} reached · ${formatCount(engagementOf(r))} engaged` : r?.status === 'failed' ? (r.error ?? 'Not published') : r?.status === 'publishing' ? 'Publishing…' : r?.status === 'queued' ? 'Queued' : 'Draft'}
              </Text>
              {r?.status === 'failed' && <KButton label="Retry" size="sm" variant="secondary" onPress={() => socialAct(account.id, () => retry(post.id, n), () => publishSocialPostLive(post.id))} />}
              {r?.status === 'published' && r.url && (
                <Pressable onPress={() => Linking.openURL(r.url!)} hitSlop={8} accessibilityRole="link" accessibilityLabel={`Open on ${NETWORK_BY_ID[n].label}`}>
                  <Ionicons name="open-outline" size={16} color={t.c.primary} />
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      {reach > 0 && (
        <Text size={12} color={t.c.muted}>
          {formatCount(reach)} people reached · {formatCount(eng)} likes, comments, shares and saves · {((eng / reach) * 100).toFixed(1)}% engagement
        </Text>
      )}

      <View style={[styles.row, { flexWrap: 'wrap' }]}>
        {(post.status === 'draft' || post.status === 'scheduled') && <KButton label="Publish now" size="sm" icon="paper-plane-outline" onPress={publishNow} />}
        {editable && <KButton label="Edit" size="sm" variant="secondary" icon="create-outline" onPress={() => router.push(composeHref({ id: post.id }))} />}
        <KButton
          label="Duplicate"
          size="sm"
          variant="ghost"
          icon="copy-outline"
          onPress={async () => {
            let id: string | null = null;
            const error = await socialAct(
              account.id,
              () => {
                id = duplicate(post.id);
                return id && /\s/.test(id) ? id : null;
              },
              async () => {
                const r = await saveSocialPostLive({ ...post, id: '' });
                if (r.ok) id = r.value;
                return r;
              },
            );
            if (!error && id) router.push(composeHref({ id }));
          }}
        />
        {post.status !== 'publishing' && <KButton label="Delete" size="sm" variant="ghost" icon="trash-outline" onPress={() => confirm('Delete this post?', post.status === 'published' || post.status === 'partial' ? 'It is removed from Vivah only; it stays live on the networks.' : 'The draft and its schedule are removed.', 'Delete', () => void socialAct(account.id, () => remove(post.id), () => deleteSocialPostLive(post.id)))} />}
      </View>
    </Card>
  );
}

/** How a post will look on one network: name, photo, caption cut where the network cuts it. */
export function PostPreview({ post, network, account }: { post: Pick<SocialPost, 'caption' | 'overrides' | 'media' | 'link'>; network: SocialNetwork; account?: SocialAccount }) {
  const t = useRoleTheme();
  const caption = captionFor(post, network);
  const first = post.media[0];
  const src = first ? mediaSource(first) : undefined;
  const fold = network === 'instagram' || network === 'tiktok' ? 125 : 480;
  const short = caption.length > fold ? `${caption.slice(0, fold).trimEnd()}… more` : caption;
  const name = account?.handle ?? 'Your account';
  const square = network === 'instagram';
  const tall = network === 'tiktok';
  return (
    <View style={[styles.preview, { borderColor: t.c.border, backgroundColor: t.c.surface }]}>
      <View style={[styles.row, { padding: 10 }]}>
        <View style={[styles.previewAvatar, { borderColor: socialColors[network] }]}>
          <NetworkIcon network={network} size={14} />
        </View>
        <View style={{ flex: 1 }}>
          <Text size={13} weight="semibold" color={t.c.textStrong} numberOfLines={1} raw>
            {name}
          </Text>
          <Text size={11} color={t.c.muted}>
            {NETWORK_BY_ID[network].postAs}
          </Text>
        </View>
      </View>
      {network === 'whatsapp' ? (
        <View style={[styles.waBubble, { backgroundColor: t.c.soft }]}>
          {src && <Image source={src} style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 6 }} contentFit="cover" />}
          <Text size={14} color={t.c.textStrong} raw>
            {caption || ' '}
          </Text>
        </View>
      ) : (
        <>
          {network === 'facebook' && !!short && (
            <Text size={14} color={t.c.textStrong} style={{ paddingHorizontal: 10, paddingBottom: 8 }} raw>
              {short}
            </Text>
          )}
          {src ? (
            <View>
              <Image source={src} style={{ width: '100%', aspectRatio: tall ? 9 / 14 : square ? 1 : 4 / 3 }} contentFit="cover" />
              {post.media.length > 1 && (
                <View style={[styles.multi, { backgroundColor: t.c.surface }]}>
                  <Text size={11} weight="semibold" color={t.c.textStrong}>
                    1/{post.media.length}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            NETWORK_BY_ID[network].needsMedia && (
              <View style={[styles.noMedia, { backgroundColor: t.c.surfaceAlt }]}>
                <Ionicons name="image-outline" size={28} color={t.c.subtle} />
                <Text size={12} color={t.c.muted}>
                  {NETWORK_BY_ID[network].label} needs a photo or video
                </Text>
              </View>
            )
          )}
          {network !== 'facebook' && !!short && (
            <Text size={13} color={t.c.textStrong} style={{ padding: 10 }} raw>
              {short}
            </Text>
          )}
          {network === 'facebook' && post.link && (
            <Text size={12} color={t.c.info} style={{ paddingHorizontal: 10, paddingBottom: 10 }} numberOfLines={1} raw>
              {post.link}
            </Text>
          )}
        </>
      )}
    </View>
  );
}

/** Month view of scheduled and published posts, the selected day's posts, and this week's best times. */
export function SocialCalendar() {
  const t = useRoleTheme();
  const account = useAccount();
  const { posts, accounts } = useSocialWorkspace(account);
  const [day, setDay] = useState(toISODate(new Date()));
  const dayOf = (p: SocialPost) => {
    const at = p.scheduledAt ?? p.publishedAt;
    return at ? toISODate(new Date(at)) : null;
  };
  const marks: Record<string, string[]> = {};
  for (const p of posts) {
    const d = dayOf(p);
    if (!d) continue;
    const tone = p.status === 'scheduled' ? t.c.primary : p.status === 'failed' ? t.c.danger : t.c.success;
    marks[d] = [...new Set([...(marks[d] ?? []), tone])];
  }
  const onDay = posts.filter((p) => dayOf(p) === day);
  const networks = accounts.filter((a) => a.status === 'connected').map((a) => a.network);
  const slots = nextBestSlots(networks, new Date(), 5, bestHourFromHistory(posts));

  return (
    <View style={{ padding: 16, gap: 16 }}>
      <Card>
        <MonthGrid marks={marks} selected={day} onSelect={setDay} />
        <View style={[styles.row, { marginTop: 10, gap: 14 }]}>
          {[
            { c: t.c.primary, l: 'Scheduled' },
            { c: t.c.success, l: 'Published' },
            { c: t.c.danger, l: 'Failed' },
          ].map((x) => (
            <View key={x.l} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: x.c }]} />
              <Text size={12} color={t.c.muted}>
                {x.l}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <View>
        <SectionTitle title={formatLongDate(day)} action="Plan a post" onAction={() => router.push(composeHref({ at: `${day}T19:30` }))} />
        {onDay.length === 0 ? (
          <Card>
            <Text size={14} color={t.c.muted}>
              Nothing planned for this day.
            </Text>
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {onDay.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </View>
        )}
      </View>

      <View>
        <SectionTitle title="Best times to post" />
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {slots.map((s, i) => (
            <Pressable
              key={s.at}
              onPress={() => router.push(composeHref({ at: s.at }))}
              accessibilityRole="button"
              style={({ pressed }) => [styles.slot, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }, pressed && { backgroundColor: t.c.surfaceAlt }]}>
              <Ionicons name="time-outline" size={18} color={t.c.muted} />
              <View style={{ flex: 1 }}>
                <Text size={14} weight="semibold" color={t.c.textStrong}>
                  {whenLabel(s.at)}
                </Text>
                <Text size={12} color={t.c.muted}>
                  {s.why}
                </Text>
              </View>
              <Text size={13} weight="medium" color={t.c.primary}>
                Plan
              </Text>
            </Pressable>
          ))}
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preview: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  previewAvatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  waBubble: { margin: 10, marginTop: 0, borderRadius: 8, padding: 8, gap: 6 },
  multi: { position: 'absolute', right: 8, top: 8, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  noMedia: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  slot: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
});

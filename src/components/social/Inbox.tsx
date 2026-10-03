import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView as RNScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ChoiceChips, EmptyBlock, KButton, KField, Segmented, type IconName } from '@/components/kit';
import { Calendar } from '@/components/ui/Calendar';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';
import { SearchBar } from '@/components/ui/SearchBar';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast, toastError } from '@/components/ui/Toast';
import { leadSocialLive, noteSocialLive, sendSocialReplyLive, socialLive, syncSocialFromServer, triageSocialLive } from '@/backend/social';
import { inputReset } from '@/constants/theme';
import { NETWORK_BY_ID, NETWORKS, SOCIAL_LABELS, WHATSAPP_TEMPLATES } from '@/data/social';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { useT } from '@/i18n';
import { fillReply, inboxStats, leadHints, replyWindow, suggestReplies, type ReplyContext } from '@/services/social';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Account, SocialNetwork, SocialThread } from '@/types/platform';
import { formatDateAlt, formatLongDate, formatMoney, formatTime, parseMoney, timeAgo, today } from '@/utils/format';

import { socialAct } from './live';
import { ContactAvatar, DeliveryTicks, LabelTag, NetworkChip, NetworkIcon, useNow, useSocialWorkspace, useThreadMessages, whenLabel } from './parts';

type InboxView = 'open' | 'pending' | 'done' | 'starred';
const VIEWS: { id: InboxView; label: string }[] = [
  { id: 'open', label: 'Open' },
  { id: 'pending', label: 'Waiting' },
  { id: 'starred', label: 'Starred' },
  { id: 'done', label: 'Done' },
];

/** Reply context for this business: name, city and its highest active package price. */
export function useReplyContext(account: Account, contact: string): ReplyContext {
  const packages = useDb((s) => s.packages);
  const pkg = packages.filter((p) => p.providerId === account.listingId && p.active).sort((a, b) => b.price - a.price)[0];
  return { business: account.businessName ?? account.name, city: account.city, price: pkg ? `${formatMoney(pkg.price)} ${pkg.unit}` : undefined, contact };
}

/** Every message and comment from the connected networks, with filters, search and a check for new messages. */
export function SocialInbox({ onOpen, selectedId }: { onOpen: (id: string) => void; selectedId?: string }) {
  const t = useRoleTheme();
  const tr = useT();
  const account = useAccount();
  const { threads, messages, accounts } = useSocialWorkspace(account);
  const sync = useDb((s) => s.syncSocialInbox);
  const [network, setNetwork] = useState<SocialNetwork | 'all'>('all');
  const [view, setView] = useState<InboxView>('open');
  const [query, setQuery] = useState('');
  const stats = inboxStats(threads, messages);
  const connected = NETWORKS.filter((n) => accounts.some((a) => a.network === n.id && a.status !== 'disconnected'));
  const q = query.trim().toLowerCase();
  const lastOf = new Map<string, (typeof messages)[number]>();
  for (const m of messages) if (m.direction !== 'note') lastOf.set(m.threadId, m);

  const inView = (th: SocialThread, v: InboxView) => (v === 'starred' ? !!th.starred : th.status === v);
  const list = threads.filter(
    (th) =>
      inView(th, view) &&
      (network === 'all' || th.network === network) &&
      (!q || th.contactName.toLowerCase().includes(q) || th.contactHandle.toLowerCase().includes(q) || th.labels.some((l) => l.toLowerCase().includes(q)) || messages.some((m) => m.threadId === th.id && m.text.toLowerCase().includes(q))),
  );
  const counts = Object.fromEntries(VIEWS.map((v) => [v.id, threads.filter((th) => inView(th, v.id) && (network === 'all' || th.network === network)).length])) as Record<InboxView, number>;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ gap: 10, paddingHorizontal: 16, paddingTop: 12, flexShrink: 0 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flexGrow: 0 }}>
          <NetworkChip label="All" selected={network === 'all'} onPress={() => setNetwork('all')} count={stats.unread} />
          {connected.map((n) => (
            <NetworkChip key={n.id} network={n.id} label={n.label} selected={network === n.id} onPress={() => setNetwork(n.id)} count={stats.byNetwork[n.id]} />
          ))}
        </ScrollView>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <SearchBar value={query} onChangeText={setQuery} placeholder="Search names, labels and messages" />
          </View>
          <Pressable
            onPress={async () => {
              if (socialLive()) {
                const r = await syncSocialFromServer(account.id);
                if (r.ok) toast('Inbox up to date', 'checkmark-circle');
                else toastError(r.error);
                return;
              }
              const n = sync();
              toast(n ? 'New message arrived' : 'You’re up to date', n ? 'chatbubble-ellipses' : 'checkmark-circle');
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Check for new messages"
            style={({ pressed }) => [styles.iconBtn, { borderColor: t.c.border, opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="refresh" size={19} color={t.c.textStrong} />
          </Pressable>
        </View>
        <Text size={13} color={t.c.muted}>
          {stats.unanswered} waiting for a reply · {stats.avgResponseMins === null ? 'no replies yet' : `first reply in ${stats.avgResponseMins} min on average`}
        </Text>
      </View>
      <View style={{ flexShrink: 0 }}>
        <Segmented options={VIEWS} value={view} onChange={setView} counts={counts} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {list.length === 0 ? (
          <EmptyBlock
            icon={view === 'open' ? 'checkmark-done-outline' : 'chatbubbles-outline'}
            title={view === 'open' ? 'Inbox zero' : 'Nothing here'}
            message={connected.length ? (view === 'open' ? 'Every message and comment has an answer. New ones appear here as they arrive.' : 'Conversations you move here will show up in this list.') : 'Connect Facebook, Instagram, WhatsApp or TikTok to bring their messages here.'}
          />
        ) : (
          list.map((th) => {
            const last = lastOf.get(th.id);
            const active = th.id === selectedId;
            return (
              <Pressable
                key={th.id}
                onPress={() => onOpen(th.id)}
                accessibilityRole="button"
                accessibilityLabel={`${th.contactName}, ${NETWORK_BY_ID[th.network].label}${th.unread ? `, ${th.unread} unread` : ''}`}
                style={({ pressed }) => [styles.thread, { borderBottomColor: t.c.border, backgroundColor: active ? t.c.surfaceAlt : pressed ? t.c.surfaceAlt : 'transparent' }]}>
                <ContactAvatar name={th.contactName} network={th.network} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={styles.row}>
                    <Text size={15} weight={th.unread ? 'bold' : 'semibold'} color={t.c.textStrong} numberOfLines={1} style={{ flex: 1 }} raw>
                      {th.contactName}
                    </Text>
                    {th.starred && <Ionicons name="star" size={13} color={t.c.warning} />}
                    <Text size={12} color={th.unread ? t.c.primary : t.c.subtle}>
                      {timeAgo(th.lastAt)}
                    </Text>
                  </View>
                  <Text size={13} color={th.unread ? t.c.text : t.c.muted} numberOfLines={2} raw>
                    {th.kind === 'comment' ? `${tr('Comment')}: ` : ''}
                    {last?.direction === 'out' ? `${tr(last.auto ? 'Auto-reply' : 'You')}: ` : ''}
                    {last?.text ?? ''}
                  </Text>
                  {(th.labels.length > 0 || th.leadId || th.assignee || th.snoozedUntil) && (
                    <View style={styles.tags}>
                      {th.leadId && <LabelTag label="Lead" />}
                      {th.labels.slice(0, 3).map((l) => (
                        <LabelTag key={l} label={l} />
                      ))}
                      {th.assignee && (
                        <Text size={11} color={t.c.muted}>
                          → {th.assignee}
                        </Text>
                      )}
                      {th.snoozedUntil && (
                        <Text size={11} color={t.c.muted}>
                          Snoozed until {formatTime(th.snoozedUntil)}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
                {th.unread > 0 && (
                  <View style={[styles.unread, { backgroundColor: t.c.primary }]}>
                    <Text size={11} weight="bold" color={t.c.onPrimary}>
                      {th.unread}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

type SheetKind = 'labels' | 'assign' | 'lead' | 'snooze' | 'saved' | null;

/** One conversation: messages, reply window, suggested and saved replies, notes, labels, assignment, snooze and "create lead". */
export function SocialConversation({ threadId }: { threadId: string }) {
  const t = useRoleTheme();
  const tr = useT();
  const account = useAccount();
  const thread = useDb((s) => s.socialThreads.find((x) => x.id === threadId));
  const messages = useThreadMessages(threadId);
  const settings = useSocialWorkspace(account).settings;
  const leads = useDb((s) => s.leads);
  const markRead = useDb((s) => s.markSocialThreadRead);
  const reply = useDb((s) => s.sendSocialReply);
  const addNote = useDb((s) => s.addSocialNote);
  const setStatus = useDb((s) => s.setSocialThreadStatus);
  const star = useDb((s) => s.toggleSocialThreadStar);
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [sheet, setSheet] = useState<SheetKind>(null);
  const scroller = useRef<RNScrollView>(null);
  const ctx = useReplyContext(account, thread?.contactName ?? '');
  const nowMs = useNow();

  useEffect(() => {
    if (!thread?.unread) return;
    markRead(threadId);
    if (socialLive()) void triageSocialLive(threadId, { read: true });
  }, [threadId, thread?.unread, markRead]);

  if (!thread || thread.ownerId !== account.id) return <EmptyBlock icon="chatbubbles-outline" title="Conversation not found" message="It may have been removed, or it belongs to another business." />;

  const def = NETWORK_BY_ID[thread.network];
  const window = replyWindow(thread, nowMs);
  const lastIn = [...messages].reverse().find((m) => m.direction === 'in');
  const suggestions = lastIn && mode === 'reply' && window.state !== 'template' && window.state !== 'closed' ? suggestReplies(lastIn.text, ctx) : [];
  const lead = thread.leadId ? leads.find((l) => l.id === thread.leadId) : undefined;

  const send = async (template?: { id: string; body: string }) => {
    const text = template ? fillReply(template.body, ctx) : draft;
    if (mode === 'note' && !template) {
      if (!(await socialAct(account.id, () => addNote(threadId, text), () => noteSocialLive(threadId, text)))) setDraft('');
      return;
    }
    const error = await socialAct(account.id, () => reply(threadId, text, template ? { template: template.id } : undefined), () => sendSocialReplyLive(threadId, text, template?.id));
    if (!error) setDraft('');
  };
  const triage = (demo: () => string | null | void, patch: Parameters<typeof triageSocialLive>[1]) => socialAct(account.id, demo, () => triageSocialLive(threadId, patch));

  const actions: { icon: IconName; label: string; onPress: () => void; on?: boolean }[] = [
    { icon: thread.starred ? 'star' : 'star-outline', label: thread.starred ? 'Starred' : 'Star', onPress: () => triage(() => star(threadId), { starred: !thread.starred }), on: thread.starred },
    thread.status === 'done'
      ? { icon: 'refresh-outline', label: 'Reopen', onPress: () => triage(() => setStatus(threadId, 'open'), { status: 'open' }) }
      : { icon: 'checkmark-done-outline', label: 'Done', onPress: () => triage(() => setStatus(threadId, 'done'), { status: 'done', read: true }) },
    { icon: 'alarm-outline', label: 'Snooze', onPress: () => setSheet('snooze') },
    { icon: 'pricetag-outline', label: 'Labels', onPress: () => setSheet('labels') },
    { icon: 'person-add-outline', label: thread.assignee ?? 'Assign', onPress: () => setSheet('assign') },
    lead ? { icon: 'flash', label: 'Open lead', onPress: () => router.push({ pathname: '/business/lead/[id]', params: { id: lead.id } }), on: true } : { icon: 'flash-outline', label: 'Create lead', onPress: () => setSheet('lead') },
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.c.border }} contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 6 }}>
        {actions.map((a) => (
          <Pressable key={a.label} onPress={a.onPress} accessibilityRole="button" accessibilityLabel={a.label} style={({ pressed }) => [styles.action, { borderColor: a.on ? t.c.textStrong : t.c.border, opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name={a.icon} size={16} color={a.on ? t.c.textStrong : t.c.text} />
            <Text size={13} color={t.c.text} raw={a.label === thread.assignee}>
              {a.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <RNScrollView ref={scroller} onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })} contentContainerStyle={{ padding: 14, gap: 8 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.context, { borderColor: t.c.border }]}>
          <NetworkIcon network={thread.network} size={16} />
          <Text size={13} color={t.c.muted} style={{ flex: 1 }}>
            {thread.kind === 'comment' ? `Comment on your ${def.label} post` : `${def.label} message`} · {thread.contactHandle}
            {thread.contactPhone && !thread.contactHandle.replace(/D/g, '').endsWith(thread.contactPhone) ? ` · ${thread.contactPhone}` : ''}
          </Text>
        </View>
        {thread.kind === 'comment' && thread.postCaption && (
          <Text size={13} color={t.c.muted} numberOfLines={2} style={{ fontStyle: 'italic' }} raw>
            “{thread.postCaption}”
          </Text>
        )}
        {thread.labels.length > 0 && (
          <View style={styles.tags}>
            {thread.labels.map((l) => (
              <LabelTag key={l} label={l} />
            ))}
          </View>
        )}
        {messages.map((m) => {
          if (m.direction === 'note')
            return (
              <View key={m.id} style={[styles.note, { backgroundColor: t.c.surfaceAlt, borderLeftColor: t.c.warning }]}>
                <Text size={12} weight="semibold" color={t.c.warning}>
                  Internal note · {m.author ?? ''} · {timeAgo(m.at)}
                </Text>
                <Text size={14} color={t.c.text} raw>
                  {m.text}
                </Text>
              </View>
            );
          const mine = m.direction === 'out';
          return (
            <View key={m.id} style={[styles.bubble, mine ? { alignSelf: 'flex-end', backgroundColor: t.c.soft, borderColor: t.c.soft } : { alignSelf: 'flex-start', backgroundColor: t.c.surface, borderColor: t.c.border }]}>
              {m.template && (
                <Text size={11} weight="semibold" color={t.c.muted}>
                  WhatsApp template
                </Text>
              )}
              <Text size={15} color={t.c.textStrong} raw>
                {m.text}
              </Text>
              <View style={[styles.row, { alignSelf: 'flex-end', gap: 4 }]}>
                {m.auto && (
                  <Text size={11} color={t.c.muted}>
                    Auto-reply ·
                  </Text>
                )}
                <Text size={11} color={t.c.subtle}>
                  {whenLabel(m.at)}
                </Text>
                {mine && <DeliveryTicks status={m.status} />}
              </View>
            </View>
          );
        })}
      </RNScrollView>

      {window.message !== '' && (
        <View style={[styles.window, { backgroundColor: t.c.surfaceAlt, borderTopColor: t.c.border }]}>
          <Ionicons name={window.state === 'open' ? 'time-outline' : 'information-circle-outline'} size={16} color={window.state === 'closed' ? t.c.danger : t.c.warning} />
          <Text size={13} color={t.c.text} style={{ flex: 1 }}>
            {window.message}
          </Text>
        </View>
      )}

      {suggestions.length > 0 && !draft && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, gap: 8 }} keyboardShouldPersistTaps="handled">
          {suggestions.map((s) => (
            <Pressable key={s} onPress={() => setDraft(s)} accessibilityRole="button" accessibilityLabel={`Use reply: ${s}`} style={({ pressed }) => [styles.suggestion, { borderColor: t.c.border, backgroundColor: t.c.surface, opacity: pressed ? 0.6 : 1 }]}>
              <Text size={13} color={t.c.text} numberOfLines={2} raw>
                {s}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {window.state === 'template' && mode === 'reply' ? (
        <View style={[styles.composer, { borderTopColor: t.c.border, flexDirection: 'column', alignItems: 'stretch' }]}>
          <Text size={13} weight="medium" color={t.c.text}>
            Send an approved template
          </Text>
          {WHATSAPP_TEMPLATES.map((tpl) => (
            <Pressable key={tpl.id} onPress={() => send(tpl)} accessibilityRole="button" style={({ pressed }) => [styles.template, { borderColor: t.c.border, opacity: pressed ? 0.6 : 1 }]}>
              <Text size={14} weight="semibold" color={t.c.textStrong}>
                {tpl.title}
              </Text>
              <Text size={13} color={t.c.muted} raw>
                {fillReply(tpl.body, ctx)}
              </Text>
            </Pressable>
          ))}
          <KButton label="Write an internal note instead" variant="ghost" size="sm" onPress={() => setMode('note')} />
        </View>
      ) : (
        <View style={[styles.composer, { borderTopColor: t.c.border }]}>
          <Pressable onPress={() => setMode(mode === 'reply' ? 'note' : 'reply')} hitSlop={8} accessibilityRole="switch" accessibilityState={{ checked: mode === 'note' }} accessibilityLabel={mode === 'reply' ? 'Switch to internal note' : 'Switch to reply'} style={styles.modeBtn}>
            <Ionicons name={mode === 'reply' ? 'chatbubble-outline' : 'document-lock-outline'} size={20} color={mode === 'note' ? t.c.warning : t.c.muted} />
          </Pressable>
          <Pressable onPress={() => setSheet('saved')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Saved replies" style={styles.modeBtn}>
            <Ionicons name="bookmark-outline" size={20} color={t.c.muted} />
          </Pressable>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={tr(mode === 'note' ? 'Internal note, only your team sees it' : thread.kind === 'comment' ? 'Reply publicly to this comment' : `Reply on ${def.label}`)}
            placeholderTextColor={t.c.subtle}
            multiline
            style={[styles.input, { borderColor: mode === 'note' ? t.c.warning : t.c.border, color: t.c.textStrong, fontFamily: t.fonts.regular, backgroundColor: t.c.surface }, inputReset]}
          />
          <Pressable
            onPress={() => send()}
            disabled={!draft.trim() || window.state === 'closed'}
            accessibilityRole="button"
            accessibilityLabel={mode === 'note' ? 'Save note' : 'Send reply'}
            style={({ pressed }) => [styles.send, { backgroundColor: mode === 'note' ? t.c.warning : t.c.primary, opacity: !draft.trim() || window.state === 'closed' ? 0.4 : pressed ? 0.8 : 1 }]}>
            <Ionicons name={mode === 'note' ? 'checkmark' : 'send'} size={18} color={t.c.onPrimary} />
          </Pressable>
        </View>
      )}

      <SavedRepliesSheet visible={sheet === 'saved'} onClose={() => setSheet(null)} onPick={(text) => setDraft(fillReply(text, ctx))} replies={settings.savedReplies} />
      <LabelsSheet visible={sheet === 'labels'} onClose={() => setSheet(null)} thread={thread} />
      <AssignSheet visible={sheet === 'assign'} onClose={() => setSheet(null)} thread={thread} />
      <SnoozeSheet visible={sheet === 'snooze'} onClose={() => setSheet(null)} threadId={thread.id} />
      <LeadSheet visible={sheet === 'lead'} onClose={() => setSheet(null)} thread={thread} texts={messages.filter((m) => m.direction === 'in').map((m) => m.text)} />
    </View>
  );
}

function SavedRepliesSheet({ visible, onClose, onPick, replies }: { visible: boolean; onClose: () => void; onPick: (text: string) => void; replies: { id: string; title: string; text: string }[] }) {
  const t = useRoleTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title="Saved replies">
      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}>
        {replies.length === 0 && (
          <Text size={14} color={t.c.muted}>
            No saved replies yet. Add them in the Automation tab.
          </Text>
        )}
        {replies.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => {
              onPick(r.text);
              onClose();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.template, { borderColor: t.c.border, opacity: pressed ? 0.6 : 1 }]}>
            <Text size={14} weight="semibold" color={t.c.textStrong} raw>
              {r.title}
            </Text>
            <Text size={13} color={t.c.muted} numberOfLines={3} raw>
              {r.text}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </Sheet>
  );
}

function LabelsSheet({ visible, onClose, thread }: { visible: boolean; onClose: () => void; thread: SocialThread }) {
  const account = useAccount();
  const save = useDb((s) => s.setSocialThreadLabels);
  const setLabels = (id: string, labels: string[]) => socialAct(account.id, () => save(id, labels), () => triageSocialLive(id, { labels }));
  const [custom, setCustom] = useState('');
  const options = [...new Set([...SOCIAL_LABELS, ...thread.labels])];
  return (
    <Sheet visible={visible} onClose={onClose} title="Labels">
      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 14 }}>
        <ChoiceChips options={options} selected={thread.labels} onToggle={(l) => setLabels(thread.id, thread.labels.includes(l) ? thread.labels.filter((x) => x !== l) : [...thread.labels, l])} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <KField value={custom} onChangeText={setCustom} placeholder="New label" />
          </View>
          <KButton
            label="Add"
            size="sm"
            variant="secondary"
            disabled={!custom.trim()}
            onPress={() => {
              setLabels(thread.id, [...thread.labels, custom.trim()]);
              setCustom('');
            }}
          />
        </View>
      </View>
    </Sheet>
  );
}

function AssignSheet({ visible, onClose, thread }: { visible: boolean; onClose: () => void; thread: SocialThread }) {
  const t = useRoleTheme();
  const account = useAccount();
  const { staff } = useVendorWorkspace(account);
  const assign = useDb((s) => s.assignSocialThread);
  const people = [account.name, ...staff.filter((m) => m.active).map((m) => m.name)];
  return (
    <Sheet visible={visible} onClose={onClose} title="Assign to">
      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 4 }}>
        {[...new Set(people)].map((name) => (
          <Pressable
            key={name}
            onPress={() => {
              assign(thread.id, name);
              onClose();
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.pick, { opacity: pressed ? 0.6 : 1 }]}>
            <Text size={15} color={t.c.textStrong} style={{ flex: 1 }} raw>
              {name}
            </Text>
            {thread.assignee === name && <Ionicons name="checkmark" size={18} color={t.c.primary} />}
          </Pressable>
        ))}
        {thread.assignee && (
          <KButton
            label="Unassign"
            variant="ghost"
            onPress={() => {
              assign(thread.id, undefined);
              onClose();
            }}
          />
        )}
      </ScrollView>
    </Sheet>
  );
}

function SnoozeSheet({ visible, onClose, threadId }: { visible: boolean; onClose: () => void; threadId: string }) {
  const t = useRoleTheme();
  const account = useAccount();
  const setStatus = useDb((s) => s.setSocialThreadStatus);
  const options = [
    { label: 'For 3 hours', hours: () => 3 },
    { label: 'Until tomorrow morning', hours: hoursUntilMorning },
    { label: 'For a week', hours: () => 168 },
  ];
  return (
    <Sheet visible={visible} onClose={onClose} title="Snooze">
      <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 4 }}>
        <Text size={13} color={t.c.muted}>
          The conversation moves to Waiting and comes back to Open at that time, or sooner if the customer writes.
        </Text>
        {options.map((o) => (
          <Pressable
            key={o.label}
            onPress={async () => {
              const hours = o.hours();
              const until = new Date(Date.now() + hours * 3_600_000).toISOString();
              onClose();
              if (!(await socialAct(account.id, () => setStatus(threadId, 'pending', hours), () => triageSocialLive(threadId, { status: 'pending', snoozedUntil: until })))) toast('Snoozed', 'alarm');
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.pick, { opacity: pressed ? 0.6 : 1 }]}>
            <Ionicons name="alarm-outline" size={18} color={t.c.muted} />
            <Text size={15} color={t.c.textStrong}>
              {o.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

/** Hours from now until 9 am tomorrow. */
function hoursUntilMorning() {
  const morning = new Date();
  morning.setDate(morning.getDate() + 1);
  morning.setHours(9, 0, 0, 0);
  return Math.max(1, (morning.getTime() - Date.now()) / 3_600_000);
}

const FUNCTIONS = ['Wedding', 'Reception', 'Mehendi', 'Haldi', 'Engagement', 'Pasni', 'Bratabandha', 'Birthday'];

/** "Create lead": the details read from the conversation, ready to check and save to the leads CRM. */
function LeadSheet({ visible, onClose, thread, texts }: { visible: boolean; onClose: () => void; thread: SocialThread; texts: string[] }) {
  return (
    <Sheet visible={visible} onClose={onClose} title="Create lead">
      <LeadForm onClose={onClose} thread={thread} texts={texts} />
    </Sheet>
  );
}

/** Mounted only while the sheet is open, so it reads the conversation as it is now. */
function LeadForm({ onClose, thread, texts }: { onClose: () => void; thread: SocialThread; texts: string[] }) {
  const t = useRoleTheme();
  const create = useDb((s) => s.createLeadFromSocialThread);
  const hints = leadHints(texts, today());
  const [date, setDate] = useState<string | null>(hints.eventDate ?? null);
  const [guests, setGuests] = useState(hints.guests ? String(hints.guests) : '');
  const [budget, setBudget] = useState(hints.budget ? String(hints.budget) : '');
  const [phone, setPhone] = useState(hints.phone ?? thread.contactPhone ?? '');
  const [fns, setFns] = useState<string[]>(hints.functions.length ? hints.functions : ['Wedding']);
  const [pickDate, setPickDate] = useState(!hints.eventDate);
  const found = [hints.eventDate && 'date', hints.guests && 'guests', hints.budget && 'budget', hints.phone && 'phone', hints.functions.length && 'functions'].filter(Boolean);

  const save = async () => {
    const input = { eventDate: date ?? '', guests: Number(guests) || undefined, budget: parseMoney(budget) || undefined, phone: phone || undefined, functions: fns };
    const res = create(thread.id, input);
    if (res.error || !res.leadId) return;
    if (socialLive()) {
      const r = await leadSocialLive(thread.id, input);
      if (!r.ok) toastError(r.error);
    }
    onClose();
    toast(`Lead created for ${thread.contactName}`, 'flash');
    router.push({ pathname: '/business/lead/[id]', params: { id: res.leadId } });
  };

  return (
    <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 12 }}>
        <Text size={13} color={t.c.muted}>
          {found.length ? `Filled in from the conversation: ${found.join(', ')}. Check before saving.` : 'Nothing to fill in from the conversation yet. Add what you know.'}
        </Text>
        <View style={{ gap: 6 }}>
          <Text size={13} weight="medium" color={t.c.text}>
            Event date
          </Text>
          <Pressable onPress={() => setPickDate(!pickDate)} accessibilityRole="button" style={[styles.dateBtn, { borderColor: t.c.border }]}>
            <Ionicons name="calendar-outline" size={18} color={t.c.muted} />
            <Text size={15} color={date ? t.c.textStrong : t.c.subtle} style={{ flex: 1 }}>
              {date ? `${formatLongDate(date)} · ${formatDateAlt(date)}` : 'Pick a date'}
            </Text>
          </Pressable>
          {pickDate && (
            <Calendar
              value={date}
              onChange={(d) => {
                setDate(d);
                setPickDate(false);
              }}
            />
          )}
        </View>
        <ChoiceChips options={FUNCTIONS} selected={fns} onToggle={(f) => setFns(fns.includes(f) ? fns.filter((x) => x !== f) : [...fns, f])} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <KField label="Guests" value={guests} onChangeText={(v) => setGuests(v.replace(/\D/g, ''))} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <KField label="Budget" prefix="NPR" value={budget} onChangeText={setBudget} keyboardType="number-pad" />
          </View>
        </View>
        <KField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="98XXXXXXXX" />
        <KButton label="Create lead" icon="flash-outline" disabled={!date || fns.length === 0} onPress={save} />
    </ScrollView>
  );
}

/** Opens a thread: in the side pane on wide screens, as its own screen on phones. */
export const openThreadRoute = (id: string) => router.push({ pathname: '/business/social/thread/[id]', params: { id } });

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 2 },
  iconBtn: { width: 44, height: 44, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  thread: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  unread: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginTop: 2 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  context: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 8 },
  bubble: { maxWidth: '84%', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, gap: 4 },
  note: { borderLeftWidth: 3, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  window: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth },
  suggestion: { maxWidth: 260, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, padding: 10, borderTopWidth: StyleSheet.hairlineWidth },
  modeBtn: { width: 34, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minHeight: 44, maxHeight: 140, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  template: { borderWidth: 1, borderRadius: 8, padding: 10, gap: 2 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  dateBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, height: 46 },
});

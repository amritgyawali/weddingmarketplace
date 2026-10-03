import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BarChart, Card, KButton, KField, KpiCard, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast } from '@/components/ui/Toast';
import { NETWORKS, SCOPE_TEXT } from '@/data/social';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { useLayout } from '@/hooks/useLayout';
import { formatCount, inboxStats, postStats } from '@/services/social';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { SocialAutoRule, SocialNetwork, SocialSettings } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { daysUntil, formatShortDate, timeAgo, toISODate, uid } from '@/utils/format';

import { disconnectSocialLive, saveSocialSettingsLive, socialLive, startSocialConnect } from '@/backend/social';

import { ConnectSheet } from './ConnectSheet';
import { socialAct } from './live';
import { NetworkChip, NetworkIcon, useSocialWorkspace } from './parts';
import { PostCard } from './Posts';

/** The four networks: connected or not, followers, when access needs renewing, permissions, connect and disconnect. */
export function SocialAccounts() {
  const t = useRoleTheme();
  const account = useAccount();
  const { columns } = useLayout();
  const { accounts } = useSocialWorkspace(account);
  const disconnect = useDb((s) => s.disconnectSocialAccount);
  const reconnect = useDb((s) => s.reconnectSocialAccount);
  const [connecting, setConnecting] = useState<SocialNetwork | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text size={14} color={t.c.muted}>
        Connect once. Messages and comments arrive in the inbox, and posts go out from here.
      </Text>
      <View style={[styles.grid, { flexDirection: columns > 1 ? 'row' : 'column' }]}>
        {NETWORKS.map((def) => {
          const a = accounts.find((x) => x.network === def.id && x.status !== 'disconnected');
          const expiresIn = a?.expiresAt ? daysUntil(toISODate(new Date(a.expiresAt))) : null;
          return (
            <Card key={def.id} style={[{ gap: 10 }, columns > 1 && { width: '48.5%' }]}>
              <View style={styles.row}>
                <NetworkIcon network={def.id} size={26} />
                <View style={{ flex: 1 }}>
                  <Text size={16} weight="semibold" color={t.c.textStrong}>
                    {def.label}
                  </Text>
                  <Text size={13} color={t.c.muted} numberOfLines={1} raw={!!a}>
                    {a ? a.handle : def.requirement}
                  </Text>
                </View>
                <StatusPill status={a ? (a.status === 'expired' ? 'failed' : 'confirmed') : 'draft'} label={a ? (a.status === 'expired' ? 'Access expired' : 'Connected') : 'Not connected'} />
              </View>

              {a ? (
                <>
                  <View style={styles.stats}>
                    <View style={{ flex: 1 }}>
                      <Text size={12} color={t.c.muted}>
                        {def.id === 'whatsapp' ? 'Opted-in customers' : 'Followers'}
                      </Text>
                      <Text serif size={18} weight="semibold" color={t.c.textStrong}>
                        {formatCount(a.followers)}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text size={12} color={t.c.muted}>
                        Last checked
                      </Text>
                      <Text size={14} color={t.c.textStrong}>
                        {a.lastSyncAt ? timeAgo(a.lastSyncAt) : 'Never'}
                      </Text>
                    </View>
                  </View>
                  {a.status === 'expired' ? (
                    <Text size={13} color={t.c.danger}>
                      {def.label} access has expired. Replies and posts stop until you reconnect.
                    </Text>
                  ) : expiresIn !== null ? (
                    <Text size={12} color={expiresIn <= 7 ? t.c.warning : t.c.muted}>
                      Access renews by {formatShortDate(toISODate(new Date(a.expiresAt!)))}
                      {expiresIn <= 7 ? '. Reconnect this week.' : ''}
                    </Text>
                  ) : null}
                  {open === a.id && (
                    <View style={{ gap: 4 }}>
                      {a.scopes.map((s) => (
                        <View key={s} style={styles.row}>
                          <Ionicons name="checkmark" size={14} color={t.c.success} />
                          <Text size={13} color={t.c.text}>
                            {SCOPE_TEXT[s] ?? s}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={[styles.row, { flexWrap: 'wrap' }]}>
                    {(a.status === 'expired' || (expiresIn !== null && expiresIn <= 7)) && <KButton label="Reconnect" size="sm" icon="refresh-outline" onPress={() => (socialLive() ? void startSocialConnect(a.network) : reconnect(a.id))} />}
                    <KButton label={open === a.id ? 'Hide permissions' : 'Permissions'} size="sm" variant="secondary" onPress={() => setOpen(open === a.id ? null : a.id)} />
                    <KButton label="Disconnect" size="sm" variant="ghost" onPress={() => confirm(`Disconnect ${def.label}?`, 'Its messages stay in the inbox, but replies and posts to it stop until you connect again.', 'Disconnect', () => void socialAct(account.id, () => disconnect(a.id), () => disconnectSocialLive(a.id)))} />
                  </View>
                </>
              ) : (
                <>
                  <Text size={13} color={t.c.text}>
                    {def.inbox.includes('message') && def.inbox.includes('comment') ? 'Messages and comments' : def.inbox.includes('message') ? 'Messages' : 'Comments'} in your inbox · {def.postAs.toLowerCase()}
                  </Text>
                  <KButton label={`Connect ${def.label}`} icon="link-outline" onPress={() => setConnecting(def.id)} />
                </>
              )}
            </Card>
          );
        })}
      </View>
      <ConnectSheet network={connecting} onClose={() => setConnecting(null)} />
    </View>
  );
}

/** Reach, engagement, replies and leads across the networks. */
export function SocialInsights() {
  const t = useRoleTheme();
  const account = useAccount();
  const { columns } = useLayout();
  const { accounts, threads, messages, posts, settings } = useSocialWorkspace(account);
  const { leads } = useVendorWorkspace(account);
  const ps = postStats(posts);
  const is = inboxStats(threads, messages);
  const followers = accounts.filter((a) => a.status !== 'disconnected').reduce((s, a) => s + a.followers, 0);
  const keywordReplies = settings.rules.reduce((sum, r) => sum + r.hits, 0);
  const socialLeads = leads.filter((l) => l.source === 'social');
  const won = socialLeads.filter((l) => l.status === 'won').length;
  const kpiWidth = { minWidth: columns > 1 ? '22%' : '46%' } as const;
  const connected = NETWORKS.filter((n) => accounts.some((a) => a.network === n.id && a.status !== 'disconnected'));

  return (
    <View style={{ padding: 16, gap: 16 }}>
      <View style={styles.kpis}>
        <KpiCard label="Audience" value={formatCount(followers)} icon="people-outline" style={kpiWidth} />
        <KpiCard label="Reached by posts" value={formatCount(ps.reach)} icon="eye-outline" style={kpiWidth} />
        <KpiCard label="Engagement rate" value={`${(ps.rate * 100).toFixed(1)}%`} icon="heart-outline" style={kpiWidth} />
        <KpiCard label="Waiting for reply" value={String(is.unanswered)} icon="chatbubbles-outline" tone={is.unanswered > 0 ? t.c.danger : undefined} style={kpiWidth} />
        <KpiCard label="First reply" value={is.avgResponseMins === null ? '—' : `${is.avgResponseMins} min`} icon="time-outline" style={kpiWidth} />
        <KpiCard label="Leads from social" value={String(socialLeads.length)} icon="flash-outline" delta={won ? `${won} won` : undefined} style={kpiWidth} onPress={() => router.navigate('/business/leads')} />
        <KpiCard label="Keyword replies sent" value={String(keywordReplies)} icon="flash-outline" style={kpiWidth} />
        <KpiCard label="Posts published" value={String(ps.published)} icon="images-outline" delta={ps.scheduled ? `${ps.scheduled} scheduled` : undefined} style={kpiWidth} />
      </View>

      {connected.length > 0 && (
        <Card style={{ gap: 12 }}>
          <SectionTitle title="Reach by network" />
          <BarChart data={connected.map((n) => ({ label: n.label, value: ps.byNetwork[n.id].reach }))} format={formatCount} />
          {connected.map((n) => {
            const b = ps.byNetwork[n.id];
            return (
              <View key={n.id} style={styles.row}>
                <NetworkIcon network={n.id} size={16} />
                <Text size={13} color={t.c.text} style={{ flex: 1 }}>
                  {n.label}
                </Text>
                <Text size={13} color={t.c.muted}>
                  {b.posts} posts · {b.reach ? ((b.engagement / b.reach) * 100).toFixed(1) : '0.0'}% engagement
                </Text>
              </View>
            );
          })}
        </Card>
      )}

      {ps.top && (
        <View>
          <SectionTitle title="Best post so far" />
          <PostCard post={ps.top} />
        </View>
      )}

      <Card style={{ gap: 6 }}>
        <SectionTitle title="Auto-replies" />
        {settings.rules.length === 0 ? (
          <Text size={14} color={t.c.muted}>
            No keyword rules yet.
          </Text>
        ) : (
          settings.rules.map((r) => (
            <View key={r.id} style={styles.row}>
              <Text size={13} color={t.c.text} style={{ flex: 1 }} numberOfLines={1} raw>
                {r.keywords.join(', ')}
              </Text>
              <Text size={13} color={t.c.muted}>
                {r.active ? `${r.hits} sent` : 'Off'}
              </Text>
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

/** Away message, signature, keyword auto-replies and saved replies. */
export function SocialAutomation() {
  const t = useRoleTheme();
  const account = useAccount();
  const { settings, accounts } = useSocialWorkspace(account);
  const save = useDb((s) => s.updateSocialSettings);
  const [away, setAway] = useState(settings.away);
  const [signature, setSignature] = useState(settings.signature ?? '');
  const [rules, setRules] = useState<SocialAutoRule[]>(settings.rules);
  const [saved, setSaved] = useState(settings.savedReplies);
  const connected = NETWORKS.filter((n) => accounts.some((a) => a.network === n.id && a.status !== 'disconnected'));

  const commit = async (patch: Partial<SocialSettings>, message: string) => {
    const next: SocialSettings = { savedReplies: saved, rules, away, signature: signature.trim() || undefined, ...patch };
    if (!(await socialAct(account.id, () => save(patch), () => saveSocialSettingsLive(next)))) toast(message, 'checkmark-circle');
  };
  const setRule = (id: string, patch: Partial<SocialAutoRule>) => setRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const setReply = (id: string, patch: Partial<SocialSettings['savedReplies'][number]>) => setSaved(saved.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <View style={{ padding: 16, gap: 16 }}>
      <Card style={{ gap: 12 }}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text size={15} weight="semibold" color={t.c.textStrong}>
              Away message
            </Text>
            <Text size={12} color={t.c.muted}>
              Sent once to a new message outside your hours
            </Text>
          </View>
          <Toggle value={away.active} onValueChange={(v) => setAway({ ...away, active: v })} accessibilityLabel="Away message" />
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <KField label="Away from" value={away.from} onChangeText={(v) => setAway({ ...away, from: v })} placeholder="21:00" maxLength={5} />
          </View>
          <View style={{ flex: 1 }}>
            <KField label="Back at" value={away.to} onChangeText={(v) => setAway({ ...away, to: v })} placeholder="08:00" maxLength={5} />
          </View>
        </View>
        <KField label="Message" value={away.text} onChangeText={(v) => setAway({ ...away, text: v })} multiline />
        <KField label="Signature under replies" value={signature} onChangeText={setSignature} placeholder="— Rajesh, Everest Grand" hint="Added to message replies, not to public comment replies" />
        <KButton label="Save away message" variant="secondary" onPress={() => commit({ away, signature }, 'Away message saved')} />
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle title="Keyword auto-replies" action="Add rule" onAction={() => setRules([...rules, { id: uid('ar'), keywords: [], reply: '', networks: [], active: true, hits: 0 }])} />
        <Text size={12} color={t.c.muted}>
          When a message or comment contains a keyword, this reply goes out at once. Use {'{price}'}, {'{city}'} and {'{business}'} to fill in your details.
        </Text>
        {rules.map((r, i) => (
          <View key={r.id} style={[styles.rule, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <KField label="Keywords, comma separated" value={r.keywords.join(', ')} onChangeText={(v) => setRule(r.id, { keywords: v.split(',').map((k) => k.trimStart()) })} placeholder="price, rate, kati" autoCapitalize="none" />
              </View>
              <Toggle value={r.active} onValueChange={(v) => setRule(r.id, { active: v })} accessibilityLabel="Rule on" />
            </View>
            <KField label="Reply" value={r.reply} onChangeText={(v) => setRule(r.id, { reply: v })} multiline />
            <View style={[styles.row, { flexWrap: 'wrap' }]}>
              {connected.map((n) => (
                <NetworkChip
                  key={n.id}
                  network={n.id}
                  label={n.label}
                  selected={r.networks.length === 0 || r.networks.includes(n.id)}
                  onPress={() => {
                    const all = r.networks.length === 0 ? connected.map((x) => x.id) : r.networks;
                    const next = all.includes(n.id) ? all.filter((x) => x !== n.id) : [...all, n.id];
                    setRule(r.id, { networks: next.length === connected.length ? [] : next });
                  }}
                />
              ))}
            </View>
            <View style={styles.row}>
              <Text size={12} color={t.c.muted} style={{ flex: 1 }}>
                {r.hits} sent so far
              </Text>
              <KButton label="Remove" size="sm" variant="ghost" icon="trash-outline" onPress={() => setRules(rules.filter((x) => x.id !== r.id))} />
            </View>
          </View>
        ))}
        <KButton label="Save auto-replies" variant="secondary" onPress={() => commit({ rules: rules.map((r) => ({ ...r, keywords: r.keywords.map((k) => k.trim()).filter(Boolean) })) }, 'Auto-replies saved')} />
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle title="Saved replies" action="Add" onAction={() => setSaved([...saved, { id: uid('sr'), title: '', text: '' }])} />
        {saved.map((r, i) => (
          <View key={r.id} style={[styles.rule, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.c.border }]}>
            <KField label="Title" value={r.title} onChangeText={(v) => setReply(r.id, { title: v })} placeholder="Price list" />
            <KField label="Text" value={r.text} onChangeText={(v) => setReply(r.id, { text: v })} multiline />
            <KButton label="Remove" size="sm" variant="ghost" icon="trash-outline" onPress={() => setSaved(saved.filter((x) => x.id !== r.id))} style={{ alignSelf: 'flex-end' }} />
          </View>
        ))}
        <KButton label="Save replies" variant="secondary" onPress={() => commit({ savedReplies: saved.map((r) => ({ ...r, title: r.title.trim() || r.text.slice(0, 24) })) }, 'Saved replies updated')} />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  grid: { flexWrap: 'wrap', gap: 12 },
  stats: { flexDirection: 'row', gap: 12 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  rule: { gap: 10, paddingTop: 12 },
});

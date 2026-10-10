import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Card, ChoiceChips, EmptyBlock, KButton, KField, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { RISK_ICONS, type RiskFlag } from '@/services/risk';
import { useDb, useThreads } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { FileRef, Project } from '@/types/platform';
import { formatShortDate, timeAgo } from '@/utils/format';

// Internal notes (staff only)
export function NotesPanel({ project }: { project: Project }) {
  const t = useRoleTheme();
  const account = useAccount();
  const all = useDb((s) => s.notes);
  const addNote = useDb((s) => s.addNote);
  const togglePin = useDb((s) => s.toggleNotePin);
  const deleteNote = useDb((s) => s.deleteNote);
  const [text, setText] = useState('');
  const notes = all.filter((n) => n.projectId === project.id).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at.localeCompare(a.at));

  return (
    <View style={{ gap: 10 }}>
      <View style={[styles.banner, { backgroundColor: `${t.c.warning}1A` }]}>
        <Ionicons name="lock-closed" size={14} color={t.c.warning} />
        <Text size={12} color={t.c.text} style={{ flex: 1 }}>
          Private internal notes — never shown to the customer or providers.
        </Text>
      </View>
      <KField placeholder="e.g. Customer is price sensitive on catering" value={text} onChangeText={setText} multiline maxLength={500} />
      <KButton
        label="Add note"
        size="sm"
        missing={!text.trim() && 'Write the note first'}
        onPress={() => {
          addNote(project.id, { id: account.id, name: account.name }, text);
          setText('');
        }}
      />
      {notes.map((n) => (
        <Card key={n.id} style={{ gap: 6, borderColor: n.pinned ? t.c.warning : t.c.border }}>
          <Text size={14} color={t.c.textStrong} lineHeight={20}>
            {n.text}
          </Text>
          <View style={styles.rowBetween}>
            <Text size={11} color={t.c.muted}>
              {n.authorName} · {timeAgo(n.at)}
            </Text>
            <View style={styles.inline}>
              <Pressable onPress={() => togglePin(n.id)} hitSlop={8} accessibilityLabel={n.pinned ? 'Unpin' : 'Pin'}>
                <Ionicons name={n.pinned ? 'pin' : 'pin-outline'} size={16} color={n.pinned ? t.c.warning : t.c.muted} />
              </Pressable>
              {n.authorId === account.id && (
                <Pressable onPress={() => deleteNote(n.id)} hitSlop={8} accessibilityLabel="Delete note">
                  <Ionicons name="trash-outline" size={16} color={t.c.muted} />
                </Pressable>
              )}
            </View>
          </View>
        </Card>
      ))}
    </View>
  );
}

// Files (Drive-style project folders)
export const PROJECT_FOLDERS = ['01-Contract', '02-Photography', '03-Video', '04-Decoration', '05-Quotation', '06-Invoices', '07-Final-Delivery'];

const FILE_ICON: Record<FileRef['kind'], string> = { pdf: 'document-text', image: 'image', video: 'videocam', doc: 'document', link: 'link' };

export function FilesPanel({ project, mode }: { project: Project; mode: 'customer' | 'platform' | 'vendor' }) {
  const t = useRoleTheme();
  const account = useAccount();
  const all = useDb((s) => s.files);
  const addFile = useDb((s) => s.addFile);
  const removeFile = useDb((s) => s.removeFile);
  const [folder, setFolder] = useState<string>('All');
  const [link, setLink] = useState('');
  const files = all.filter((f) => f.projectId === project.id && (mode === 'platform' || f.visibility === 'customer' || (mode === 'vendor' && f.visibility === 'provider')));
  const folders = ['All', ...PROJECT_FOLDERS, ...(mode === 'platform' ? ['00-Internal'] : [])];
  const list = files.filter((f) => folder === 'All' || f.folder === folder);
  const target = folder === 'All' ? '02-Photography' : folder;

  const upload = async (kind: 'image' | 'doc') => {
    if (kind === 'image') {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.7 });
      if (res.canceled || !res.assets[0]) return;
      const a = res.assets[0];
      addFile({ projectId: project.id, folder: target, name: a.fileName ?? `Photo ${formatShortDate(new Date().toISOString())}`, kind: a.type === 'video' ? 'video' : 'image', uri: a.uri, size: a.fileSize, storage: 'cloudinary', visibility: folder === '00-Internal' ? 'internal' : 'customer', uploadedBy: account.name });
    } else {
      const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const a = res.assets[0];
      addFile({ projectId: project.id, folder: target, name: a.name, kind: a.mimeType?.includes('pdf') ? 'pdf' : 'doc', uri: a.uri, size: a.size, storage: 'drive', visibility: folder === '00-Internal' ? 'internal' : 'customer', uploadedBy: account.name });
    }
    toast(`Uploaded to ${target}`, 'cloud-upload');
  };

  return (
    <View style={{ gap: 12 }}>
      {!!project.driveFolder && (
        <View style={[styles.banner, { backgroundColor: t.c.soft }]}>
          <Ionicons name="logo-google" size={14} color={t.c.primary} />
          <Text size={12} color={t.c.text} style={{ flex: 1 }}>
            Synced folder: {project.driveFolder}
          </Text>
        </View>
      )}
      <ChoiceChips options={folders} selected={[folder]} onToggle={setFolder} />
      <View style={styles.inline}>
        <KButton label="Photo / video" icon="image-outline" size="sm" variant="secondary" onPress={() => upload('image')} style={{ flex: 1 }} />
        <KButton label="Document" icon="document-attach-outline" size="sm" variant="secondary" onPress={() => upload('doc')} style={{ flex: 1 }} />
      </View>
      <View style={styles.inline}>
        <View style={{ flex: 1 }}>
          <KField placeholder="Paste a Google Drive / WeTransfer link" value={link} onChangeText={setLink} autoCapitalize="none" />
        </View>
        <KButton
          label="Add"
          size="sm"
          missing={!/^https?:\/\//.test(link.trim()) && (link.trim() ? 'Links start with https://' : 'Paste the link first')}
          onPress={() => {
            addFile({ projectId: project.id, folder: target, name: link.trim().replace(/^https?:\/\//, '').slice(0, 40), kind: 'link', uri: link.trim(), storage: 'link', visibility: 'customer', uploadedBy: account.name });
            setLink('');
          }}
        />
      </View>
      {!list.length && <EmptyBlock icon="folder-open-outline" title="No files here yet" message="Contracts, quotations, receipts and deliveries are filed automatically." />}
      {list.map((f) => (
        <Pressable key={f.id} onPress={() => f.uri && Linking.openURL(f.uri)} style={({ pressed }) => [styles.file, { borderColor: t.c.border, backgroundColor: t.c.surface, opacity: pressed ? 0.8 : 1 }]}>
          <View style={[styles.fileIcon, { borderWidth: 1, borderColor: t.c.border }]}>
            <Ionicons name={FILE_ICON[f.kind] as never} size={18} color={t.c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text size={14} weight="semibold" color={t.c.textStrong} numberOfLines={1}>
              {f.name}
            </Text>
            <Text size={11} color={t.c.muted}>
              {f.folder} · {f.uploadedBy} · {timeAgo(f.at)}
              {f.size ? ` · ${Math.round(f.size / 1024)} KB` : ''}
            </Text>
          </View>
          {f.visibility === 'internal' && <StatusPill status="pending" label="Internal" />}
          {(mode === 'platform' || f.uploadedBy === account.name) && (
            <Pressable onPress={() => removeFile(f.id)} hitSlop={8} accessibilityLabel="Remove file">
              <Ionicons name="close" size={18} color={t.c.muted} />
            </Pressable>
          )}
        </Pressable>
      ))}
    </View>
  );
}

// Risk list
export function RiskList({ risks, onPress, limit }: { risks: RiskFlag[]; onPress?: (r: RiskFlag) => void; limit?: number }) {
  const t = useRoleTheme();
  if (!risks.length) {
    return (
      <View style={[styles.banner, { backgroundColor: `${t.c.success}1A` }]}>
        <Ionicons name="shield-checkmark" size={16} color={t.c.success} />
        <Text size={13} color={t.c.text}>
          No risks detected
        </Text>
      </View>
    );
  }
  return (
    <View style={{ gap: 6 }}>
      {risks.slice(0, limit).map((r) => {
        const color = r.severity === 'high' ? t.c.danger : r.severity === 'medium' ? t.c.warning : t.c.info;
        return (
          <Pressable key={r.id} disabled={!onPress} onPress={() => onPress?.(r)} style={({ pressed }) => [styles.risk, { borderLeftColor: color, backgroundColor: t.c.surface, borderColor: t.c.border, opacity: pressed ? 0.8 : 1 }]}>
            <Ionicons name={RISK_ICONS[r.kind] as never} size={18} color={color} />
            <View style={{ flex: 1 }}>
              <Text size={13} weight="semibold" color={t.c.textStrong}>
                {r.message}
              </Text>
              <Text size={12} color={t.c.muted}>
                {r.projectCode} · {r.severity}
              </Text>
            </View>
            {onPress && <Ionicons name="chevron-forward" size={16} color={t.c.subtle} />}
          </Pressable>
        );
      })}
      {limit && risks.length > limit && (
        <Text size={12} color={t.c.muted}>
          +{risks.length - limit} more
        </Text>
      )}
    </View>
  );
}

// Inbox list
export function InboxList({ basePath }: { basePath: '/inbox' | '/business/inbox' | '/freelancer/inbox' | '/platform/inbox' }) {
  const t = useRoleTheme();
  const account = useAccount();
  const threads = useThreads(account);
  const [filter, setFilter] = useState<'all' | 'unread' | 'archived'>('all');
  const [query, setQuery] = useState('');
  const messages = useDb((s) => s.messages);
  const q = query.trim().toLowerCase();
  const list = threads.filter(({ thread, unread }) => {
    const archived = thread.archivedBy.includes(account.id);
    if (filter === 'archived' ? !archived : archived) return false;
    if (filter === 'unread' && !unread) return false;
    if (!q) return true;
    return thread.title.toLowerCase().includes(q) || messages.some((m) => m.threadId === thread.id && m.text.toLowerCase().includes(q));
  });

  return (
    <View style={{ gap: 10 }}>
      <KField placeholder="Search conversations and messages" value={query} onChangeText={setQuery} />
      <ChoiceChips options={['All', 'Unread', 'Archived']} selected={[filter.charAt(0).toUpperCase() + filter.slice(1)]} onToggle={(v) => setFilter(v.toLowerCase() as typeof filter)} />
      {!list.length && <EmptyBlock icon="chatbubbles-outline" title="No conversations" message="Project, service and enquiry chats appear here." />}
      {list.map(({ thread, last, unread }) => (
        <Card key={thread.id} onPress={() => router.push(`${basePath}/${thread.id}` as Href)} style={[styles.threadRow, unread > 0 && { borderLeftColor: t.c.primary, borderLeftWidth: 3 }]}>
          <Avatar name={thread.title.replace(/[^\p{L}\s]/gu, ' ')} size={44} />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.rowBetween}>
              <Text size={15} weight={unread ? 'bold' : 'medium'} color={t.c.textStrong} numberOfLines={1} style={{ flex: 1 }}>
                {thread.title}
              </Text>
              <Text size={11} color={t.c.muted}>
                {timeAgo(thread.lastAt)}
              </Text>
            </View>
            <Text size={13} color={unread ? t.c.textStrong : t.c.muted} numberOfLines={1}>
              {last ? `${last.senderId === account.id ? 'You: ' : ''}${last.kind === 'text' ? last.text : `[${last.kind}] ${last.text}`}` : thread.kind === 'project' ? 'Project team chat' : 'No messages yet'}
            </Text>
            <Text size={12} weight="medium" color={t.c.muted}>
              {thread.kind}
              {thread.mutedBy.includes(account.id) ? ' · muted' : ''}
            </Text>
          </View>
          {unread > 0 && (
            <View style={[styles.badge, { backgroundColor: t.c.primary }]}>
              <Text size={11} weight="bold" color={t.c.onPrimary}>
                {unread}
              </Text>
            </View>
          )}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  file: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 8, padding: 10 },
  fileIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  risk: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderLeftWidth: 4, borderRadius: 10, padding: 10 },
  threadRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});

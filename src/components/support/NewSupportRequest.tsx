import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, KButton, KField, SectionTitle, StackHeader } from '@/components/kit';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';
import { Text } from '@/components/ui/Text';
import { toastError } from '@/components/ui/Toast';
import { SUPPORT_LIMITS, SUPPORT_PRIORITIES, SUPPORT_TOPICS, supportHref } from '@/data/support';
import { useFormCheck } from '@/hooks/useFormCheck';
import { useLayout } from '@/hooks/useLayout';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { useDraft } from '@/store/drafts';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { SupportPriority, SupportTopic } from '@/types/platform';

type IconName = keyof typeof Ionicons.glyphMap;

/** "Ask the team": what it is about, a subject, the details and how soon. The draft is kept on the device until it is sent. */
export function NewSupportRequest() {
  const t = useRoleTheme();
  const account = useAccount();
  const { wide } = useLayout();
  const params = useLocalSearchParams<{ topic?: string }>();
  const initialTopic = SUPPORT_TOPICS.some((x) => x.id === params.topic) ? (params.topic as SupportTopic) : null;
  const { projects } = useCustomerWorkspace(account.id);
  const celebrations = account.role === 'customer' ? projects.filter((p) => p.status !== 'CANCELLED') : [];
  const open = useDb((s) => s.openSupportTicket);
  const [topic, setTopic] = useDraft<SupportTopic | null>(`support:${account.id}:topic`, initialTopic);
  const [subject, setSubject, clearSubject] = useDraft(`support:${account.id}:subject`, '');
  const [body, setBody, clearBody] = useDraft(`support:${account.id}:body`, '');
  const [priority, setPriority] = useState<SupportPriority>('normal');
  const [projectId, setProjectId] = useState<string | null>(celebrations[0]?.id ?? null);
  const [busy, setBusy] = useState(false);
  const check = useFormCheck({
    topic: !topic && 'Pick what it is about',
    subject: subject.trim().length < SUPPORT_LIMITS.subjectMin && 'Add a short subject',
    body: body.trim().length < SUPPORT_LIMITS.bodyMin && `Tell us a little more (at least ${SUPPORT_LIMITS.bodyMin} characters)`,
  });

  const send = () => {
    if (!topic) return;
    setBusy(true);
    const res = open({ topic, subject, body, priority, projectId: projectId ?? undefined });
    setBusy(false);
    if (res.error || !res.id) {
      toastError(res.error ?? 'Could not send. Try again.');
      return;
    }
    clearSubject();
    clearBody();
    setTopic(null);
    router.replace(supportHref(account.role, res.id) as Href);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Ask the team" subtitle="A real person replies, 9am to 7pm" />
      <ScrollView contentContainerStyle={[styles.body, wide && styles.bodyWide]} keyboardShouldPersistTaps="handled">
        <SectionTitle title="What is it about?" />
        <View style={styles.topics} accessibilityRole="radiogroup">
          {SUPPORT_TOPICS.map((x) => {
            const on = topic === x.id;
            return (
              <Pressable
                key={x.id}
                onPress={() => setTopic(x.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={({ pressed }) => [styles.topic, { borderColor: on ? t.c.primary : check.error('topic') ? t.c.danger : t.c.border, backgroundColor: on ? t.c.soft : t.c.surface }, on && { borderWidth: 2, padding: 11 }, pressed && { opacity: 0.8 }]}>
                <Ionicons name={x.icon as IconName} size={20} color={on ? t.c.primary : t.c.muted} />
                <View style={{ flex: 1 }}>
                  <Text size={14} weight="semibold" color={t.c.textStrong} numberOfLines={1}>
                    {x.label}
                  </Text>
                  <Text size={12} color={t.c.muted} numberOfLines={1}>
                    {x.hint}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        {!!check.error('topic') && (
          <Text size={12} color={t.c.danger}>
            {check.error('topic')}
          </Text>
        )}

        {celebrations.length > 0 && (
          <>
            <SectionTitle title="Which celebration?" />
            <View style={styles.chips}>
              {celebrations.map((p) => {
                const on = projectId === p.id;
                return (
                  <Pressable key={p.id} onPress={() => setProjectId(on ? null : p.id)} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[styles.chip, { borderColor: on ? t.c.primary : t.c.borderStrong, backgroundColor: on ? t.c.soft : t.c.surface }]}>
                    <Text size={13} weight={on ? 'semibold' : 'regular'} color={on ? t.c.primary : t.c.text} raw>
                      {p.title} · {p.code}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        <Card style={{ gap: 14 }}>
          <KField label="Subject" value={subject} onChangeText={setSubject} placeholder="For example: change the reception menu" maxLength={SUPPORT_LIMITS.subjectMax} error={check.error('subject')} required />
          <KField
            label="Details"
            value={body}
            onChangeText={setBody}
            placeholder="What happened, and what would you like us to do? Dates, names and amounts help."
            multiline
            minLength={SUPPORT_LIMITS.bodyMin}
            maxLength={SUPPORT_LIMITS.bodyMax}
            error={check.error('body')}
            required
          />
        </Card>

        <SectionTitle title="How soon do you need an answer?" />
        <View style={styles.priorities} accessibilityRole="radiogroup">
          {SUPPORT_PRIORITIES.map((p) => {
            const on = priority === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPriority(p.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={[styles.priority, { borderColor: on ? (p.id === 'urgent' ? t.c.danger : t.c.primary) : t.c.border, backgroundColor: t.c.surface }, on && { borderWidth: 2, padding: 9 }]}>
                <Text size={14} weight="semibold" color={on && p.id === 'urgent' ? t.c.danger : t.c.textStrong}>
                  {p.label}
                </Text>
                <Text size={12} color={t.c.muted}>
                  {p.hint}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <KButton label="Send to the team" icon="send" size="lg" loading={busy} missing={check.missing} onMissing={check.reveal} onPress={send} />
        <Text size={12} color={t.c.muted} align="center">
          You’ll get a notification when we reply. Your draft is kept on this phone until you send it.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14, paddingBottom: 60 },
  bodyWide: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingTop: 24 },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topic: { flexDirection: 'row', alignItems: 'center', gap: 10, flexGrow: 1, flexBasis: '45%', minWidth: 150, borderWidth: 1, borderRadius: 10, padding: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 7 },
  priorities: { flexDirection: 'row', gap: 8 },
  priority: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 10, gap: 2 },
});

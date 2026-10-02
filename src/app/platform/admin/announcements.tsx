import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ROLE_NAMES } from '@/components/admin/shared';
import { Card, ChoiceChips, EmptyBlock, KButton, KField, SectionTitle, StatusPill } from '@/components/kit';
import { staffScreen } from '@/components/persona/StaffGate';
import { Hint, ToolPage } from '@/components/toolkit/core';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toastError } from '@/components/ui/Toast';
import { ANNOUNCEMENT_AUDIENCES } from '@/store/db/admin';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Announcement } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { timeAgo } from '@/utils/format';

const audienceName = (a: Announcement['audience']) => (a === 'all' ? 'Everyone' : `${ROLE_NAMES[a]}s`);
const TONES: Announcement['tone'][] = ['info', 'success', 'warning'];
const TONE_NAMES: Record<Announcement['tone'], string> = { info: 'Information', success: 'Good news', warning: 'Important' };

/** Notices pinned to the top of a role's home screen (or everyone's), switched on and off at will. */
function Announcements() {
  const t = useRoleTheme();
  const list = useDb((s) => s.announcements);
  const add = useDb((s) => s.addAnnouncement);
  const update = useDb((s) => s.updateAnnouncement);
  const remove = useDb((s) => s.removeAnnouncement);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Announcement['audience']>('all');
  const [tone, setTone] = useState<Announcement['tone']>('info');
  const [error, setError] = useState<string | null>(null);

  const publish = () => {
    if (title.trim().length < 3) return setError('Write a title of at least 3 characters');
    const err = add({ title, body, audience, tone });
    if (err) return toastError(err);
    setTitle('');
    setBody('');
    setError(null);
  };

  return (
    <ToolPage title="Announcements" subtitle={`${list.filter((a) => a.active).length} live`}>
      <Hint>An announcement shows at the top of the home screen for the people you pick, until you switch it off. They can dismiss it for that visit.</Hint>
      <SectionTitle title="New announcement" />
      <Card style={{ gap: 12 }}>
        <KField label="Title" required value={title} onChangeText={(v) => { setTitle(v); setError(null); }} placeholder="e.g. Mangsir dates are filling fast" error={error} maxLength={90} />
        <KField label="Message" value={body} onChangeText={setBody} placeholder="Optional details" multiline maxLength={300} />
        <Text size={13} weight="medium" color={t.c.text}>
          Who sees it
        </Text>
        <ChoiceChips options={ANNOUNCEMENT_AUDIENCES.map(audienceName)} selected={[audienceName(audience)]} onToggle={(v) => setAudience(ANNOUNCEMENT_AUDIENCES.find((a) => audienceName(a) === v) ?? 'all')} />
        <Text size={13} weight="medium" color={t.c.text}>
          Style
        </Text>
        <ChoiceChips options={TONES.map((x) => TONE_NAMES[x])} selected={[TONE_NAMES[tone]]} onToggle={(v) => setTone(TONES.find((x) => TONE_NAMES[x] === v) ?? 'info')} />
        <KButton label="Publish" icon="megaphone-outline" onPress={publish} />
      </Card>

      <SectionTitle title="Published" />
      {list.length === 0 ? (
        <EmptyBlock icon="megaphone-outline" title="No announcements yet" message="Write one above to reach couples, businesses, freelancers or your team." />
      ) : (
        list.map((a) => (
          <Card key={a.id} style={{ gap: 8 }}>
            <View style={styles.head}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text size={15} weight="semibold" color={t.c.textStrong}>
                  {a.title}
                </Text>
                <Text size={12} color={t.c.muted}>
                  {audienceName(a.audience)} · {TONE_NAMES[a.tone]} · {a.createdBy} · {timeAgo(a.createdAt)}
                </Text>
              </View>
              <StatusPill status={a.active ? 'verified' : 'archived'} label={a.active ? 'Live' : 'Off'} />
            </View>
            {!!a.body && (
              <Text size={14} color={t.c.text}>
                {a.body}
              </Text>
            )}
            <View style={styles.head}>
              <Text size={13} color={t.c.text} style={{ flex: 1 }}>
                Show it
              </Text>
              <Toggle value={a.active} onValueChange={(active) => { const err = update(a.id, { active }); if (err) toastError(err); }} accessibilityLabel="Show it" />
            </View>
            <KButton label="Delete" size="sm" variant="danger" icon="trash-outline" onPress={() => confirm('Delete this announcement?', a.title, 'Delete', () => { const err = remove(a.id); if (err) toastError(err); })} />
          </Card>
        ))
      )}
    </ToolPage>
  );
}

export default staffScreen('/platform/admin/announcements', Announcements);

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});

/**
 * Occasion tools: the planning tools only some celebrations get (baby
 * keepsakes for a newborn, a surprise plan for an anniversary, games for a
 * baby shower or a birthday). Each is shown by its rule in `TOOL_RULES`
 * (`plan.keepsakes`, `plan.surprise`, `plan.games`) and stores records in the
 * shared tool collections, owned by the project so the family shares them.
 */
import { View } from 'react-native';

import { Card, KButton } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import type { ToolEntry } from '@/types/platform';
import { daysUntil, formatMoney, formatShortDate, relativeDay } from '@/utils/format';
import { shareMessage } from '@/utils/links';

import { EntryList, Hint, Line, StatRow, sumAmount, ToolPage } from '../core';
import { useWedding } from './shared';

// ─── Newborn: baby keepsakes ────────────────────────────────────────────────

const KEEPSAKE_GROUPS = ['Firsts', 'Growth', 'Gifts from relatives', 'Photos and prints'];

const KEEPSAKE_PRESET = [
  { title: 'First rice (pasni) photo', group: 'Firsts' },
  { title: 'Name chosen at the nwaran', group: 'Firsts' },
  { title: 'Weight at birth', group: 'Growth' },
  { title: 'Weight on the pasni day', group: 'Growth' },
  { title: 'Silver bowl and spoon', group: 'Gifts from relatives' },
  { title: 'Print the family photo', group: 'Photos and prints' },
];

export function BabyKeepsakes() {
  const w = useWedding();
  return (
    <ToolPage title="Baby keepsakes" subtitle="Firsts, weight, and gifts from relatives">
      <EntryList
        ownerId={w.owner}
        tool="couple.keepsakes"
        noun="keepsake"
        groupBy="group"
        groupOrder={KEEPSAKE_GROUPS}
        presets={KEEPSAKE_PRESET}
        defaults={{ group: 'Firsts' }}
        fields={[
          { key: 'title', label: 'What', kind: 'text', required: true, placeholder: 'e.g. First smile, gold bracelet from hajurama' },
          { key: 'group', label: 'Kind', kind: 'select', options: KEEPSAKE_GROUPS },
          { key: 'date', label: 'Date', kind: 'date' },
          { key: 'f.value', label: 'Weight, length or detail', kind: 'text', placeholder: 'e.g. 3.2 kg' },
          { key: 'f.from', label: 'From (for gifts)', kind: 'text' },
          { key: 'amount', label: 'Cash gift', kind: 'money' },
          { key: 'note', label: 'Notes', kind: 'multiline' },
        ]}
        subtitle={(e) => [e.date ? formatShortDate(e.date) : undefined, e.fields?.value, e.fields?.from ? `from ${e.fields.from}` : undefined, e.note].filter(Boolean).join(' · ') || undefined}
        header={(entries) => {
          const gifts = entries.filter((e) => e.group === 'Gifts from relatives');
          return (
            <StatRow
              items={[
                { label: 'Keepsakes', value: String(entries.length) },
                { label: 'Gifts noted', value: String(gifts.length) },
                { label: 'Cash gifts', value: formatMoney(sumAmount(gifts)) },
              ]}
            />
          );
        }}
        emptyMessage="Note the firsts, the weights and who gave what, while you still remember."
      />
    </ToolPage>
  );
}

// ─── Anniversary: surprise plan ─────────────────────────────────────────────

const SURPRISE_STEPS = ['Idea', 'Book', 'Buy', 'On the day'];

const SURPRISE_PRESET = [
  { title: 'Pick the surprise: dinner, trip or party', group: 'Idea' },
  { title: 'Tell the one person who keeps the secret', group: 'Idea' },
  { title: 'Book the table or the venue', group: 'Book' },
  { title: 'Order the cake with the right year on it', group: 'Buy' },
  { title: 'Old photos for a slideshow', group: 'Buy' },
  { title: 'Get them there on time with a cover story', group: 'On the day' },
];

export function SurprisePlan() {
  const w = useWedding();
  const days = w.project ? daysUntil(w.date) : null;
  return (
    <ToolPage title="Surprise plan" subtitle="Keep it secret, keep it on track">
      <EntryList
        ownerId={w.owner}
        tool="couple.surprise"
        noun="step"
        checklist
        groupBy="group"
        groupOrder={SURPRISE_STEPS}
        presets={SURPRISE_PRESET}
        defaults={{ group: 'Idea' }}
        fields={[
          { key: 'title', label: 'Step', kind: 'text', required: true },
          { key: 'group', label: 'Stage', kind: 'select', options: SURPRISE_STEPS },
          { key: 'date', label: 'Do by', kind: 'date' },
          { key: 'f.who', label: 'Who does it', kind: 'text' },
          { key: 'amount', label: 'Cost', kind: 'money' },
          { key: 'note', label: 'Notes', kind: 'text' },
        ]}
        subtitle={(e) => [e.date ? `by ${relativeDay(e.date)}` : undefined, e.fields?.who, e.note].filter(Boolean).join(' · ') || undefined}
        header={(entries) => (
          <View style={{ gap: 10 }}>
            <StatRow
              items={[
                { label: 'Days to go', value: days === null ? '—' : String(Math.max(0, days)) },
                { label: 'Steps left', value: String(entries.filter((e) => !e.done).length) },
                { label: 'Spent', value: formatMoney(sumAmount(entries)) },
              ]}
            />
            <Hint>Collaborators you invite can see this list. Keep the person being surprised off the plan until the day.</Hint>
          </View>
        )}
      />
    </ToolPage>
  );
}

// ─── Baby shower and birthday: games and activities ─────────────────────────

const GAME_SLOTS = ['Arrival', 'Games', 'Cake and wishes', 'Dance', 'Wind-down'];

const GAMES_PRESET = [
  { title: 'Guess the baby photo', group: 'Games', qty: 15, fields: { prize: 'Chocolates' } },
  { title: 'Musical chairs', group: 'Games', qty: 10 },
  { title: 'Housie (tambola)', group: 'Games', qty: 20, fields: { prize: 'Cash envelopes' } },
  { title: 'Cake cutting and song', group: 'Cake and wishes', qty: 5 },
  { title: 'Dohori and dance', group: 'Dance', qty: 30 },
];

const minutesOf = (e: ToolEntry) => e.qty ?? 0;

export function GamesActivities() {
  const w = useWedding();
  return (
    <ToolPage title="Games and activities" subtitle="What happens when, and the prizes">
      <EntryList
        ownerId={w.owner}
        tool="couple.games"
        noun="activity"
        groupBy="group"
        groupOrder={GAME_SLOTS}
        presets={GAMES_PRESET}
        defaults={{ group: 'Games' }}
        fields={[
          { key: 'title', label: 'Activity', kind: 'text', required: true },
          { key: 'group', label: 'When', kind: 'select', options: GAME_SLOTS },
          { key: 'qty', label: 'Minutes', kind: 'number' },
          { key: 'f.host', label: 'Who runs it', kind: 'text' },
          { key: 'f.prize', label: 'Prize', kind: 'text' },
          { key: 'amount', label: 'Prize budget', kind: 'money' },
        ]}
        subtitle={(e) => [e.qty ? `${e.qty} min` : undefined, e.fields?.host, e.fields?.prize ? `prize: ${e.fields.prize}` : undefined].filter(Boolean).join(' · ') || undefined}
        header={(entries) => {
          const minutes = entries.reduce((s, e) => s + minutesOf(e), 0);
          return (
            <View style={{ gap: 10 }}>
              <StatRow
                items={[
                  { label: 'Activities', value: String(entries.length) },
                  { label: 'Running time', value: `${Math.floor(minutes / 60)} h ${minutes % 60} min` },
                  { label: 'Prize budget', value: formatMoney(sumAmount(entries)) },
                ]}
              />
              {entries.length > 0 && (
                <Card style={{ gap: 4 }}>
                  <Text size={14} weight="semibold">
                    Order of the day
                  </Text>
                  {GAME_SLOTS.map((slot) => {
                    const items = entries.filter((e) => e.group === slot);
                    return items.length ? <Line key={slot} label={slot} value={`${items.reduce((s, e) => s + minutesOf(e), 0)} min`} note={items.map((e) => e.title).join(', ')} /> : null;
                  })}
                  <KButton
                    label="Share with the hosts"
                    size="sm"
                    variant="secondary"
                    icon="share-outline"
                    onPress={() =>
                      shareMessage(
                        `${w.project?.title ?? 'Our party'}: order of the day\n\n${entries
                          .slice()
                          .sort((a, b) => GAME_SLOTS.indexOf(a.group ?? '') - GAME_SLOTS.indexOf(b.group ?? ''))
                          .map((e) => `${e.group}: ${e.title}${e.fields?.host ? ` (${e.fields.host})` : ''}`)
                          .join('\n')}`,
                      )
                    }
                  />
                </Card>
              )}
            </View>
          );
        }}
      />
    </ToolPage>
  );
}

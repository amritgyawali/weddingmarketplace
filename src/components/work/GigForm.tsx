import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoiceChips, KButton, KField } from '@/components/kit';
import { Calendar } from '@/components/ui/Calendar';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { FREELANCE_SKILLS } from '@/data/skills';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Gig, Project } from '@/types/platform';
import { formatLongDate } from '@/utils/format';

export type GigDraft = Omit<Gig, 'id' | 'createdAt' | 'status' | 'applications' | 'postedById' | 'postedByName' | 'postedByKind'>;

/** Post a staffing requirement that freelancers can apply to. */
export function GigForm({
  projects,
  defaultCity,
  initialProjectId,
  onSubmit,
}: {
  projects: Project[];
  defaultCity: string;
  initialProjectId?: string;
  onSubmit: (gig: GigDraft) => void;
}) {
  const initialProject = projects.find((p) => p.id === initialProjectId);
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [skill, setSkill] = useState<string>('Photography');
  const [projectId, setProjectId] = useState<string | undefined>(initialProject?.id);
  const [city, setCity] = useState(initialProject?.city ?? defaultCity);
  const [date, setDate] = useState<string | null>(initialProject?.weddingDate ?? null);
  const [startTime, setStartTime] = useState('10:00');
  const [hours, setHours] = useState('8');
  const [pay, setPay] = useState('');
  const [slots, setSlots] = useState('1');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const project = projects.find((p) => p.id === projectId);

  const submit = () => {
    const next = {
      title: title.trim().length < 5 ? 'Give the gig a clear title' : null,
      date: !date ? 'Pick the gig date' : null,
      pay: !(Number(pay) > 0) ? 'Enter the pay per person' : null,
      time: !/^\d{1,2}:\d{2}$/.test(startTime) ? 'Use HH:MM' : null,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;
    onSubmit({
      title: title.trim(),
      skill,
      projectId,
      eventId: project?.events.find((e) => e.date === date)?.id,
      city: city.trim() || defaultCity,
      date: date!,
      startTime,
      hours: Math.max(1, Number(hours) || 1),
      pay: Number(pay),
      slots: Math.max(1, Number(slots) || 1),
      description: description.trim(),
      requirements: requirements
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean),
    });
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <KField label="Gig title" placeholder="e.g. Second shooter for sangeet" value={title} onChangeText={setTitle} error={errors.title} />
        <View style={{ gap: 6 }}>
          <Text size={13} weight="semibold" color={t.c.muted}>
            Skill needed
          </Text>
          <ChoiceChips options={[...FREELANCE_SKILLS]} selected={[skill]} onToggle={setSkill} />
        </View>
        {projects.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text size={13} weight="semibold" color={t.c.muted}>
              Link to a wedding (optional)
            </Text>
            <ChoiceChips
              options={projects.map((p) => `${p.code} · ${p.title}`)}
              selected={project ? [`${project.code} · ${project.title}`] : []}
              onToggle={(label) => {
                const p = projects.find((x) => label.startsWith(x.code));
                setProjectId((cur) => (cur === p?.id ? undefined : p?.id));
                if (p) {
                  setCity(p.city);
                  setDate(p.weddingDate);
                }
              }}
            />
          </View>
        )}
        <KField label="City" value={city} onChangeText={setCity} />
        <View style={{ gap: 6 }}>
          <Text size={13} weight="semibold" color={t.c.muted}>
            Date
          </Text>
          <Pressable onPress={() => setDateOpen(true)} style={[styles.date, { borderColor: errors.date ? t.c.danger : t.c.border, backgroundColor: t.dark ? t.c.surfaceAlt : t.c.surface }]}>
            <Ionicons name="calendar-outline" size={18} color={t.c.primary} />
            <Text size={15} color={date ? t.c.textStrong : t.c.subtle}>
              {date ? formatLongDate(date) : 'Select date'}
            </Text>
          </Pressable>
          {!!errors.date && (
            <Text size={12} color={t.c.danger}>
              {errors.date}
            </Text>
          )}
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <KField label="Start time" value={startTime} onChangeText={setStartTime} placeholder="10:00" error={errors.time} />
          </View>
          <View style={{ flex: 1 }}>
            <KField label="Hours" value={hours} onChangeText={setHours} keyboardType="number-pad" />
          </View>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1.4 }}>
            <KField label="Pay per person" value={pay} onChangeText={setPay} keyboardType="number-pad" prefix="₹" error={errors.pay} />
          </View>
          <View style={{ flex: 1 }}>
            <KField label="People needed" value={slots} onChangeText={setSlots} keyboardType="number-pad" />
          </View>
        </View>
        <KField label="Description" value={description} onChangeText={setDescription} multiline placeholder="What will they do? Dress code, reporting point…" />
        <KField label="Requirements (comma separated)" value={requirements} onChangeText={setRequirements} placeholder="Own kit, 2+ years experience" />
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: t.c.surface, borderTopColor: t.c.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <KButton label="Post gig" icon="megaphone-outline" onPress={submit} size="lg" />
      </View>
      <Sheet visible={dateOpen} onClose={() => setDateOpen(false)} title="Gig date">
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <Calendar value={date} onChange={setDate} />
          <KButton label="Done" onPress={() => setDateOpen(false)} disabled={!date} />
        </View>
      </Sheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  date: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 12, borderWidth: 1.2, paddingHorizontal: 14 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
});

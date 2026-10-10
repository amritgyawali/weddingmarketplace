import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChoiceChips, KButton, KField, showMissing } from '@/components/kit';
import { Calendar } from '@/components/ui/Calendar';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { CREW_ROLES } from '@/data/services';
import { freelancerNet } from '@/services/pricing';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Gig, Project } from '@/types/platform';
import { addDays, formatLongDate, formatMoney, today } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

export type GigDraft = Omit<Gig, 'id' | 'createdAt' | 'status' | 'applications' | 'postedById' | 'postedByName' | 'postedByKind'>;

const EQUIPMENT = ['Full-frame camera', '70-200mm lens', '24-70mm lens', 'Drone', 'Gimbal', 'Flash', 'Pro makeup kit', 'Own vehicle', 'Formal attire'];

/** Post a staffing requirement freelancers can apply to (or accept an invite). */
export function GigForm({ projects, defaultCity, initialProjectId, onSubmit }: { projects: Project[]; defaultCity: string; initialProjectId?: string; onSubmit: (gig: GigDraft) => void }) {
  const initialProject = projects.find((p) => p.id === initialProjectId);
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [skill, setSkill] = useState<string>('Photographer');
  const [projectId, setProjectId] = useState<string | undefined>(initialProject?.id);
  const [eventId, setEventId] = useState<string | undefined>(initialProject?.events.find((e) => e.date)?.id);
  const [city, setCity] = useState(initialProject?.city ?? defaultCity);
  const [location, setLocation] = useState('');
  const [date, setDate] = useState<string | null>(initialProject?.weddingDate ?? null);
  const [startTime, setStartTime] = useState('10:00');
  const [hours, setHours] = useState('8');
  const [pay, setPay] = useState('');
  const [slots, setSlots] = useState('1');
  const [description, setDescription] = useState('');
  const [equipment, setEquipment] = useState<string[]>([]);
  const [requirements, setRequirements] = useState('');
  const [emergency, setEmergency] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const project = projects.find((p) => p.id === projectId);
  const net = Number(pay) > 0 ? freelancerNet(Math.round(Number(pay) / 0.8)) : null;

  const submit = () => {
    const next = {
      title: !title.trim() ? 'Enter a title for the gig' : title.trim().length < 5 ? 'Give the gig a clear title (at least 5 characters)' : null,
      date: !date ? 'Pick the gig date' : null,
      pay: !(Number(pay) > 0) ? 'Enter the pay per person' : null,
      time: !/^\d{1,2}:\d{2}$/.test(startTime) ? 'Use HH:MM' : null,
    };
    setErrors(next);
    const problem = Object.values(next).find(Boolean);
    if (problem) return showMissing(problem);
    const event = project?.events.find((e) => e.id === eventId);
    onSubmit({
      title: title.trim(),
      skill,
      projectId,
      eventId,
      city: city.trim() || defaultCity,
      location: location.trim() || event?.venue,
      date: date!,
      startTime,
      hours: Math.max(1, Number(hours) || 1),
      pay: Number(pay),
      slots: Math.max(1, Number(slots) || 1),
      description: description.trim(),
      equipment,
      requirements: [...equipment, ...requirements.split(',').map((r) => r.trim()).filter(Boolean)],
      emergency,
      deadline: emergency ? today() : addDays(date!, -3),
    });
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <KField label="Gig title" required placeholder="e.g. Second photographer for the reception" value={title} onChangeText={setTitle} error={errors.title} maxLength={80} />
        <View style={{ gap: 6 }}>
          <Text size={13} weight="semibold" color={t.c.muted}>
            Role needed
          </Text>
          <ChoiceChips options={CREW_ROLES} selected={[skill]} onToggle={setSkill} />
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
                  const e = p.events.find((x) => x.date);
                  setEventId(e?.id);
                  setDate(e?.date ?? p.weddingDate);
                }
              }}
            />
            {project && (
              <ChoiceChips
                options={project.events.filter((e) => e.date).map((e) => `${e.name} · ${formatLongDate(e.date!)}`)}
                selected={project.events.filter((e) => e.id === eventId).map((e) => `${e.name} · ${formatLongDate(e.date!)}`)}
                onToggle={(label) => {
                  const e = project.events.find((x) => label.startsWith(x.name));
                  setEventId(e?.id);
                  if (e?.date) setDate(e.date);
                  if (e) setStartTime(e.startTime);
                }}
              />
            )}
          </View>
        )}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <KField label="City" value={city} onChangeText={setCity} />
          </View>
          <View style={{ flex: 1.4 }}>
            <KField label="Location / venue" value={location} onChangeText={setLocation} placeholder="Reporting point" />
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <Text size={13} weight="semibold" color={t.c.muted}>
            Date <Text size={13} color={t.c.danger}>*</Text>
          </Text>
          <Pressable onPress={() => setDateOpen(true)} style={[styles.date, { borderColor: errors.date ? t.c.danger : t.c.border, backgroundColor: t.dark ? t.c.surfaceAlt : t.c.surface }]}>
            <Ionicons name="calendar-outline" size={18} color={t.c.primary} />
            <Text size={15} color={date ? t.c.textStrong : t.c.muted}>
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
            <KField label="Start time" required value={startTime} onChangeText={setStartTime} placeholder="10:00" error={errors.time} />
          </View>
          <View style={{ flex: 1 }}>
            <KField label="Hours" value={hours} onChangeText={setHours} keyboardType="number-pad" />
          </View>
        </View>
        <View style={styles.row}>
          <View style={{ flex: 1.4 }}>
            <KField label="Pay per person (freelancer receives)" required value={pay} onChangeText={(v) => setPay(v.replace(/\D/g, ''))} keyboardType="number-pad" prefix="NPR" error={errors.pay} />
          </View>
          <View style={{ flex: 1 }}>
            <KField label="People needed" value={slots} onChangeText={setSlots} keyboardType="number-pad" />
          </View>
        </View>
        {net && (
          <Text size={12} color={t.c.muted}>
            Billed at {formatMoney(Math.round(Number(pay) / 0.8))} per person · freelancer gets {formatMoney(Number(pay))} · platform margin {formatMoney(Math.round(Number(pay) / 0.8) - Number(pay))}
          </Text>
        )}
        <View style={{ gap: 6 }}>
          <Text size={13} weight="semibold" color={t.c.muted}>
            Equipment required
          </Text>
          <ChoiceChips options={EQUIPMENT} selected={equipment} onToggle={(v) => setEquipment((cur) => (cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]))} />
        </View>
        <KField label="Description" value={description} onChangeText={setDescription} multiline maxLength={800} placeholder="What will they do? Dress code, reporting point, deliverables…" />
        <KField label="Other requirements (comma separated)" value={requirements} onChangeText={setRequirements} placeholder="2+ years experience, Nepali & English" />
        <Pressable onPress={() => setEmergency((v) => !v)} style={[styles.emergency, { borderColor: emergency ? t.c.danger : t.c.border }]} accessibilityRole="checkbox" accessibilityState={{ checked: emergency }}>
          <Ionicons name={emergency ? 'medkit' : 'medkit-outline'} size={20} color={emergency ? t.c.danger : t.c.muted} />
          <View style={{ flex: 1 }}>
            <Text size={14} weight="semibold" color={t.c.textStrong}>
              Emergency gig
            </Text>
            <Text size={12} color={t.c.muted}>
              Pushes an urgent alert to nearby crew; first to accept gets it.
            </Text>
          </View>
        </Pressable>
      </ScrollView>
      <View style={[styles.footer, { backgroundColor: t.c.surface, borderTopColor: t.c.border, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <KButton label={emergency ? 'Send emergency gig' : 'Post gig'} icon="megaphone-outline" variant={emergency ? 'danger' : 'primary'} onPress={submit} size="lg" />
      </View>
      <Sheet visible={dateOpen} onClose={() => setDateOpen(false)} title="Gig date">
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <Calendar value={date} onChange={setDate} />
          <KButton label="Done" onPress={() => setDateOpen(false)} missing={!date && 'Pick the gig date'} />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 12 },
  date: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 8, borderWidth: 1, paddingHorizontal: 14 },
  emergency: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 8, padding: 12 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
});

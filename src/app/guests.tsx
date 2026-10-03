import { Ionicons } from '@expo/vector-icons';
import { Contact, ContactField, requestPermissionsAsync } from 'expo-contacts';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Card, ChoiceChips, EmptyBlock, Fab, KButton, KField, Segmented, StatTile } from '@/components/kit';
import { ToolScreen, toolStyles } from '@/components/planner/ToolScreen';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast } from '@/components/ui/Toast';
import { colors } from '@/constants/theme';
import { guestListHtml } from '@/services/documents';
import { exportCsv, pickCsv, sharePdf } from '@/services/exporters';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Guest, Project, RsvpStatus } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { formatPhone, isNepalMobile } from '@/utils/format';
import { openWhatsApp, rsvpPath, webUrl } from '@/utils/links';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const CATEGORIES = ['Family', 'Relatives', 'Friends', 'Colleagues', 'Neighbours', 'Guru / Priest', 'Plus-ones'];
const DIETARY = ['Vegetarian', 'Non-veg', 'Vegan', 'Jain', 'No alcohol', 'No buff', 'Diabetic', 'Allergies'];
const RSVP: { id: RsvpStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'yes', label: 'Attending', icon: 'checkmark-circle' },
  { id: 'maybe', label: 'Maybe', icon: 'help-circle' },
  { id: 'no', label: 'Declined', icon: 'close-circle' },
  { id: 'pending', label: 'Pending', icon: 'time' },
];
type Side = 'all' | Guest['side'];

const partySize = (g: Guest) => 1 + g.plusOnes + g.children;

function rsvpColor(r: RsvpStatus, t: ReturnType<typeof useRoleTheme>) {
  return r === 'yes' ? t.c.success : r === 'no' ? t.c.danger : r === 'maybe' ? t.c.warning : t.c.subtle;
}

function emptyGuest(project: Project): Guest {
  return {
    id: '',
    projectId: project.id,
    name: '',
    side: 'both',
    category: 'Friends',
    vip: false,
    plusOnes: 0,
    children: 0,
    dietary: [],
    accommodation: false,
    transport: false,
    code: '',
    invites: project.events.filter((e) => e.status !== 'cancelled').map((e) => ({ eventId: e.id, rsvp: 'pending', attending: 0 })),
  };
}

function GuestSheet({ project, guest, onClose }: { project: Project; guest: Guest | null; onClose: () => void }) {
  const t = useRoleTheme();
  const addGuest = useDb((s) => s.addGuest);
  const updateGuest = useDb((s) => s.updateGuest);
  const removeGuest = useDb((s) => s.removeGuest);
  const setInvite = useDb((s) => s.setInvite);
  const toggleInvite = useDb((s) => s.toggleInvite);
  const checkIn = useDb((s) => s.checkInGuest);
  const live = useDb((s) => (guest?.id ? s.guests.find((g) => g.id === guest.id) : undefined));
  const [draft, setDraft] = useState<Guest | null>(guest);
  const [error, setError] = useState<string | null>(null);
  if (!guest || !draft) return null;
  const isNew = !guest.id;
  const invites = live?.invites ?? draft.invites;
  const set = (patch: Partial<Guest>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const save = () => {
    if (draft.name.trim().length < 2) return setError('Enter the guest’s name');
    if (draft.phone && !isNepalMobile(draft.phone)) return setError('Enter a valid Nepali mobile number');
    const { invites: inv, ...rest } = draft;
    if (isNew) {
      const created = addGuest({ ...rest, name: draft.name.trim(), eventIds: inv.map((i) => i.eventId) });
      toast(`${created.name} added`, 'person-add');
    } else {
      updateGuest(guest.id, { ...rest, name: draft.name.trim() });
      toast('Guest updated');
    }
    onClose();
  };

  return (
    <Sheet visible onClose={onClose} title={isNew ? 'Add guest' : draft.name} footer={<KButton label={isNew ? 'Add guest' : 'Save changes'} onPress={save} />}>
      <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 14, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        <KField label="Full name" value={draft.name} onChangeText={(v) => set({ name: v })} placeholder="e.g. Hari Bahadur Shrestha" error={error} />
        <View style={toolStyles.row}>
          <View style={{ flex: 1 }}>
            <KField label="Mobile" value={draft.phone ?? ''} onChangeText={(v) => set({ phone: v.replace(/\D/g, '').slice(0, 10) || undefined })} keyboardType="phone-pad" placeholder="98XXXXXXXX" />
          </View>
          <View style={{ flex: 1 }}>
            <KField label="Household" value={draft.household ?? ''} onChangeText={(v) => set({ household: v || undefined })} placeholder="Shrestha family" />
          </View>
        </View>
        <Text size={13} weight="semibold" color={t.c.muted}>
          Side
        </Text>
        <ChoiceChips options={['Bride', 'Groom', 'Both']} selected={[draft.side[0].toUpperCase() + draft.side.slice(1)]} onToggle={(v) => set({ side: v.toLowerCase() as Guest['side'] })} />
        <Text size={13} weight="semibold" color={t.c.muted}>
          Group
        </Text>
        <ChoiceChips options={CATEGORIES} selected={[draft.category]} onToggle={(v) => set({ category: v })} />
        <View style={toolStyles.row}>
          <Stepper label="Plus-ones" value={draft.plusOnes} onChange={(v) => set({ plusOnes: v })} />
          <Stepper label="Children" value={draft.children} onChange={(v) => set({ children: v })} />
        </View>
        <Text size={13} weight="semibold" color={t.c.muted}>
          Dietary
        </Text>
        <ChoiceChips options={DIETARY} selected={draft.dietary} onToggle={(v) => set({ dietary: draft.dietary.includes(v) ? draft.dietary.filter((x) => x !== v) : [...draft.dietary, v] })} />
        {[
          { key: 'vip' as const, label: 'VIP (head table, special care)' },
          { key: 'accommodation' as const, label: 'Needs accommodation' },
          { key: 'transport' as const, label: 'Needs transport' },
        ].map((f) => (
          <View key={f.key} style={toolStyles.between}>
            <Text size={14} color={t.c.text}>
              {f.label}
            </Text>
            <Toggle value={draft[f.key]} onValueChange={(v) => set({ [f.key]: v })} accessibilityLabel={f.label} />
          </View>
        ))}

        <Text size={15} weight="bold" color={t.c.textStrong} style={{ marginTop: 6 }}>
          Invited to
        </Text>
        {project.events
          .filter((e) => e.status !== 'cancelled')
          .map((e) => {
            const inv = invites.find((i) => i.eventId === e.id);
            return (
              <Card key={e.id} style={{ gap: 8, padding: 12 }}>
                <View style={toolStyles.between}>
                  <Text size={14} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }}>
                    {e.name}
                  </Text>
                  <Toggle
                    value={!!inv}
                    onValueChange={() => {
                      if (isNew) set({ invites: inv ? draft.invites.filter((i) => i.eventId !== e.id) : [...draft.invites, { eventId: e.id, rsvp: 'pending', attending: 0 }] });
                      else toggleInvite(guest.id, e.id);
                    }}
                    accessibilityLabel={`Invite to ${e.name}`}
                  />
                </View>
                {inv && !isNew && (
                  <>
                    <View style={toolStyles.wrap}>
                      {RSVP.map((r) => (
                        <Pressable
                          key={r.id}
                          onPress={() => setInvite(guest.id, e.id, { rsvp: r.id, attending: r.id === 'yes' ? Math.max(inv.attending, partySize(draft)) : r.id === 'no' ? 0 : inv.attending, respondedAt: new Date().toISOString() })}
                          style={[styles.rsvp, { borderColor: inv.rsvp === r.id ? rsvpColor(r.id, t) : t.c.border, backgroundColor: inv.rsvp === r.id ? `${rsvpColor(r.id, t)}18` : 'transparent' }]}>
                          <Ionicons name={r.icon} size={14} color={rsvpColor(r.id, t)} />
                          <Text size={12} weight="semibold" color={t.c.text}>
                            {r.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                    <Text size={11} color={t.c.muted}>
                      {inv.sentAt ? 'Invite sent' : 'Invite not sent'}
                      {inv.respondedAt ? ' · responded' : ''}
                      {inv.attending ? ` · ${inv.attending} attending` : ''}
                      {inv.checkedInAt ? ' · checked in' : ''}
                    </Text>
                    {e.date === new Date().toISOString().slice(0, 10) && !inv.checkedInAt && <KButton label="Check in now" size="sm" variant="secondary" icon="qr-code-outline" onPress={() => checkIn(guest.id, e.id)} />}
                  </>
                )}
              </Card>
            );
          })}

        <KField label="Gift received" value={draft.gift ?? ''} onChangeText={(v) => set({ gift: v || undefined })} placeholder="e.g. Silver plate set" />
        {!!draft.gift && (
          <View style={toolStyles.between}>
            <Text size={14} color={t.c.text}>
              Thank-you sent
            </Text>
            <Toggle value={!!draft.thanked} onValueChange={(v) => set({ thanked: v })} accessibilityLabel="Thank-you sent" />
          </View>
        )}
        <KField label="Notes" value={draft.notes ?? ''} onChangeText={(v) => set({ notes: v || undefined })} multiline />

        {!isNew && (
          <View style={toolStyles.row}>
            <KButton
              label="Send RSVP link"
              icon="logo-whatsapp"
              variant="secondary"
              size="sm"
              style={{ flex: 1 }}
              onPress={() => openWhatsApp(`Namaste ${draft.name.split(' ')[0]}! 🙏 You’re invited to ${project.title}’s wedding celebrations. Please RSVP here: ${webUrl(rsvpPath(guest.code))} (code ${guest.code})`, draft.phone)}
            />
            <KButton
              label="Remove"
              icon="trash-outline"
              variant="danger"
              size="sm"
              onPress={() =>
                confirm('Remove guest?', `${draft.name} will be removed from every function and seating plan.`, 'Remove', () => {
                  removeGuest(guest.id);
                  onClose();
                })
              }
            />
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const t = useRoleTheme();
  return (
    <View style={[styles.stepper, { borderColor: t.c.border }]}>
      <Text size={13} color={t.c.muted} style={{ flex: 1 }}>
        {label}
      </Text>
      <Pressable onPress={() => onChange(Math.max(0, value - 1))} hitSlop={8} accessibilityLabel={`Fewer ${label}`}>
        <Ionicons name="remove-circle-outline" size={22} color={t.c.primary} />
      </Pressable>
      <Text size={15} weight="bold" color={t.c.textStrong}>
        {value}
      </Text>
      <Pressable onPress={() => onChange(Math.min(20, value + 1))} hitSlop={8} accessibilityLabel={`More ${label}`}>
        <Ionicons name="add-circle-outline" size={22} color={t.c.primary} />
      </Pressable>
    </View>
  );
}

function ContactsSheet({ visible, onClose, onImport }: { visible: boolean; onClose: () => void; onImport: (rows: { name: string; phone?: string }[]) => void }) {
  const t = useRoleTheme();
  const [contacts, setContacts] = useState<{ id: string; name: string; phone?: string }[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState('');

  const load = async () => {
    try {
      const perm = await requestPermissionsAsync();
      if (!perm.granted) {
        toast('Allow contacts access to import guests', 'lock-closed');
        return onClose();
      }
      const all = await Contact.getAllDetails([ContactField.FULL_NAME, ContactField.PHONES] as const, { limit: 3000 });
      setContacts(
        all
          .map((c) => ({ id: c.id, name: c.fullName ?? '', phone: c.phones?.[0]?.number?.replace(/\D/g, '').slice(-10) }))
          .filter((c) => c.name.trim())
          .sort((a, b) => a.name.localeCompare(b.name)),
      );
    } catch {
      toast('Contacts aren’t available here — import a CSV instead', 'document-text-outline');
      onClose();
    }
  };

  const shown = (contacts ?? []).filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Import from contacts"
      footer={
        contacts ? (
          <KButton
            label={`Import ${picked.length} guest${picked.length === 1 ? '' : 's'}`}
            disabled={!picked.length}
            onPress={() => {
              onImport((contacts ?? []).filter((c) => picked.includes(c.id)));
              setPicked([]);
              onClose();
            }}
          />
        ) : (
          <KButton label="Allow access & load contacts" icon="people-outline" onPress={load} />
        )
      }>
      <View style={{ paddingHorizontal: 20, gap: 10, maxHeight: 460 }}>
        {contacts ? (
          <>
            <KField placeholder="Search contacts" value={q} onChangeText={setQ} />
            <FlatList
              data={shown}
              keyExtractor={(c) => c.id}
              style={{ maxHeight: 380 }}
              renderItem={({ item }) => {
                const on = picked.includes(item.id);
                return (
                  <Pressable onPress={() => setPicked((p) => (on ? p.filter((x) => x !== item.id) : [...p, item.id]))} style={[toolStyles.row, { paddingVertical: 8 }]}>
                    <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? t.c.primary : t.c.subtle} />
                    <View style={{ flex: 1 }}>
                      <Text size={14} color={t.c.textStrong}>
                        {item.name}
                      </Text>
                      {!!item.phone && (
                        <Text size={12} color={t.c.muted}>
                          {formatPhone(item.phone)}
                        </Text>
                      )}
                    </View>
                  </Pressable>
                );
              }}
            />
          </>
        ) : (
          <Text size={13} color={t.c.muted}>
            Pick people from your phone book. Only the names and numbers you select are added — nothing else leaves your phone.
          </Text>
        )}
      </View>
    </Sheet>
  );
}

function GuestList({ project, readOnly }: { project: Project; readOnly: boolean }) {
  const t = useRoleTheme();
  const all = useDb((s) => s.guests);
  const importGuests = useDb((s) => s.importGuests);
  const guests = all.filter((g) => g.projectId === project.id);
  const events = project.events.filter((e) => e.status !== 'cancelled');
  const [eventId, setEventId] = useState<string>('all');
  const [side, setSide] = useState<Side>('all');
  const [rsvp, setRsvp] = useState<RsvpStatus | null>(null);
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Guest | null>(null);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const inviteFor = (g: Guest) => (eventId === 'all' ? null : g.invites.find((i) => i.eventId === eventId));
  const scoped = eventId === 'all' ? guests : guests.filter((g) => g.invites.some((i) => i.eventId === eventId));
  const statusOf = (g: Guest): RsvpStatus => {
    const inv = inviteFor(g);
    if (inv) return inv.rsvp;
    if (g.invites.some((i) => i.rsvp === 'yes')) return 'yes';
    if (g.invites.length && g.invites.every((i) => i.rsvp === 'no')) return 'no';
    if (g.invites.some((i) => i.rsvp === 'maybe')) return 'maybe';
    return 'pending';
  };
  const filtered = scoped
    .filter((g) => (side === 'all' || g.side === side) && (!rsvp || statusOf(g) === rsvp) && (!q || `${g.name} ${g.household ?? ''} ${g.phone ?? ''}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => Number(b.vip) - Number(a.vip) || a.name.localeCompare(b.name));

  const heads = scoped.reduce((s, g) => s + partySize(g), 0);
  const attending = scoped.reduce((s, g) => {
    const inv = inviteFor(g);
    if (inv) return s + (inv.rsvp === 'yes' ? inv.attending || partySize(g) : 0);
    const best = Math.max(0, ...g.invites.filter((i) => i.rsvp === 'yes').map((i) => i.attending || partySize(g)));
    return s + best;
  }, 0);
  const count = (r: RsvpStatus) => scoped.filter((g) => statusOf(g) === r).length;
  const capacity = eventId === 'all' ? project.guests : (events.find((e) => e.id === eventId)?.guests ?? project.guests);

  const importRows = (rows: { name: string; phone?: string; email?: string; side?: string; category?: string; plus_ones?: string; plusOnes?: number }[]) => {
    const n = importGuests(
      project.id,
      rows.map((r) => ({
        name: r.name,
        phone: r.phone && isNepalMobile(r.phone) ? r.phone.replace(/\D/g, '').slice(-10) : undefined,
        email: r.email || undefined,
        side: (['bride', 'groom', 'both'] as const).find((s) => s === r.side?.toLowerCase()),
        category: r.category || undefined,
        plusOnes: r.plusOnes ?? (Number(r.plus_ones) || 0),
      })),
      events.map((e) => e.id),
    );
    toast(n ? `${n} guests imported` : 'No new guests found (duplicates skipped)', 'people');
  };

  const importCsv = async () => {
    setMenuOpen(false);
    const rows = await pickCsv();
    if (!rows) return;
    const valid = rows.filter((r) => r.name);
    if (!valid.length) return toast('CSV needs a “name” column (optional: phone, email, side, category, plus_ones)', 'alert-circle');
    importRows(valid.map((r) => ({ ...r, name: r.name })));
  };

  const exportList = () => {
    setMenuOpen(false);
    exportCsv(
      guests.map((g) => ({
        name: g.name,
        phone: g.phone ?? '',
        email: g.email ?? '',
        side: g.side,
        category: g.category,
        household: g.household ?? '',
        vip: g.vip ? 'yes' : '',
        plus_ones: g.plusOnes,
        children: g.children,
        dietary: g.dietary.join('; '),
        ...Object.fromEntries(events.map((e) => [e.name, g.invites.find((i) => i.eventId === e.id)?.rsvp ?? '—'])),
        rsvp_code: g.code,
      })),
      `${project.code}-guests`,
    );
  };

  return (
    <>
      <FlatList
        data={filtered}
        keyExtractor={(g) => g.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 120 }}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {[{ id: 'all', name: 'All functions' }, ...events].map((e) => (
                <Pressable key={e.id} onPress={() => setEventId(e.id)} style={[styles.pill, { borderColor: eventId === e.id ? t.c.primary : t.c.border, backgroundColor: eventId === e.id ? t.c.soft : t.c.surface }]}>
                  <Text size={13} weight="semibold" color={eventId === e.id ? t.c.primary : t.c.text}>
                    {e.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={toolStyles.stats}>
              {[
                { label: 'Invited', value: `${heads}`, sub: `${scoped.length} invites` },
                { label: 'Attending', value: `${attending}`, sub: `of ${capacity} planned` },
                { label: 'Pending', value: `${count('pending') + count('maybe')}`, sub: 'no reply' },
                { label: 'Declined', value: `${count('no')}`, sub: 'regrets' },
              ].map((s) => (
                <StatTile key={s.label} label={s.label} value={s.value} sub={s.sub} />
              ))}
            </View>
            {heads > capacity && (
              <Text size={12} color={t.c.warning}>
                Your list is {heads - capacity} people over the planned {capacity}. Tell your coordinator so catering and seating can be adjusted.
              </Text>
            )}
            <KField placeholder="Search name, household or phone" value={q} onChangeText={setQ} />
            <Segmented
              options={[
                { id: 'all', label: 'Everyone' },
                { id: 'bride', label: 'Bride side' },
                { id: 'groom', label: 'Groom side' },
                { id: 'both', label: 'Both' },
              ]}
              value={side}
              onChange={setSide}
            />
            <View style={toolStyles.wrap}>
              {RSVP.map((r) => (
                <Pressable key={r.id} onPress={() => setRsvp(rsvp === r.id ? null : r.id)} style={[styles.rsvp, { borderColor: rsvp === r.id ? rsvpColor(r.id, t) : t.c.border, backgroundColor: t.c.surface }]}>
                  <Ionicons name={r.icon} size={14} color={rsvpColor(r.id, t)} />
                  <Text size={12} weight="semibold" color={t.c.text}>
                    {r.label} · {count(r.id)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={toolStyles.row}>
              <KButton label="Import / export" icon="swap-vertical" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => setMenuOpen(true)} disabled={readOnly} />
              <KButton label="Send invites" icon="paper-plane-outline" size="sm" style={{ flex: 1 }} onPress={() => router.push('/invitations')} />
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyBlock
            icon="people-outline"
            art={guests.length ? undefined : 'kalash'}
            title={guests.length ? 'No guests match' : 'Start your guest list'}
            message={guests.length ? 'Try another filter.' : 'Add guests one by one, import your phone contacts or upload a CSV from Excel/Google Sheets.'}
          />
        }
        renderItem={({ item: g }) => {
          const status = statusOf(g);
          return (
            <Card onPress={readOnly ? undefined : () => setEditing(g)} style={[toolStyles.row, { padding: 12 }]}>
              <Avatar name={g.name} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={toolStyles.row}>
                  <Text size={15} weight="semibold" color={t.c.textStrong} numberOfLines={1} style={{ flexShrink: 1 }}>
                    {g.name}
                  </Text>
                  {g.vip && <Ionicons name="star" size={13} color={colors.crown} />}
                </View>
                <Text size={12} color={t.c.muted} numberOfLines={1}>
                  {g.side === 'both' ? 'Both sides' : `${g.side[0].toUpperCase()}${g.side.slice(1)}’s side`} · {g.category}
                  {partySize(g) > 1 ? ` · party of ${partySize(g)}` : ''}
                  {g.dietary.length ? ` · ${g.dietary[0]}` : ''}
                </Text>
                <View style={[toolStyles.row, { gap: 4 }]}>
                  {events.map((e) => {
                    const inv = g.invites.find((i) => i.eventId === e.id);
                    return <View key={e.id} style={[styles.dot, { backgroundColor: inv ? rsvpColor(inv.rsvp, t) : t.c.border, opacity: inv ? 1 : 0.4 }]} />;
                  })}
                </View>
              </View>
              <Ionicons name={RSVP.find((r) => r.id === status)!.icon} size={22} color={rsvpColor(status, t)} />
            </Card>
          );
        }}
      />
      {!readOnly && <Fab icon="person-add" label="Add guest" onPress={() => setEditing(emptyGuest(project))} />}
      {editing && <GuestSheet key={editing.id || 'new'} project={project} guest={editing} onClose={() => setEditing(null)} />}
      <ContactsSheet visible={contactsOpen} onClose={() => setContactsOpen(false)} onImport={(rows) => importRows(rows)} />
      <Sheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Import & export">
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <KButton label="Import from phone contacts" icon="people-outline" variant="secondary" onPress={() => { setMenuOpen(false); setContactsOpen(true); }} />
          <KButton label="Import CSV / Excel export" icon="document-text-outline" variant="secondary" onPress={importCsv} />
          <KButton label="Export guest list (CSV)" icon="download-outline" variant="secondary" onPress={exportList} />
          <KButton
            label="Print guest list (PDF)"
            icon="print-outline"
            variant="secondary"
            onPress={() => {
              setMenuOpen(false);
              sharePdf(guestListHtml(project, guests, events), `${project.code}-guest-list`);
            }}
          />
          <Text size={12} color={t.c.muted}>
            CSV columns: name, phone, email, side (bride/groom/both), category, plus_ones. Duplicates are skipped automatically.
          </Text>
        </View>
      </Sheet>
    </>
  );
}

/** Guest list & RSVP manager: sides, groups, per-function invites, dietary needs, imports and exports. */
export default function GuestsScreen() {
  return (
    <ToolScreen title="Guests & RSVP" subtitle={(p) => `${p.title} · ${p.events.filter((e) => e.status !== 'cancelled').length} functions`}>
      {(project, { readOnly }) => <GuestList project={project} readOnly={readOnly} />}
    </ToolScreen>
  );
}

const styles = StyleSheet.create({
  pill: { height: 36, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, justifyContent: 'center' },
  rsvp: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  stepper: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, height: 48 },
});

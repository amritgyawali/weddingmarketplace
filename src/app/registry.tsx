import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, EmptyBlock, Fab, KButton, KField, StatTile } from '@/components/kit';
import { REGISTRY_KINDS, RegistryCard, registryRaised } from '@/components/planner/RegistryCard';
import { ToolScreen, toolStyles } from '@/components/planner/ToolScreen';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { photos, type PhotoKey } from '@/constants/images';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Project, RegistryItem } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { formatMoney, formatShortDate } from '@/utils/format';
import { shareMessage, sitePath, webUrl } from '@/utils/links';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const IMAGES: PhotoKey[] = ['venueDestinationBeach', 'venueResortSunset', 'venueCliffside', 'expertDesk', 'venueLawn', 'ideaReceptionToast', 'decorMandapFloral'];

type Draft = Omit<RegistryItem, 'id' | 'contributions'> & { id?: string };

function Registry({ project, readOnly }: { project: Project; readOnly: boolean }) {
  const t = useRoleTheme();
  const all = useDb((s) => s.registry);
  const site = useDb((s) => s.websites.find((w) => w.projectId === project.id));
  const add = useDb((s) => s.addRegistryItem);
  const update = useDb((s) => s.updateRegistryItem);
  const remove = useDb((s) => s.removeRegistryItem);
  const markThanked = useDb((s) => s.markContributionThanked);
  const items = all.filter((r) => r.projectId === project.id);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const open = items.find((i) => i.id === viewing);
  const gifts = items.flatMap((i) => i.contributions.map((c) => ({ ...c, item: i })));
  const raised = gifts.reduce((s, g) => s + g.amount, 0);
  const unthanked = gifts.filter((g) => !g.thanked);
  const url = site?.published ? webUrl(sitePath(site.slug)) : null;

  const save = () => {
    if (!draft || draft.title.trim().length < 2) return toast('Give it a name', 'alert-circle');
    const { id, ...data } = draft;
    if (id) update(id, { ...data, title: data.title.trim() });
    else add({ ...data, title: data.title.trim() });
    setDraft(null);
    toast('Registry updated', 'gift');
  };

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={toolStyles.stats}>
          {[
            { label: 'Received', value: formatMoney(raised) },
            { label: 'Gifts', value: String(gifts.length) },
            { label: 'To thank', value: String(unthanked.length) },
          ].map((s) => (
            <StatTile key={s.label} label={s.label} value={s.value} />
          ))}
        </View>
        <Card style={[toolStyles.row, { gap: 12 }]}>
          <Ionicons name="share-social-outline" size={22} color={t.c.primary} />
          <View style={{ flex: 1 }}>
            <Text size={14} weight="semibold" color={t.c.textStrong}>
              {url ? 'Guests give from your website' : 'Publish your website to share the registry'}
            </Text>
            <Text size={12} color={t.c.muted}>
              eSewa, Khalti, Fonepay, ConnectIPS and cards. Funds reach you after the wedding.
            </Text>
          </View>
          <KButton label={url ? 'Share' : 'Website'} size="sm" variant="secondary" onPress={() => (url ? shareMessage('Our wedding registry 🎁', url) : router.push('/website'))} />
        </Card>

        {items.length === 0 ? (
          <EmptyBlock icon="gift-outline" art="kalash" title="Create your registry" message="Add a honeymoon fund, home essentials, a charity you love or a link to your Daraz wishlist." />
        ) : (
          items.map((item) => <RegistryCard key={item.id} item={item} onPress={() => setViewing(item.id)} />)
        )}
      </ScrollView>
      {!readOnly && <Fab icon="add" label="Add item" onPress={() => setDraft({ projectId: project.id, kind: 'cash', title: '', image: 'venueResortSunset' })} />}

      <Sheet visible={!!open} onClose={() => setViewing(null)} title={open?.title}>
        {open && (
          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 12 }}>
            <Text size={13} color={t.c.muted}>
              {formatMoney(registryRaised(open))} from {open.contributions.length} guest{open.contributions.length === 1 ? '' : 's'}
            </Text>
            {open.contributions.length === 0 && (
              <Text size={13} color={t.c.muted}>
                No gifts yet.
              </Text>
            )}
            {open.contributions.map((c) => (
              <View key={c.id} style={toolStyles.row}>
                <View style={{ flex: 1 }}>
                  <Text size={14} weight="semibold" color={t.c.textStrong}>
                    {c.name} · {formatMoney(c.amount)}
                  </Text>
                  <Text size={12} color={t.c.muted}>
                    {formatShortDate(c.at)}
                    {c.message ? ` · “${c.message}”` : ''}
                  </Text>
                </View>
                <Pressable onPress={() => markThanked(open.id, c.id)} disabled={readOnly} style={[styles.thank, { borderColor: c.thanked ? t.c.success : t.c.border }]}>
                  <Ionicons name={c.thanked ? 'checkmark-circle' : 'heart-outline'} size={14} color={c.thanked ? t.c.success : t.c.primary} />
                  <Text size={12} weight="semibold" color={c.thanked ? t.c.success : t.c.primary}>
                    {c.thanked ? 'Thanked' : 'Thank'}
                  </Text>
                </Pressable>
              </View>
            ))}
            {!readOnly && (
              <View style={toolStyles.row}>
                <KButton
                  label="Edit"
                  icon="create-outline"
                  variant="secondary"
                  size="sm"
                  style={{ flex: 1 }}
                  onPress={() => {
                    const { contributions: _c, ...rest } = open;
                    setViewing(null);
                    setDraft(rest);
                  }}
                />
                <KButton
                  label="Delete"
                  icon="trash-outline"
                  variant="danger"
                  size="sm"
                  style={{ flex: 1 }}
                  onPress={() =>
                    confirm('Delete item?', open.contributions.length ? 'Gifts already received stay in your records.' : open.title, 'Delete', () => {
                      remove(open.id);
                      setViewing(null);
                    })
                  }
                />
              </View>
            )}
          </ScrollView>
        )}
      </Sheet>

      <Sheet visible={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit registry item' : 'Add to registry'} footer={<KButton label="Save" onPress={save} />}>
        {draft && (
          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            <ChoiceChips options={REGISTRY_KINDS.map((k) => k.label)} selected={[REGISTRY_KINDS.find((k) => k.id === draft.kind)!.label]} onToggle={(l) => setDraft({ ...draft, kind: REGISTRY_KINDS.find((k) => k.label === l)!.id })} />
            <KField label="Title" value={draft.title} onChangeText={(v) => setDraft({ ...draft, title: v })} placeholder={draft.kind === 'honeymoon' ? 'Honeymoon in Bali' : draft.kind === 'charity' ? 'Plant trees in Shivapuri' : 'New home fund'} />
            <KField label="Note for guests" value={draft.note ?? ''} onChangeText={(v) => setDraft({ ...draft, note: v || undefined })} multiline />
            {draft.kind === 'external' ? (
              <KField label="Wishlist link" value={draft.link ?? ''} onChangeText={(v) => setDraft({ ...draft, link: v || undefined })} autoCapitalize="none" placeholder="https://www.daraz.com.np/…" />
            ) : draft.kind === 'gift' ? (
              <KField label="Price" value={draft.price ? String(draft.price) : ''} onChangeText={(v) => setDraft({ ...draft, price: Number(v.replace(/\D/g, '')) || undefined, quantity: 1 })} keyboardType="number-pad" prefix="NPR" />
            ) : (
              <KField label="Goal" value={draft.target ? String(draft.target) : ''} onChangeText={(v) => setDraft({ ...draft, target: Number(v.replace(/\D/g, '')) || undefined })} keyboardType="number-pad" prefix="NPR" />
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {IMAGES.map((img) => (
                <Pressable key={img} onPress={() => setDraft({ ...draft, image: img })}>
                  <Photo source={photos[img]} style={[styles.thumb, { borderColor: draft.image === img ? t.c.primary : 'transparent' }]} contentFit="cover" />
                </Pressable>
              ))}
            </ScrollView>
          </ScrollView>
        )}
      </Sheet>
    </>
  );
}

/** Gift registry: cash, honeymoon and charity funds, gifts and store wishlists, with thank-you tracking. */
export default function RegistryScreen() {
  return (
    <ToolScreen title="Gift registry" subtitle={(p) => p.title}>
      {(project, { readOnly }) => <Registry project={project} readOnly={readOnly} />}
    </ToolScreen>
  );
}

const styles = StyleSheet.create({
  thank: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5 },
  thumb: { width: 70, height: 70, borderRadius: 8, borderWidth: 2 },
});

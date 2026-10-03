/**
 * The pieces a freelancer uses to say what they do: craft tiles, main skill
 * and extra skills, and the craft profile. Used by sign-up (one step each)
 * and by Profile → Your craft (all together).
 */
import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChoiceChips } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { CRAFT_BY_ID, CRAFTS, craftOf, type CraftId } from '@/data/crafts';
import { useLayout } from '@/hooks/useLayout';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Account } from '@/types/platform';

import { EssentialFields } from './VendorPersona';

export interface FreelancerPersonaDraft {
  craft: CraftId;
  primarySkill: string;
  skills: string[];
  tradeProfile: NonNullable<Account['tradeProfile']>;
}

/** A starting draft for a craft: its usual main skill. */
export const draftForCraft = (craft: CraftId, keep?: Partial<FreelancerPersonaDraft>): FreelancerPersonaDraft => {
  const def = CRAFT_BY_ID[craft];
  return { craft, primarySkill: def.skills[0], skills: [def.skills[0]], tradeProfile: keep?.tradeProfile ?? {} };
};

/** A draft from an account's saved skills (the first one is the main skill when none is set). */
export const draftFromAccount = (account: Pick<Account, 'skills' | 'primarySkill' | 'tradeProfile'>): FreelancerPersonaDraft => {
  const skills = account.skills ?? [];
  const primary = account.primarySkill && skills.includes(account.primarySkill) ? account.primarySkill : skills[0];
  const craft = craftOf(primary)?.id ?? 'photo';
  return primary ? { craft, primarySkill: primary, skills: [...skills], tradeProfile: { ...account.tradeProfile } } : draftForCraft(craft, { tradeProfile: { ...account.tradeProfile } });
};

/** Craft tiles with photos. */
export function CraftTiles({ value, onChange }: { value?: CraftId; onChange: (c: CraftId) => void }) {
  const t = useRoleTheme();
  const { medium } = useLayout();
  return (
    <View style={styles.tiles}>
      {CRAFTS.map((craft) => {
        const on = value === craft.id;
        return (
          <Pressable
            key={craft.id}
            onPress={() => onChange(craft.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={craft.label}
            style={[styles.tile, { width: medium ? '31.5%' : '48%', borderColor: on ? t.c.primary : t.c.border, backgroundColor: t.c.surface }]}>
            <Photo source={photos[craft.image]} style={styles.tileImage} contentFit="cover" />
            <View style={styles.tileText}>
              <View style={styles.row}>
                <Text size={14} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }} numberOfLines={1}>
                  {craft.label}
                </Text>
                {on && <Ionicons name="checkmark-circle" size={18} color={t.c.primary} />}
              </View>
              <Text size={12} color={t.c.muted} numberOfLines={2}>
                {craft.blurb}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Main skill (single) from the craft, then extra skills: the craft and its neighbours first, every other craft on request. */
export function SkillPicker({ draft, onChange }: { draft: FreelancerPersonaDraft; onChange: (d: FreelancerPersonaDraft) => void }) {
  const t = useRoleTheme();
  const craft = CRAFT_BY_ID[draft.craft];
  const nearby = [...new Set([...craft.skills, ...craft.neighbours])].filter((s) => s !== draft.primarySkill);
  const elsewhere = draft.skills.filter((s) => s !== draft.primarySkill && !nearby.includes(s));
  const [showAll, setShowAll] = useState(elsewhere.length > 0);
  const extras = draft.skills.filter((s) => s !== draft.primarySkill);
  const toggle = (skill: string) => {
    const skills = draft.skills.includes(skill) ? draft.skills.filter((s) => s !== skill) : [...draft.skills, skill];
    onChange({ ...draft, skills: skills.includes(draft.primarySkill) ? skills : [draft.primarySkill, ...skills] });
  };
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <Text size={14} weight="semibold" color={t.c.textStrong}>
          Your main skill
        </Text>
        <ChoiceChips options={craft.skills} selected={[draft.primarySkill]} onToggle={(s) => onChange({ ...draft, primarySkill: s, skills: [s, ...draft.skills.filter((x) => x !== s)] })} />
      </View>
      {nearby.length > 0 && (
        <View style={{ gap: 6 }}>
          <Text size={14} weight="semibold" color={t.c.textStrong}>
            Also do ({extras.length})
          </Text>
          <Text size={13} color={t.c.muted}>
            Organisers hire you for these too. Gigs you see follow your skills.
          </Text>
          <ChoiceChips options={nearby} selected={extras.filter((s) => nearby.includes(s))} onToggle={toggle} />
        </View>
      )}
      {showAll ? (
        <View style={{ gap: 10 }}>
          <Text size={14} weight="semibold" color={t.c.textStrong}>
            Skills from other crafts
          </Text>
          {CRAFTS.filter((c) => c.id !== craft.id).map((c) => {
            const ids = c.skills.filter((s) => !nearby.includes(s) && s !== draft.primarySkill);
            if (!ids.length) return null;
            return (
              <View key={c.id} style={{ gap: 6 }}>
                <Text size={13} color={t.c.muted}>
                  {c.label}
                </Text>
                <ChoiceChips options={ids} selected={ids.filter((s) => draft.skills.includes(s))} onToggle={toggle} />
              </View>
            );
          })}
        </View>
      ) : (
        <Pressable onPress={() => setShowAll(true)} accessibilityRole="button" hitSlop={6}>
          <Text size={14} weight="medium" color={t.c.primary}>
            I also work in another craft
          </Text>
        </Pressable>
      )}
    </View>
  );
}

/** The craft's profile questions. */
export function CraftProfileForm({ draft, onChange }: { draft: FreelancerPersonaDraft; onChange: (d: FreelancerPersonaDraft) => void }) {
  return <EssentialFields fields={CRAFT_BY_ID[draft.craft].profile} profile={draft.tradeProfile} onChange={(tradeProfile) => onChange({ ...draft, tradeProfile })} />;
}

/** Read-only answers of a craft profile ("Styles: Candid, Cinematic"). */
export function craftProfileLines(craft: CraftId, profile: Account['tradeProfile']): { label: string; value: string }[] {
  return CRAFT_BY_ID[craft].profile
    .map((f) => {
      const v = profile?.[f.key];
      if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) return null;
      const value = Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? (v ? 'Yes' : 'No') : f.kind === 'number' && f.suffix ? `${v} ${f.suffix}` : String(v);
      return { label: f.label, value };
    })
    .filter((x): x is { label: string; value: string } => !!x);
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  tile: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  tileImage: { width: '100%', height: 84 },
  tileText: { padding: 10, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

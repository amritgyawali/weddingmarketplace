import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Card, KButton, SectionTitle } from '@/components/kit';
import { CraftProfileForm, CraftTiles, draftFromAccount, SkillPicker, type FreelancerPersonaDraft } from '@/components/persona/FreelancerPersona';
import { Hint, ToolPage } from '@/components/toolkit/core';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { CRAFT_BY_ID, type CraftId } from '@/data/crafts';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';

/** Profile → Your craft: main skill, extra skills and the craft profile. */
export default function YourCraft() {
  const t = useRoleTheme();
  const account = useAccount();
  const save = useDb((s) => s.setFreelancerPersona);
  const [draft, setDraft] = useState<FreelancerPersonaDraft>(() => draftFromAccount(account));
  const [error, setError] = useState<string | null>(null);
  const change = (d: FreelancerPersonaDraft) => {
    setDraft(d);
    setError(null);
  };
  // Switching craft keeps the skills already picked; the new craft's usual skill becomes the main one.
  const pickCraft = (craft: CraftId) => {
    if (craft === draft.craft) return;
    const main = CRAFT_BY_ID[craft].skills.find((s) => draft.skills.includes(s)) ?? CRAFT_BY_ID[craft].skills[0];
    change({ ...draft, craft, primarySkill: main, skills: [main, ...draft.skills.filter((s) => s !== main)] });
  };

  const submit = () => {
    const problem = save(account.id, { skills: draft.skills, primarySkill: draft.primarySkill, tradeProfile: draft.tradeProfile });
    if (problem) return setError(problem);
    toast('Your craft is saved');
    if (router.canGoBack()) router.back();
  };

  return (
    <ToolPage title="Your craft" subtitle="Your skills decide your gigs, your profile and your tools">
      {!account.primarySkill && (
        <Card style={{ borderLeftWidth: 3, borderLeftColor: t.c.primary }}>
          <Text size={14} color={t.c.text}>
            Pick your main skill and save, so organisers see the right profile and you only get gigs you can take.
          </Text>
        </Card>
      )}
      <View>
        <SectionTitle title="What’s your craft?" />
        <CraftTiles value={draft.craft} onChange={pickCraft} />
      </View>
      <View>
        <SectionTitle title="Skills" />
        <Card>
          <SkillPicker draft={draft} onChange={change} />
        </Card>
      </View>
      <View>
        <SectionTitle title={`${CRAFT_BY_ID[draft.craft].label} profile`} />
        <Card>
          <CraftProfileForm draft={draft} onChange={change} />
        </Card>
      </View>
      <Hint>Tools you already have records in stay available even if you remove the skill they belong to.</Hint>
      {error && (
        <Text size={14} color={t.c.danger}>
          {error}
        </Text>
      )}
      <KButton label="Save craft" size="lg" onPress={submit} />
    </ToolPage>
  );
}

import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Card, KButton, SectionTitle } from '@/components/kit';
import { draftForTrade, draftFromServices, EssentialsForm, FormPicker, ServicePicker, TradeTiles, type VendorPersonaDraft } from '@/components/persona/VendorPersona';
import { Hint, ToolPage } from '@/components/toolkit/core';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { TRADE_BY_ID } from '@/data/trades';
import { useExperience } from '@/hooks/useExperience';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';

/** Business → Your services: main service, add-ons, business form and trade essentials. */
export default function YourServices() {
  const t = useRoleTheme();
  const account = useAccount();
  const exp = useExperience();
  const save = useDb((s) => s.setProviderPersona);
  const [draft, setDraft] = useState<VendorPersonaDraft>(() => draftFromServices(exp.services, exp.primaryService, exp.form, account));
  const [error, setError] = useState<string | null>(null);
  const change = (d: VendorPersonaDraft) => {
    setDraft(d);
    setError(null);
  };

  const submit = () => {
    const problem = save(account.id, { services: draft.services, primaryService: draft.primaryService, businessForm: draft.businessForm, teamSize: draft.teamSize, tradeProfile: draft.tradeProfile });
    if (problem) return setError(problem);
    toast('Your services are saved');
    if (router.canGoBack()) router.back();
  };

  return (
    <ToolPage title="Your services" subtitle="What you offer decides your tools and your leads">
      {!account.personaConfirmedAt && (
        <Card style={{ borderLeftWidth: 3, borderLeftColor: t.c.primary }}>
          <Text size={14} color={t.c.text}>
            We guessed these from your listing. Check them and save, so we can show you the right tools and send you the right couples.
          </Text>
        </Card>
      )}
      <View>
        <SectionTitle title="What does your business do?" />
        <TradeTiles value={draft.trade} onChange={(trade) => change(trade === draft.trade ? draft : draftForTrade(trade, draft))} />
      </View>
      <View>
        <SectionTitle title="Services" />
        <Card>
          <ServicePicker draft={draft} onChange={change} />
        </Card>
      </View>
      <View>
        <SectionTitle title="How is your business set up?" />
        <FormPicker draft={draft} onChange={change} />
      </View>
      <View>
        <SectionTitle title={`${TRADE_BY_ID[draft.trade].label} essentials`} />
        <Card>
          <EssentialsForm draft={draft} onChange={change} />
        </Card>
      </View>
      <Hint>Tools you already have records in stay available even if you remove the service they belong to.</Hint>
      {error && (
        <Text size={14} color={t.c.danger}>
          {error}
        </Text>
      )}
      <KButton label="Save services" size="lg" onPress={submit} />
    </ToolPage>
  );
}

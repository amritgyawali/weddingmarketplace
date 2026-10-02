import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { KButton, KField } from '@/components/kit';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast, toastError } from '@/components/ui/Toast';
import { socialLive, startSocialConnect } from '@/backend/social';
import { NETWORK_BY_ID, SCOPE_TEXT } from '@/data/social';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { SocialNetwork } from '@/types/platform';

import { NetworkIcon } from './parts';

const HANDLE_LABEL: Record<SocialNetwork, string> = {
  facebook: 'Facebook page name',
  instagram: 'Instagram handle',
  whatsapp: 'WhatsApp Business number',
  tiktok: 'TikTok handle',
};

/**
 * Connecting one network: what Vivah will be allowed to do, in plain words,
 * then the network's own consent page (Supabase builds) or the demo connect.
 */
export function ConnectSheet({ network, onClose }: { network: SocialNetwork | null; onClose: () => void }) {
  const t = useRoleTheme();
  const account = useAccount();
  const connect = useDb((s) => s.connectSocialAccount);
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  const live = socialLive();
  const def = network ? NETWORK_BY_ID[network] : null;

  const close = () => {
    setHandle('');
    onClose();
  };

  const submit = async () => {
    if (!network || !def) return;
    if (live) {
      setBusy(true);
      const res = await startSocialConnect(network);
      setBusy(false);
      if (!res.ok) toastError(res.error);
      else close();
      return;
    }
    const error = connect({ network, handle: handle || (network === 'facebook' ? (account.businessName ?? account.name) : handle) });
    if (error) return;
    toast(`${def.label} connected`, 'checkmark-circle');
    close();
  };

  return (
    <Sheet visible={!!network} onClose={close} title={def ? `Connect ${def.label}` : undefined}>
      {def && network && (
        <View style={{ paddingHorizontal: 20, paddingBottom: 8, gap: 14 }}>
          <View style={styles.row}>
            <NetworkIcon network={network} size={28} />
            <View style={{ flex: 1 }}>
              <Text size={15} weight="semibold" color={t.c.textStrong}>
                {def.requirement}
              </Text>
              <Text size={13} color={t.c.muted}>
                Posts go out as: {def.postAs.toLowerCase()}
              </Text>
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text size={13} weight="medium" color={t.c.text}>
              Vivah will be able to
            </Text>
            {def.scopes.map((s) => (
              <View key={s} style={styles.row}>
                <Ionicons name="checkmark" size={16} color={t.c.success} />
                <Text size={14} color={t.c.text} style={{ flex: 1 }}>
                  {SCOPE_TEXT[s] ?? s}
                </Text>
              </View>
            ))}
          </View>

          {!live && (
            <KField
              label={HANDLE_LABEL[network]}
              value={handle}
              onChangeText={setHandle}
              placeholder={def.handleHint}
              keyboardType={network === 'whatsapp' ? 'phone-pad' : 'default'}
              autoCapitalize={network === 'facebook' ? 'words' : 'none'}
              hint={network === 'facebook' ? 'Leave empty to use your business name' : undefined}
            />
          )}

          <Text size={12} color={t.c.muted}>
            {live
              ? `You sign in on ${def.label}’s own page. Vivah never sees your password, and you can remove access here or in ${def.label} settings at any time.`
              : `Demo: no real ${def.label} account is contacted. In the live app you sign in on ${def.label}’s own page and Vivah never sees your password.`}
          </Text>

          <KButton label={live ? `Continue to ${def.label}` : `Connect ${def.label}`} icon="link-outline" loading={busy} onPress={submit} />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});

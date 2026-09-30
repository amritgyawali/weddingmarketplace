import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, KButton, KField, StatusPill } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { SignatureImage, SignaturePad } from '@/components/work/SignaturePad';
import { contractHtml } from '@/services/documents';
import { sharePdf } from '@/services/exporters';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Contract } from '@/types/platform';
import { formatLongDate, formatTime } from '@/utils/format';

const PARTY_LABEL: Record<Contract['signatures'][number]['party'], string> = { customer: 'Customer', provider: 'Provider', platform: 'Vivah (platform)' };

/**
 * A three-party service agreement with e-signatures. Each party reads every
 * clause, types their name and draws a signature; the contract locks once all
 * three have signed.
 */
export function ContractView({ contract, party, signerName }: { contract: Contract; party?: Contract['signatures'][number]['party']; signerName: string }) {
  const t = useRoleTheme();
  const sign = useDb((s) => s.signContract);
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState(signerName);
  const [path, setPath] = useState<string | null>(null);
  const mine = party ? contract.signatures.find((s) => s.party === party) : undefined;
  const canSign = !!party && !mine && contract.status !== 'void' && contract.status !== 'signed';

  return (
    <View style={{ gap: 14 }}>
      <Card style={{ gap: 6 }}>
        <View style={styles.between}>
          <Text size={12} weight="bold" color={t.c.muted}>
            {contract.number} · v{contract.version}
          </Text>
          <StatusPill status={contract.status} />
        </View>
        <Text size={18} weight="bold" color={t.c.textStrong}>
          {contract.title}
        </Text>
        <Text size={13} color={t.c.muted}>
          {contract.parties.customer} · {contract.parties.provider} · {contract.parties.platform}
        </Text>
      </Card>

      {contract.sections.map((s, i) => (
        <View key={s.heading} style={{ gap: 4 }}>
          <Text size={14} weight="bold" color={t.c.textStrong}>
            {i + 1}. {s.heading}
          </Text>
          <Text size={14} color={t.c.text} lineHeight={21}>
            {s.body}
          </Text>
        </View>
      ))}

      <Card style={{ gap: 10 }}>
        <Text size={15} weight="bold" color={t.c.textStrong}>
          Signatures
        </Text>
        {(['customer', 'provider', 'platform'] as const).map((p) => {
          const sig = contract.signatures.find((s) => s.party === p);
          return (
            <View key={p} style={[styles.sig, { borderColor: t.c.border }]}>
              <View style={{ flex: 1 }}>
                <Text size={12} weight="medium" color={t.c.muted}>
                  {PARTY_LABEL[p]}
                </Text>
                <Text size={14} weight="semibold" color={t.c.textStrong}>
                  {sig ? sig.name : contract.parties[p]}
                </Text>
                <Text size={12} color={sig ? t.c.success : t.c.subtle}>
                  {sig ? `Signed ${formatLongDate(sig.at)} · ${formatTime(sig.at)}` : 'Awaiting signature'}
                </Text>
              </View>
              {sig?.path ? <SignatureImage path={sig.path} height={44} /> : <Ionicons name={sig ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={sig ? t.c.success : t.c.subtle} />}
            </View>
          );
        })}
      </Card>

      {canSign && (
        <Card style={{ gap: 12, borderColor: t.c.primary }}>
          <Text size={15} weight="bold" color={t.c.textStrong}>
            Sign as {PARTY_LABEL[party!].toLowerCase()}
          </Text>
          <KField label="Full legal name" value={name} onChangeText={setName} />
          <SignaturePad onDone={setPath} />
          {path && (
            <Text size={12} color={t.c.success}>
              Signature captured ✓
            </Text>
          )}
          <KButton label={agreed ? '✓ I have read and agree to every clause' : 'I have read and agree to every clause'} variant={agreed ? 'secondary' : 'ghost'} size="sm" onPress={() => setAgreed((a) => !a)} />
          <KButton
            label="Sign contract"
            icon="create-outline"
            disabled={!agreed || !path || name.trim().length < 3}
            onPress={() => {
              sign(contract.id, party!, name.trim(), path ?? undefined);
              triggerHaptic('success');
              toast('Contract signed', 'document-lock');
            }}
          />
          <Text size={11} color={t.c.subtle}>
            Your signature, name and time are recorded in the audit log. Electronic signatures are valid under Nepal’s Electronic Transactions Act, 2063.
          </Text>
        </Card>
      )}

      <KButton label="Download PDF" icon="download-outline" variant="secondary" onPress={() => sharePdf(contractHtml(contract), contract.number)} />
    </View>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  sig: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 8, padding: 10 },
});

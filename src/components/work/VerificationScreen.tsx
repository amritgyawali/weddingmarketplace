import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { ScrollView, StyleSheet, View } from 'react-native';

import { privateFilesReady, uploadDocument } from '@/backend/files';
import { Card, KButton, SectionTitle, StackHeader, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatShortDate } from '@/utils/format';

const DOCS = ['PAN/VAT certificate', 'Company registration (OCR)', 'Citizenship / passport', 'Bank cheque / statement', 'Portfolio links'];
const STEPS = ['UNVERIFIED', 'DOCUMENT_SUBMITTED', 'UNDER_REVIEW', 'VERIFIED'];

/** Provider KYC: upload documents and follow the review. Shared by freelancers too. */
export function VerificationScreen() {
  const t = useRoleTheme();
  const account = useAccount();
  const verifications = useDb((s) => s.verifications);
  const submit = useDb((s) => s.submitForApproval);
  const addDoc = useDb((s) => s.addVerificationDocument);
  const vc = verifications.find((v) => v.subjectId === (account.listingId ?? account.id) || v.subjectId === account.id);
  const status = vc?.status ?? (account.verified ? 'VERIFIED' : 'UNVERIFIED');

  const upload = async (kind: string) => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true, type: ['application/pdf', 'image/*'] });
    if (res.canceled || !res.assets?.[0]) return;
    const file = res.assets[0];
    // Supabase builds keep KYC papers in the private documents bucket; the demo only records the name.
    let path: string | undefined;
    if (privateFilesReady()) {
      const up = await uploadDocument({ uri: file.uri, name: file.name, mimeType: file.mimeType }, 'kyc');
      if (!up.ok) return toast(up.error, 'alert-circle');
      path = up.value;
    }
    if (!vc) submit(account);
    const current = useDb.getState().verifications.find((v) => v.subjectId === (account.listingId ?? account.id) || v.subjectId === account.id);
    if (current) addDoc(current.id, { kind, name: file.name, path });
    toast(`${kind} uploaded`, 'cloud-upload');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Verification" subtitle="Get the Verified badge and rank higher in matching" right={<StatusPill status={status} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <Card style={{ gap: 12 }}>
          {STEPS.map((s, i) => {
            const reached = STEPS.indexOf(status) >= i || status === 'VERIFIED';
            return (
              <View key={s} style={styles.row}>
                <Ionicons name={reached ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={reached ? t.c.success : t.c.border} />
                <Text size={14} weight={status === s ? 'bold' : 'regular'} color={t.c.textStrong}>
                  {s.replace('_', ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase())}
                </Text>
              </View>
            );
          })}
          {(status === 'REJECTED' || status === 'SUSPENDED') && (
            <Text size={13} color={t.c.danger}>
              {status === 'REJECTED' ? 'Your documents were rejected' : 'Your account is suspended'}{vc?.notes ? `: ${vc.notes}` : ''}. Upload corrected documents to resubmit.
            </Text>
          )}
          {vc?.expiresAt && (
            <Text size={12} color={t.c.warning}>
              Re-verification due {formatShortDate(vc.expiresAt)}
            </Text>
          )}
        </Card>
        {vc && (
          <Card style={{ gap: 8 }}>
            <SectionTitle title="Checks" />
            {Object.entries(vc.checks).map(([k, v]) => (
              <View key={k} style={styles.rowBetween}>
                <Text size={13} color={t.c.text}>
                  {k.charAt(0).toUpperCase() + k.slice(1)}
                </Text>
                <StatusPill status={v === 'passed' ? 'verified' : v === 'failed' ? 'rejected' : 'pending'} label={v} />
              </View>
            ))}
          </Card>
        )}
        <Card style={{ gap: 10 }}>
          <SectionTitle title="Documents" />
          {DOCS.map((d) => {
            const uploaded = vc?.documents.find((x) => x.kind === d || x.kind.startsWith(d.split(' ')[0]));
            return (
              <View key={d} style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text size={14} weight="semibold" color={t.c.textStrong}>
                    {d}
                  </Text>
                  <Text size={12} color={t.c.muted}>
                    {uploaded ? `${uploaded.name} · ${uploaded.status}` : 'Not uploaded'}
                  </Text>
                </View>
                <KButton label={uploaded ? 'Replace' : 'Upload'} size="sm" variant="secondary" onPress={() => upload(d)} />
              </View>
            );
          })}
        </Card>
        {!vc && !account.verified && <KButton label="Submit for review" icon="shield-checkmark-outline" onPress={() => { submit(account); toast('Submitted — usually reviewed within 24 hours'); }} />}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});

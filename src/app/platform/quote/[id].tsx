import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { EmptyBlock, KButton, StackHeader, StatusPill } from '@/components/kit';
import { toast } from '@/components/ui/Toast';
import { QuoteDocument } from '@/components/work/QuoteDocument';
import { QuoteEditor } from '@/components/work/QuoteEditor';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';

/**
 * Package quote builder (id = quote id, or "new" with ?projectId). Vendor
 * quotes open read-only so ops can audit pricing.
 */
export default function PlatformQuote() {
  const t = useRoleTheme();
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId?: string }>();
  const existing = useDb((s) => s.quotes.find((q) => q.id === id));
  const project = useDb((s) => s.projects.find((p) => p.id === (existing?.projectId ?? projectId)));
  const draft = useDb((s) => s.draftProjectQuote);
  const saveQuote = useDb((s) => s.saveQuote);
  const sendQuote = useDb((s) => s.sendQuote);
  const reviseQuote = useDb((s) => s.reviseQuote);
  if (!existing) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <StackHeader title="Quotation" />
        {project ? (
          <EmptyBlock
            icon="document-text-outline"
            title="Build the package quotation"
            message="Selected providers become quote lines you can price, discount and send."
            action="Build quote"
            onAction={() => {
              const q = draft(project.id);
              if (q) router.replace({ pathname: '/platform/quote/[id]', params: { id: q.id } });
            }}
          />
        ) : (
          <EmptyBlock title="Quotation not found" />
        )}
      </View>
    );
  }

  const current = existing;
  const editable = current.fromKind === 'platform' && current.status === 'draft';

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title={current.number} subtitle={`${current.customerName} · v${current.version} · ${current.fromName}`} right={<StatusPill status={current.status} />} />
      {editable ? (
        <QuoteEditor
          key={`${current.id}-${current.version}`}
          initial={current}
          project={project}
          internal
          onSave={(quote, send, summary) => {
            saveQuote(quote);
            if (send) {
              sendQuote(quote.id, summary);
              toast(`${quote.number} v${quote.version} sent to ${quote.customerName}`, 'paper-plane');
            } else toast('Draft saved');
            router.back();
          }}
        />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 12 }}>
          <QuoteDocument quote={current} />
          {current.fromKind === 'platform' && (current.status === 'revision' || current.status === 'sent' || current.status === 'viewed') && (
            <KButton label={`Prepare version ${current.versions.length + 1}`} icon="create-outline" onPress={() => reviseQuote(current.id)} />
          )}
        </ScrollView>
      )}
    </View>
  );
}

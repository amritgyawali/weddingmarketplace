import { useState } from 'react';

import { Card, KButton, KField } from '@/components/kit';
import { Hint } from '@/components/toolkit/core';
import { toast, toastError } from '@/components/ui/Toast';
import { BRAND_DEFAULTS, BRAND_FIELDS, type BrandField } from '@/constants/brand';
import { useContent } from '@/hooks/useContent';
import { useDb } from '@/store/useDb';
import { quietly } from '@/store/quiet';
import { confirm } from '@/utils/confirm';

const LABELS: Record<BrandField, { label: string; hint?: string }> = {
  name: { label: 'App name', hint: 'Shown in greetings, messages and the assistant' },
  genieService: { label: 'Planner service name' },
  genieTagline: { label: 'Planner service tagline' },
  assistantName: { label: 'Assistant name' },
  assistantTitle: { label: 'Assistant title' },
  assistantSubtitle: { label: 'Assistant subtitle', hint: 'The line under the assistant’s title' },
  supportPhone: { label: 'Support phone', hint: 'With the country code, e.g. +9779801000000' },
  supportWhatsApp: { label: 'Support WhatsApp', hint: 'Digits only, with the country code' },
  supportEmail: { label: 'Support email' },
  legalEntity: { label: 'Registered business name' },
  registeredAddress: { label: 'Registered address' },
  reviewCount: { label: 'Review count shown to visitors' },
};

/** The app's name, the assistant's wording and how people reach support. */
export function BrandTab() {
  const brand = useContent().brand;
  const setField = useDb((s) => s.setBrandField);
  const reset = useDb((s) => s.resetContent);
  const [draft, setDraft] = useState<Partial<Record<BrandField, string>>>({});

  const valueOf = (f: BrandField) => draft[f] ?? brand[f] ?? BRAND_DEFAULTS[f];
  const edited = BRAND_FIELDS.filter((f) => draft[f] !== undefined && draft[f]?.trim() !== (brand[f] ?? BRAND_DEFAULTS[f]));

  const save = () => {
    // One confirmation for the whole form, not one per field.
    const error = quietly(() => {
      for (const f of edited) {
        const err = setField(f, draft[f] ?? '');
        if (err) return `${LABELS[f].label}: ${err}`;
      }
      return null;
    });
    if (error) return toastError(error);
    setDraft({});
    toast('Details saved');
  };

  return (
    <>
      <Hint>These details appear across all four apps. The legal pages keep the wording they were published with; ask a developer when the registered business changes.</Hint>
      <Card style={{ gap: 12 }}>
        {BRAND_FIELDS.map((f) => (
          <KField
            key={f}
            label={LABELS[f].label}
            hint={LABELS[f].hint}
            value={valueOf(f)}
            onChangeText={(v) => setDraft({ ...draft, [f]: v })}
            placeholder={BRAND_DEFAULTS[f]}
            autoCorrect={false}
            autoCapitalize={f.startsWith('support') ? 'none' : 'sentences'}
            keyboardType={f === 'supportPhone' || f === 'supportWhatsApp' ? 'phone-pad' : f === 'supportEmail' ? 'email-address' : 'default'}
            maxLength={120}
          />
        ))}
      </Card>
      <KButton label="Save details" icon="checkmark" disabled={edited.length === 0} onPress={save} />
      {Object.keys(brand).length > 0 && (
        <KButton
          label="Restore the original details"
          variant="ghost"
          icon="refresh-outline"
          onPress={() =>
            confirm('Restore the original details?', 'The name, assistant wording and support contacts go back to what the app shipped with.', 'Restore', () => {
              const err = reset('brand');
              if (err) toastError(err);
              setDraft({});
            })
          }
        />
      )}
    </>
  );
}

import { useState } from 'react';

/**
 * Validation for a small form. Give each field the message to show while it
 * is empty or wrong (or a falsy value when it is fine):
 *
 *   const check = useFormCheck({ title: !title.trim() && 'Enter a title' });
 *   <KField error={check.error('title')} … />
 *   <KButton missing={check.missing} onMissing={check.reveal} onPress={save} />
 *
 * The submit button stays tappable: a tap on an incomplete form shows the
 * first message as a toast and, from then on, each field's own message under
 * it until it is filled in.
 */
export function useFormCheck<K extends string>(rules: Record<K, string | false | null | undefined | 0>) {
  const [shown, setShown] = useState(false);
  const first = (Object.values(rules) as (string | false | null | undefined | 0)[]).find((m): m is string => typeof m === 'string' && !!m) ?? null;
  return {
    /** The first problem, for the button's `missing` prop; null when the form is complete. */
    missing: first,
    /** A field's message once the person has tried to submit. */
    error: (key: K): string | null => (shown && typeof rules[key] === 'string' && rules[key] ? (rules[key] as string) : null),
    /** Marks the empty fields (pass to `onMissing`). */
    reveal: () => setShown(true),
    /** Hides the messages again, e.g. after the form was saved and cleared. */
    reset: () => setShown(false),
  };
}

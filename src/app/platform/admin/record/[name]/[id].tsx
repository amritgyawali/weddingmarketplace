import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { COLLECTION_BY_KEY, FieldEditor, RecordFields, recordTitle } from '@/components/admin/shared';
import { EmptyBlock, KButton } from '@/components/kit';
import { staffScreen } from '@/components/persona/StaffGate';
import { Hint, ToolPage } from '@/components/toolkit/core';
import { toast, toastError } from '@/components/ui/Toast';
import type { DbData } from '@/store/db/types';
import { useDb } from '@/store/useDb';
import { confirm } from '@/utils/confirm';
import { uid } from '@/utils/format';

type Value = string | number | boolean | null | object;

/** One record of any collection: change any field, duplicate it or delete it. */
function RecordScreen() {
  const { name, id } = useLocalSearchParams<{ name: string; id: string }>();
  const key = name as keyof DbData;
  const meta = COLLECTION_BY_KEY[key];
  const collection = useDb((s) => s[key]) as unknown;
  const save = useDb((s) => s.adminSaveRecord);
  const insert = useDb((s) => s.adminInsertRecord);
  const removeMany = useDb((s) => s.adminDeleteRecords);
  const isSettings = key === 'settings';
  const original: unknown = isSettings
    ? collection
    : Array.isArray(collection)
      ? collection.find((r) => (r as { id?: unknown })?.id === id)
      : collection && typeof collection === 'object'
        ? (collection as Record<string, unknown>)[id]
        : undefined;
  const [draft, setDraft] = useState<Value | undefined>(() => (original === undefined ? undefined : (JSON.parse(JSON.stringify(original)) as Value)));
  const [dirty, setDirty] = useState(false);

  if (!meta || original === undefined || draft === undefined) {
    return (
      <ToolPage title="Record">
        <EmptyBlock icon="document-outline" title="Record not found" message="It may have been deleted." action="Back" onAction={() => router.back()} />
      </ToolPage>
    );
  }

  const isObject = draft !== null && typeof draft === 'object' && !Array.isArray(draft);
  const update = (next: Value) => {
    setDraft(next);
    setDirty(true);
  };

  const submit = () => {
    const err = save(key, id, draft);
    if (err) return toastError(err);
    setDirty(false);
    toast('Record saved');
  };

  const duplicate = () => {
    const copy = isObject ? { ...(draft as Record<string, unknown>), id: uid(String(key).slice(0, 4)) } : draft;
    const res = insert(key, copy, Array.isArray(collection) ? undefined : `${id}_copy`);
    if (res.error) return toastError(res.error);
    toast('Copy made');
    router.replace({ pathname: '/platform/admin/record/[name]/[id]', params: { name: key, id: res.id! } });
  };

  return (
    <ToolPage title={recordTitle(id, original)} subtitle={`${meta.label} · ${id}`}>
      <Hint>Change any field, then save. Lists and nested details are JSON; the editor tells you if the JSON isn’t valid.</Hint>
      {isObject ? (
        <RecordFields record={draft as Record<string, Value>} lockedKeys={['id']} onChange={(next) => update(next)} />
      ) : (
        <FieldEditor name={id} value={draft} onChange={update} />
      )}
      <KButton label={dirty ? 'Save changes' : 'Saved'} icon="checkmark" size="lg" disabled={!dirty} onPress={submit} />
      {!isSettings && key !== 'audit' && (
        <>
          <KButton label="Duplicate" icon="copy-outline" variant="secondary" onPress={duplicate} />
          <KButton
            label="Delete record"
            icon="trash-outline"
            variant="danger"
            onPress={() =>
              confirm('Delete this record?', 'It is removed for everyone. Other records that point at it may show it as missing.', 'Delete', () => {
                const err = removeMany(key, [id]);
                if (err) return toastError(err);
                toast('Deleted');
                router.back();
              })
            }
          />
        </>
      )}
    </ToolPage>
  );
}

export default staffScreen('/platform/admin/record', RecordScreen);

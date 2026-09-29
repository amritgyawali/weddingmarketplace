import { useCallback, useSyncExternalStore } from 'react';

interface PersistApi {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
}

/** True once a zustand `persist` store has been restored from AsyncStorage. */
export function useHydrated(store: PersistApi) {
  const subscribe = useCallback((onChange: () => void) => store.persist.onFinishHydration(onChange), [store]);
  const getSnapshot = useCallback(() => store.persist.hasHydrated(), [store]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

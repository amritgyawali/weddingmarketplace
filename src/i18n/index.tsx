/**
 * Language and calendar preferences (per device) and the React side of the
 * translation runtime. `I18nProvider` sits at the root; `Text`, fields,
 * toasts and alerts translate through it, so screens keep writing English.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, type ReactNode } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { useDb } from '@/store/useDb';

import { runtime, translate, type CalendarMode, type Lang, type TextOverrides } from './runtime';

export { tr, translate } from './runtime';
export type { CalendarMode, Lang, TextOverrides } from './runtime';

interface PrefsState {
  lang: Lang;
  calendar: CalendarMode;
  setLang: (lang: Lang) => void;
  setCalendar: (calendar: CalendarMode) => void;
}

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      lang: 'en',
      calendar: 'bs',
      setLang: (lang) => set({ lang }),
      setCalendar: (calendar) => set({ calendar }),
    }),
    {
      name: 'vivah-prefs',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ lang: s.lang, calendar: s.calendar }),
    },
  ),
);

const sync = (s: Pick<PrefsState, 'lang' | 'calendar'>) => {
  runtime.lang = s.lang;
  runtime.calendar = s.calendar;
};
sync(usePrefs.getState());
usePrefs.subscribe(sync);

const EMPTY: TextOverrides = {};
// Text overrides edited in the super admin console reach non-React callers (alerts, toasts) too.
runtime.overrides = useDb.getState().textOverrides ?? EMPTY;
useDb.subscribe((s) => {
  runtime.overrides = s.textOverrides ?? EMPTY;
});

interface I18nValue {
  /** False in English with no overrides: text renders untouched. */
  active: boolean;
  lang: Lang;
  calendar: CalendarMode;
  overrides: TextOverrides;
}

const I18nContext = createContext<I18nValue>({ active: false, lang: 'en', calendar: 'bs', overrides: EMPTY });

/** Re-renders the tree when the language, calendar or a text override changes. */
export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = usePrefs((s) => s.lang);
  const calendar = usePrefs((s) => s.calendar);
  const overrides = useDb((s) => s.textOverrides) ?? EMPTY;
  const active = lang !== 'en' || Object.keys(overrides).length > 0;
  return <I18nContext.Provider value={{ active, lang, calendar, overrides }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);

/** `t('Save')` in the current language; re-renders on language change. */
export function useT() {
  const { lang, overrides } = useContext(I18nContext);
  return (text: string) => translate(text, lang, overrides);
}

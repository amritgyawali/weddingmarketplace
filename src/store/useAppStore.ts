import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { ALL_CITIES } from '@/data/cities';
import type { Booking, BookingStatus, ChatMessage, Conversation, Role } from '@/types';
import { uid } from '@/utils/format';

export interface Profile {
  name: string;
  email: string;
  phone: string;
  partnerName: string;
}

export interface WrittenReview {
  id: string;
  targetName: string;
  rating: number;
  text: string;
  createdAt: string;
}

interface AppState {
  /** Account id of the couple this device data belongs to. */
  ownerId: string | null;
  hasOnboarded: boolean;
  role: Role | null;
  weddingDate: string | null;
  city: string;
  /** Rough guest count from onboarding; prefills the plan wizard. */
  guests: number | null;
  /** Rough overall budget in NPR from onboarding (null = not sure yet). */
  budget: number | null;
  profile: Profile;
  shortlist: { venues: string[]; vendors: string[] };
  likedPhotos: string[];
  completedTasks: string[];
  bookings: Booking[];
  conversations: Conversation[];
  recentSearches: string[];
  joinedWeddings: string[];
  reviews: WrittenReview[];
  /** The celebration the planner is working on when the couple has several (null = the newest). */
  activeProjectId: string | null;
}

interface AppActions {
  /** Attach local data to the signed-in couple; a different couple starts fresh. */
  bindOwner: (account: { id: string; name: string; phone: string; email?: string; city: string }, preset?: Partial<AppState>) => void;
  setRole: (role: Role) => void;
  setWeddingDate: (date: string | null) => void;
  setCity: (city: string) => void;
  /** Save the onboarding answers in one go. */
  saveWeddingBasics: (basics: Partial<Pick<AppState, 'role' | 'weddingDate' | 'city' | 'guests' | 'budget'>> & { partnerName?: string }) => void;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
  /** Switches the planner to another of the couple's celebrations. */
  setActiveProject: (projectId: string | null) => void;
  updateProfile: (patch: Partial<Profile>) => void;
  toggleShortlist: (kind: 'venues' | 'vendors', id: string) => boolean;
  toggleLike: (photoId: string) => boolean;
  toggleTask: (taskId: string) => void;
  addBooking: (booking: Omit<Booking, 'id' | 'createdAt' | 'status'>) => Booking;
  setBookingStatus: (id: string, status: BookingStatus) => void;
  openConversation: (c: Pick<Conversation, 'kind' | 'refId' | 'title' | 'image'>) => string;
  sendMessage: (conversationId: string, text: string) => void;
  markRead: (conversationId: string) => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  joinWedding: (code: string) => void;
  addReview: (review: Omit<WrittenReview, 'id' | 'createdAt'>) => void;
  signOut: () => void;
}

export type AppStore = AppState & AppActions;

const initialState: AppState = {
  ownerId: null,
  hasOnboarded: false,
  role: null,
  weddingDate: null,
  city: ALL_CITIES,
  guests: null,
  budget: null,
  profile: { name: '', email: '', phone: '', partnerName: '' },
  shortlist: { venues: [], vendors: [] },
  likedPhotos: [],
  completedTasks: [],
  bookings: [],
  conversations: [],
  recentSearches: [],
  joinedWeddings: [],
  reviews: [],
  activeProjectId: null,
};

const VENDOR_REPLIES = [
  'Thank you for reaching out! We would love to be a part of your celebrations. Could you share your wedding date and approximate guest count?',
  'Hi! Thanks for your interest. Our team will share the detailed brochure and pricing with you shortly.',
  'Great to hear from you! We have a few dates open in your season — shall we schedule a quick call or a site visit?',
];

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

const now = () => new Date().toISOString();

/** Pending simulated vendor replies, cleared on sign-out. */
const replyTimers = new Set<ReturnType<typeof setTimeout>>();

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      bindOwner: (account, preset) => {
        if (get().ownerId === account.id) return;
        replyTimers.forEach(clearTimeout);
        replyTimers.clear();
        set({
          ...initialState,
          ownerId: account.id,
          profile: { name: account.name, email: account.email ?? '', phone: account.phone, partnerName: '' },
          ...preset,
        });
      },

      setRole: (role) => set({ role }),
      setWeddingDate: (weddingDate) => set({ weddingDate }),
      setCity: (city) => set({ city }),
      saveWeddingBasics: ({ partnerName, ...basics }) =>
        set((s) => ({ ...basics, profile: partnerName === undefined ? s.profile : { ...s.profile, partnerName } })),
      completeOnboarding: () => set({ hasOnboarded: true }),
      resetOnboarding: () => set({ hasOnboarded: false }),
      setActiveProject: (activeProjectId) => set({ activeProjectId }),
      updateProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      toggleShortlist: (kind, id) => {
        const next = toggle(get().shortlist[kind], id);
        set((s) => ({ shortlist: { ...s.shortlist, [kind]: next } }));
        return next.includes(id);
      },

      toggleLike: (photoId) => {
        const next = toggle(get().likedPhotos, photoId);
        set({ likedPhotos: next });
        return next.includes(photoId);
      },

      toggleTask: (taskId) => set((s) => ({ completedTasks: toggle(s.completedTasks, taskId) })),

      addBooking: (input) => {
        const booking: Booking = { ...input, id: uid('bk'), status: 'pending', createdAt: now() };
        set((s) => ({ bookings: [booking, ...s.bookings] }));
        return booking;
      },

      setBookingStatus: (id, status) =>
        set((s) => ({ bookings: s.bookings.map((b) => (b.id === id ? { ...b, status } : b)) })),

      openConversation: ({ kind, refId, title, image }) => {
        const existing = get().conversations.find((c) => c.kind === kind && c.refId === refId);
        if (existing) return existing.id;
        const conversation: Conversation = { id: uid('cv'), kind, refId, title, image, messages: [], unread: 0 };
        set((s) => ({ conversations: [conversation, ...s.conversations] }));
        return conversation.id;
      },

      sendMessage: (conversationId, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const mine: ChatMessage = { id: uid('m'), from: 'me', text: trimmed, at: now() };
        const conversation = get().conversations.find((c) => c.id === conversationId);
        const isFirstMessage = !conversation?.messages.some((m) => m.from === 'me');
        set((s) => ({
          conversations: s.conversations
            .map((c) => (c.id === conversationId ? { ...c, messages: [...c.messages, mine] } : c))
            .sort((a, b) => (a.id === conversationId ? -1 : b.id === conversationId ? 1 : 0)),
        }));

        // Simulated vendor response until a real messaging backend is wired up.
        const timer = setTimeout(() => {
          replyTimers.delete(timer);
          const replyText = isFirstMessage
            ? VENDOR_REPLIES[0]
            : VENDOR_REPLIES[1 + Math.floor(Math.random() * (VENDOR_REPLIES.length - 1))];
          const reply: ChatMessage = { id: uid('m'), from: 'them', text: replyText, at: now() };
          set((s) => ({
            conversations: s.conversations.map((c) =>
              c.id === conversationId ? { ...c, messages: [...c.messages, reply], unread: c.unread + 1 } : c,
            ),
          }));
        }, 1800);
        replyTimers.add(timer);
      },

      markRead: (conversationId) =>
        set((s) => ({
          conversations: s.conversations.map((c) => (c.id === conversationId ? { ...c, unread: 0 } : c)),
        })),

      addRecentSearch: (query) => {
        const q = query.trim();
        if (!q) return;
        set((s) => ({
          recentSearches: [q, ...s.recentSearches.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(0, 8),
        }));
      },

      clearRecentSearches: () => set({ recentSearches: [] }),

      joinWedding: (code) =>
        set((s) => ({ joinedWeddings: [...new Set([...s.joinedWeddings, code.trim().toUpperCase()])] })),

      addReview: (review) =>
        set((s) => ({ reviews: [{ ...review, id: uid('rv'), createdAt: now() }, ...s.reviews] })),

      signOut: () => {
        replyTimers.forEach(clearTimeout);
        replyTimers.clear();
        set(initialState);
      },
    }),
    {
      name: 'vivah-app-store',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      // Persist data only — actions are recreated on every launch.
      partialize: (state): AppState =>
        Object.fromEntries(
          (Object.keys(initialState) as (keyof AppState)[]).map((key) => [key, state[key]]),
        ) as unknown as AppState,
    },
  ),
);

/** Derived selectors kept outside components so they stay referentially stable. */
export const selectUnreadCount = (s: AppStore) => s.conversations.reduce((sum, c) => sum + c.unread, 0);
export const selectShortlistCount = (s: AppStore) => s.shortlist.venues.length + s.shortlist.vendors.length;

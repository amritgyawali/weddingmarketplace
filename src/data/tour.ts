/**
 * The steps of the couple's first-run tour. A step with a `target` points at
 * the element wrapped in `<TourTarget id=…>`; when that element isn't on
 * screen (a tab switched off, no Ideas for a pasni) the step is skipped.
 */
export interface TourStep {
  id: string;
  target?: string;
  title: string;
  body: string;
  /** Shown instead of `body` when the couple already has a plan. */
  bodyWithPlan?: string;
}

export const COUPLE_TOUR: TourStep[] = [
  {
    id: 'welcome',
    title: 'Namaste! Welcome to Vivah',
    body: 'A quick look at the main things you can do here. It takes less than a minute.',
  },
  {
    id: 'search',
    target: 'search',
    title: 'Search anything',
    body: 'Type a name or a service: a venue, a photographer, makeup, a pandit.',
  },
  {
    id: 'venues',
    target: 'tab.venues',
    title: 'Find a venue',
    body: 'Party palaces, banquets, hotels and resorts in your city, with prices and photos. Tap the bookmark to save one.',
  },
  {
    id: 'vendors',
    target: 'tab.vendors',
    title: 'Book vendors',
    body: 'Photographers, decorators, makeup artists, caterers, bands and more. Send an enquiry to get a quote.',
  },
  {
    id: 'ideas',
    target: 'tab.ideas',
    title: 'Get ideas',
    body: 'Real Nepali weddings and photos to help you choose a style.',
  },
  {
    id: 'wedding',
    target: 'tab.wedding',
    title: 'Your wedding in one place',
    body: 'Your plan, quotations, payments, checklist, guests and your coordinator all live here.',
  },
  {
    id: 'messages',
    target: 'messages',
    title: 'Messages',
    body: 'Chat with vendors and your coordinator. Replies show up here.',
  },
  {
    id: 'menu',
    target: 'menu',
    title: 'Menu',
    body: 'Your shortlist, enquiries, budget, settings and language. You can watch this tour again from here.',
  },
  {
    id: 'done',
    title: "You're ready",
    body: 'Tell us your date, city and budget, and a coordinator will match venues and vendors for you. Or look around first.',
    bodyWithPlan: 'Your plan is under way. "Next up" on the home screen always shows the one thing to do now.',
  },
];

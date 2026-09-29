import type { ChecklistPhase, ChecklistTask } from '@/types';

const RAW: Record<ChecklistPhase, [string, string][]> = {
  '12+ Months': [
    ['Research Venue options', 'Venue'],
    ['Research Wedding Planners', 'Planning'],
    ['Discuss the overall wedding budget with family', 'Budget'],
    ['Draft a tentative guest list', 'Guests'],
    ['Shortlist wedding dates with your pandit', 'Rituals'],
    ['Decide the wedding theme & functions', 'Planning'],
    ['Create a wedding website or shared planning folder', 'Planning'],
    ['Start a wedding savings plan', 'Budget'],
  ],
  '9-12 Months': [
    ['Book the wedding venue', 'Venue'],
    ['Book a wedding planner or Genie package', 'Planning'],
    ['Shortlist and book photographers', 'Photography'],
    ['Shortlist and book cinematographers', 'Photography'],
    ['Book the decorator', 'Decor'],
    ['Block hotel rooms for outstation guests', 'Guests'],
    ['Start bridal lehenga / outfit shopping', 'Outfits'],
    ['Plan the pre-wedding shoot location', 'Photography'],
    ['Book the caterer and schedule a tasting', 'Food'],
  ],
  '6-9 Months': [
    ['Book the bridal makeup artist', 'Beauty'],
    ['Book the mehendi artist', 'Beauty'],
    ['Book DJ / live band for sangeet', 'Entertainment'],
    ['Book a sangeet choreographer', 'Entertainment'],
    ['Finalise groom wear', 'Outfits'],
    ['Shortlist wedding invitation designs', 'Invites'],
    ['Plan honeymoon and check passport validity', 'Honeymoon'],
    ['Start a skincare & fitness routine', 'Beauty'],
    ['Book the pandit for all rituals', 'Rituals'],
  ],
  '3-6 Months': [
    ['Order wedding invitations & e-invites', 'Invites'],
    ['Finalise the guest list', 'Guests'],
    ['Buy wedding jewellery', 'Outfits'],
    ['Do the pre-wedding shoot', 'Photography'],
    ['Plan trousseau packing', 'Outfits'],
    ['Book transport for baraat & guests', 'Logistics'],
    ['Finalise the menu for every function', 'Food'],
    ['Book the honeymoon', 'Honeymoon'],
    ['Plan return gifts & favours', 'Gifts'],
  ],
  '1-3 Months': [
    ['Send out wedding invitations', 'Invites'],
    ['Makeup & hair trial', 'Beauty'],
    ['Final outfit fittings', 'Outfits'],
    ['Confirm decor mood board with decorator', 'Decor'],
    ['Create function-wise music playlists', 'Entertainment'],
    ['Plan the guest welcome kits', 'Guests'],
    ['Apply for marriage registration', 'Legal'],
    ['Buy wedding rings', 'Outfits'],
    ['Start sangeet dance rehearsals', 'Entertainment'],
  ],
  '2-4 Weeks': [
    ['Share final headcount with caterer', 'Food'],
    ['Confirm all vendor bookings & timings', 'Planning'],
    ['Prepare a day-of timeline for each function', 'Planning'],
    ['Arrange cash envelopes for vendor payments', 'Budget'],
    ['Assign family point-persons for each function', 'Planning'],
    ['Pack the emergency wedding kit', 'Logistics'],
    ['Break in your wedding footwear', 'Outfits'],
  ],
  '1 Week': [
    ['Get a relaxing spa / facial session', 'Beauty'],
    ['Collect all outfits & jewellery', 'Outfits'],
    ['Share the shot list with photographers', 'Photography'],
    ['Reconfirm guest travel & room allocation', 'Guests'],
    ['Hand over gifts & favours to the planner', 'Gifts'],
    ['Pack for the honeymoon', 'Honeymoon'],
    ['Confirm pick-ups for vendors & family', 'Logistics'],
  ],
  'Wedding Day': [
    ['Eat a proper breakfast & stay hydrated', 'Wellness'],
    ['Keep the rings and documents handy', 'Rituals'],
    ['Soak in every moment & enjoy!', 'Wellness'],
  ],
};

export const CHECKLIST_PHASES = Object.keys(RAW) as ChecklistPhase[];

export const CHECKLIST: ChecklistTask[] = CHECKLIST_PHASES.flatMap((phase, p) =>
  RAW[phase].map(([title, category], i) => ({ id: `t${p + 1}-${i + 1}`, title, phase, category })),
);

export const CHECKLIST_TOTAL = CHECKLIST.length;

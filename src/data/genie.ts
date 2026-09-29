import { BRAND } from '@/constants/brand';
import type { Faq, GeniePackage, Testimonial } from '@/types';

export const GENIE_PACKAGES: GeniePackage[] = [
  {
    id: 'single',
    title: 'Single Wedding Service',
    subtitle: 'Ideal for venue booking or single wedding service',
    price: 249,
    mrp: 500,
    features: [
      'Tailored suggestions for venues or vendors (based on your selection), customized to your budget & preferred location (One city)',
      'Expert price negotiations to ensure the best deals',
      'Service valid for 3 months',
    ],
  },
  {
    id: 'city',
    title: 'City Wedding Package',
    subtitle: 'Ideal for hometown or local wedding planning.',
    price: 399,
    mrp: 2999,
    popular: true,
    features: [
      'Venue shortlisting & availability coordination',
      'Quotes with expert price benchmarking',
      'Curated vendor recommendations (Photographer, Decorator, Makeup & more)',
      'Personalized Planning Kit (Checklists, Trackers, Guides & more)',
      'Unlimited virtual planner support till your wedding day',
      'Bonus: Flat 20% off on Video invites',
      'Service valid for 6 months',
    ],
  },
  {
    id: 'destination',
    title: 'Destination Wedding Package',
    subtitle: 'Perfect for planning your destination wedding with expert guidance.',
    price: 999,
    mrp: 4999,
    features: [
      'Everything in City Wedding Package',
      'Destination & city selection support',
      "Detailed event days' flow planning assistance",
      'Expert contract vetting (for venues and vendors)',
      'Bonus: Free Digital card or 50% off on Video invites',
      'Service valid for 9 months',
    ],
  },
  {
    id: 'signature',
    title: 'Genie Signature Plan',
    subtitle:
      "Ideal for NRIs or couples planning from another city who want Genie's expert planning support plus on-ground assistance.",
    price: 19999,
    mrp: 35000,
    features: [
      'Everything in Destination Wedding Package',
      'On-Ground Venue Visits: Genie personally visits your top 3 shortlisted venues',
      'Live video walkthroughs of venues and vendor studios',
      'Dedicated senior planner on call',
      'Vendor meeting support in person',
      'Service valid for 12 months',
    ],
  },
];

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 't1',
    couple: 'Arpit & Anjali',
    rating: 5,
    date: '2026-08-18',
    text: `${BRAND.name} made my wedding planning so much easier. I would especially like to thank Ritvi for patiently shortlisting venues within our budget and negotiating a fantastic deal on our decor. We saved both time and money, and could actually enjoy our functions.`,
  },
  {
    id: 't2',
    couple: 'Amrita & Ameya',
    rating: 5,
    date: '2026-08-18',
    text: `I connected with Ritvi through ${BRAND.name}'s Genie service, and I'm so glad I did. She helped us find the perfect photographer and makeup artist, answered every late-night question and kept us on track with the checklist.`,
  },
  {
    id: 't3',
    couple: 'Monika & Tejas',
    rating: 5,
    date: '2026-08-18',
    text: 'Just wanted to give you a huge shoutout for being an extremely helpful support throughout our planning. From contract vetting to coordinating venue visits, the Genie team handled everything like family.',
  },
  {
    id: 't4',
    couple: 'Shruti & Nikhil',
    rating: 5,
    date: '2026-07-02',
    text: 'We were planning from Singapore and the Signature Plan was a life saver. Live video walkthroughs of every venue meant we booked with complete confidence.',
  },
];

export const FAQS: Faq[] = [
  {
    id: 'f1',
    q: 'What is Genie Service?',
    a: `Genie is ${BRAND.name}'s virtual wedding planning service. A dedicated wedding expert understands your requirements and budget, shortlists the best venues and vendors, negotiates prices and supports you until the wedding day.`,
  },
  {
    id: 'f2',
    q: 'How will my Genie connect with me?',
    a: 'Once you purchase a package, your Genie will call you within 24 hours and set up a WhatsApp group for quick updates, recommendations and document sharing.',
  },
  {
    id: 'f3',
    q: 'Do I have to book vendors suggested by Genie?',
    a: 'Not at all. Genie recommendations are completely unbiased suggestions. You are free to choose any venue or vendor you like — Genie can negotiate with them for you too.',
  },
  {
    id: 'f4',
    q: 'Can I upgrade my package later?',
    a: 'Yes. You can upgrade anytime by paying only the difference between the two packages.',
  },
  {
    id: 'f5',
    q: 'What is the refund policy?',
    a: 'If your Genie has not shared any recommendations yet, you can request a full refund within 7 days of purchase.',
  },
];

export const GENIE_FEATURES = [
  { icon: 'search', label: 'Tailored\nVendor Picks' },
  { icon: 'pricetag-outline', label: 'Best\nDeals' },
  { icon: 'headset-outline', label: 'Expert Help &\nSupport' },
] as const;

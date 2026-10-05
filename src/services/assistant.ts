/**
 * Wedika — on-device wedding assistant. It resolves intent + city from the
 * user's message and answers with real listings from the catalogue. The
 * `askAssistant` signature is what a server-side LLM endpoint would return,
 * so a backend can replace this module without UI changes. (Never ship an
 * LLM API key inside the app bundle — proxy it through your own server.)
 */
import { BRAND } from '@/constants/brand';
import { ALL_CITIES, CITIES } from '@/data/cities';
import { CHECKLIST, CHECKLIST_TOTAL } from '@/data/checklist';
import { GENIE_PACKAGES } from '@/data/genie';
import { catalogue } from '@/data/live';
import type { Vendor, Venue } from '@/types';
import { formatMoney, formatMoneyCompact } from '@/utils/format';

export interface AssistantReply {
  text: string;
  venues?: Venue[];
  vendors?: Vendor[];
  suggestions?: string[];
  action?: { label: string; href: string };
}

export interface AssistantContext {
  city: string;
  weddingDate: string | null;
  completedTasks: number;
}

export const POPULAR_SUGGESTIONS = [
  'Plan a destination wedding in Pokhara',
  'Banquet halls for 500 guests',
  'Photographers in Kathmandu under NPR 1 lakh',
];

type Intent =
  | 'greeting'
  | 'destination'
  | 'venues'
  | 'photographers'
  | 'makeup'
  | 'decor'
  | 'planner'
  | 'mehndi'
  | 'music'
  | 'budget'
  | 'checklist'
  | 'genie'
  | 'thanks'
  | 'unknown';

const INTENT_KEYWORDS: [Intent, RegExp][] = [
  ['thanks', /\b(thank|thanks|thx|great|awesome)\b/],
  ['greeting', /^(hi|hello|hey|namaste|hola)\b/],
  ['destination', /\b(destination|beach|palace|udaipur|goa|abroad|bali|dubai|thailand)\b/],
  ['photographers', /\b(photo|photographer|photography|camera|shoot|cinemat|film|video)\w*/],
  ['makeup', /\b(makeup|make up|mua|bridal look|hair)\w*/],
  ['mehndi', /\b(mehndi|mehendi|henna)\w*/],
  ['decor', /\b(decor|decoration|mandap|flowers|floral|theme)\w*/],
  ['planner', /\b(planner|planning service|coordinator|organi[sz]e)\w*/],
  ['music', /\b(dj|music|band|sangeet|choreograph|dance)\w*/],
  ['genie', /\b(genie|expert|human|call me|help me plan)\w*/],
  ['venues', /\b(venue|hall|banquet|resort|lawn|hotel|place)\w*/],
  ['budget', /\b(budget|cost|price|cheap|afford|expense|spend|lakh|rupee)\w*/],
  ['checklist', /\b(checklist|todo|to do|task|timeline|schedule)\w*/],
];

const SUBCATEGORY_BY_INTENT: Partial<Record<Intent, { categoryId: string; subcategoryId?: string; label: string }>> = {
  photographers: { categoryId: 'photographers', label: 'photographers' },
  makeup: { categoryId: 'makeup', subcategoryId: 'bridal-makeup', label: 'bridal makeup artists' },
  decor: { categoryId: 'planning-decor', subcategoryId: 'decorators', label: 'decorators' },
  planner: { categoryId: 'planning-decor', subcategoryId: 'planners', label: 'wedding planners' },
  mehndi: { categoryId: 'mehndi', label: 'mehendi artists' },
  music: { categoryId: 'music-dance', label: 'DJs & entertainers' },
};

const detectIntent = (text: string): Intent => {
  const t = text.toLowerCase();
  const ordered = INTENT_KEYWORDS.filter(([intent]) => intent !== 'greeting' && intent !== 'thanks');
  const hit = ordered.find(([, re]) => re.test(t));
  if (hit) return hit[0];
  if (INTENT_KEYWORDS[1][1].test(t)) return 'greeting';
  if (INTENT_KEYWORDS[0][1].test(t)) return 'thanks';
  return 'unknown';
};

const CITY_ALIASES: Record<string, string> = {
  ktm: 'Kathmandu',
  patan: 'Lalitpur',
  bharatpur: 'Chitwan',
  lakeside: 'Pokhara',
  pkr: 'Pokhara',
  janakpurdham: 'Janakpur',
};

const detectCity = (text: string): string | null => {
  const t = text.toLowerCase();
  for (const [alias, city] of Object.entries(CITY_ALIASES)) if (t.includes(alias)) return city;
  const match = CITIES.filter((c) => c.name !== ALL_CITIES).find((c) => t.includes(c.name.toLowerCase()));
  return match?.name ?? null;
};

const detectBudget = (text: string): number | null => {
  const m = text.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(l|lakh|lakhs|lac|k|cr|crore)\b/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2];
  if (unit.startsWith('c')) return n * 1_00_00_000;
  if (unit === 'k') return n * 1_000;
  return n * 1_00_000;
};

const cityLabel = (city: string) => (city === ALL_CITIES ? 'across Nepal' : `in ${city}`);

const inCity = (city: string, itemCity: string) => city === ALL_CITIES || city === itemCity;

function reply(message: string, ctx: AssistantContext): AssistantReply {
  const intent = detectIntent(message);
  const city = detectCity(message) ?? ctx.city;
  const budget = detectBudget(message);

  switch (intent) {
    case 'greeting':
      return {
        text: `Namaste! I'm ${BRAND.assistantName}, Vivah’s quick-help bot. Ask about venues, photographers, makeup artists or budgets and I’ll pull options ${cityLabel(ctx.city)}.`,
        suggestions: POPULAR_SUGGESTIONS,
      };

    case 'thanks':
      return {
        text: 'Anything else you’d like me to look up?',
        suggestions: ['Show me decorators', 'What should I book first?', 'Suggest a wedding budget'],
      };

    case 'destination': {
      const venues = catalogue.venues().filter((v) => v.collections.includes('destination'))
        .sort((a, b) => b.rating - a.rating)
        .slice(0, 6);
      return {
        text:
          'For a destination wedding, here’s how I would plan it:\n\n' +
          '1. Fix the guest count (destination weddings work best under 250 guests).\n' +
          '2. Pick the vibe — lakeside (Pokhara, Begnas), hills (Nagarkot, Dhulikhel, Bandipur) or jungle (Sauraha).\n' +
          '3. Block rooms 9–12 months ahead and book a planner who knows the location.\n\n' +
          'These top-rated destination venues are a great place to start:',
        venues,
        suggestions: ['Show venues in Pokhara', 'Suggest a wedding budget', 'Talk to an expert'],
        action: { label: 'Explore Destination Venues', href: '/collection/destination' },
      };
    }

    case 'venues': {
      const lower = message.toLowerCase();
      let venues = catalogue.venues().filter((v) => inCity(city, v.city));
      if (/luxury|premium|5 star|grand/.test(lower)) venues = venues.filter((v) => v.collections.includes('luxury'));
      else if (/budget|cheap|affordable/.test(lower)) venues = venues.filter((v) => v.collections.includes('budget'));
      if (budget) venues = venues.filter((v) => v.rentalCost <= budget);
      venues = venues.sort((a, b) => b.rating - a.rating).slice(0, 6);
      if (!venues.length) {
        return {
          text: `I couldn't find venues ${cityLabel(city)}${budget ? ` under ${formatMoneyCompact(budget)}` : ''} yet. Try another city or a slightly higher budget?`,
          suggestions: ['Show me the best wedding venues', 'Budget venues in Kathmandu'],
        };
      }
      return {
        text: `Here are the highest-rated venues ${cityLabel(city)}${budget ? ` within ${formatMoneyCompact(budget)}` : ''}. Tap any card to see photos, pricing & availability.`,
        venues,
        suggestions: ['Show luxury venues', 'Venues under 5 lakh', 'Plan my dream destination wedding'],
        action: { label: 'See all venues', href: '/venues' },
      };
    }

    case 'photographers':
    case 'makeup':
    case 'decor':
    case 'planner':
    case 'mehndi':
    case 'music': {
      const meta = SUBCATEGORY_BY_INTENT[intent]!;
      let vendors = catalogue.vendors().filter(
        (v) =>
          v.categoryId === meta.categoryId &&
          (!meta.subcategoryId || v.subcategoryId === meta.subcategoryId) &&
          inCity(city, v.city),
      );
      if (budget) vendors = vendors.filter((v) => v.startingPrice <= budget);
      vendors = vendors.sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount).slice(0, 6);
      if (!vendors.length) {
        return {
          text: `Hmm, I don't have ${meta.label} listed ${cityLabel(city)} right now. Want me to check nearby cities?`,
          suggestions: [`Show ${meta.label} in Kathmandu`, `Show ${meta.label} in Pokhara`],
        };
      }
      return {
        text: `Top ${meta.label} ${cityLabel(city)}, ranked by couple reviews:`,
        vendors,
        suggestions: ['Compare their prices', 'What should I book first?', 'Talk to an expert'],
        action: {
          label: `See all ${meta.label}`,
          href: `/vendors/${meta.categoryId}${meta.subcategoryId ? `?sub=${meta.subcategoryId}` : ''}`,
        },
      };
    }

    case 'budget': {
      const total = budget ?? 20_00_000;
      const split: [string, number][] = [
        ['Venue & catering', 0.45],
        ['Décor', 0.12],
        ['Photography & video', 0.1],
        ['Outfits & jewellery', 0.12],
        ['Makeup & mehendi', 0.04],
        ['Entertainment', 0.04],
        ['Invites & gifts', 0.03],
        ['Buffer', 0.1],
      ];
      return {
        text:
          `Here's a practical split for a ${formatMoney(total)} wedding:\n\n` +
          split.map(([label, pct]) => `• ${label}: ${formatMoneyCompact(total * pct)} (${Math.round(pct * 100)}%)`).join('\n') +
          '\n\nLock the venue first — it decides your date, guest count and catering costs.',
        suggestions: ['Venues under 5 lakh', 'Show me the best wedding venues', 'What should I book first?'],
      };
    }

    case 'checklist': {
      const next = CHECKLIST.slice(ctx.completedTasks, ctx.completedTasks + 4);
      return {
        text:
          `You've completed ${ctx.completedTasks}/${CHECKLIST_TOTAL} tasks. Up next:\n\n` +
          next.map((t) => `• ${t.title} (${t.phase})`).join('\n'),
        suggestions: ['Show me the best wedding venues', 'Suggest a wedding budget'],
        action: { label: 'Open my checklist', href: '/checklist' },
      };
    }

    case 'genie': {
      const city = GENIE_PACKAGES.find((p) => p.id === 'city')!;
      return {
        text: `Want a person to handle it? Our planners shortlist venues and vendors, negotiate prices and stay with you until the wedding day. Packages start at NPR ${GENIE_PACKAGES[0].price} — the most popular is the ${city.title} at NPR ${city.price}.`,
        action: { label: 'See planner packages', href: '/genie' },
        suggestions: ['What do your experts do?', 'Show me the best wedding venues'],
      };
    }

    default:
      if (/what should i book first|where do i start|start planning/i.test(message)) {
        return {
          text:
            'Great question! Book in this order:\n\n1. Venue (sets your date)\n2. Photographer & decorator\n3. Caterer (if not in-house)\n4. Makeup artist & mehendi\n5. Entertainment, invites & the rest.\n\nWant me to find venues for you?',
          suggestions: ['Show me the best wedding venues', 'Suggest a wedding budget'],
        };
      }
      return {
        text: `I can help with venues, vendors, budgets, checklists and destination weddings. Try asking something like "Photographers in Pokhara under 1 lakh" or "Plan my dream destination wedding".`,
        suggestions: POPULAR_SUGGESTIONS,
      };
  }
}

/** Simulates network + "thinking" latency proportional to answer length. */
export async function askAssistant(message: string, ctx: AssistantContext): Promise<AssistantReply> {
  const answer = reply(message, ctx);
  const wait = 650 + Math.min(1400, answer.text.length * 4);
  await new Promise((r) => setTimeout(r, wait));
  return answer;
}

import type { ToolDef } from '../hub';

import { EmergencyKit, FamilyDuties, JantiPlanner, MusicPlan, MyDay, Outfits, SaitFinder, Samagri, ShotList, WeatherGuide } from './ceremony';
import { ContactSheet, GuestRooms, Pickups, VendorMeetings } from './logistics';
import { BabyKeepsakes, GamesActivities, SurprisePlan } from './occasions';
import { GiftLedger, HoneymoonPlanner, MenuPlanner, SavingsGoal, TipsPlanner, WhatIfBudget } from './money';
import { FamilyVote, HeadcountForecast, HealthCheck, MarriageRegistration, PriceCheck } from './smart';

/** The couple's extra planning tools (`/tools`), filtered by the active occasion through `TOOL_RULES`. */
export const COUPLE_TOOLS: ToolDef[] = [
  { id: 'couple.sait', title: 'Sait finder', subtitle: 'Auspicious dates for the next 12 months', icon: 'calendar-number-outline', group: 'Dates and rituals', Component: SaitFinder },
  { id: 'couple.samagri', title: 'Puja samagri', subtitle: 'Ritual items for every ceremony', icon: 'flower-outline', group: 'Dates and rituals', Component: Samagri },
  { id: 'couple.weather', title: 'Weather and season', subtitle: 'What to expect on your dates', icon: 'partly-sunny-outline', group: 'Dates and rituals', Component: WeatherGuide },
  { id: 'couple.duties', title: 'Family duties', subtitle: 'Who does what on each day', icon: 'people-circle-outline', group: 'Family and guests', Component: FamilyDuties },
  { id: 'couple.janti', title: 'Janti planner', subtitle: 'Baraat headcount, vehicles and timing', icon: 'bus-outline', group: 'Family and guests', Component: JantiPlanner },
  { id: 'couple.rooms', title: 'Guest rooms', subtitle: 'Hotel blocks for out-of-town family', icon: 'bed-outline', group: 'Family and guests', Component: GuestRooms },
  { id: 'couple.pickups', title: 'Pickups and transport', subtitle: 'Airport, bus park and hotel runs', icon: 'car-outline', group: 'Family and guests', Component: Pickups },
  { id: 'couple.contacts', title: 'Wedding day contacts', subtitle: 'Coordinator, vendors, family, emergency', icon: 'call-outline', group: 'Family and guests', Component: ContactSheet },
  { id: 'couple.myday', title: 'My day schedule', subtitle: 'Your personal timeline, minute by minute', icon: 'time-outline', group: 'The wedding day', Component: MyDay },
  { id: 'couple.outfits', title: 'Outfits and jewellery', subtitle: 'Orders, fittings and pickups', icon: 'shirt-outline', group: 'The wedding day', Component: Outfits },
  { id: 'couple.kit', title: 'Emergency kit', subtitle: 'What to pack in the day bags', icon: 'medkit-outline', group: 'The wedding day', Component: EmergencyKit },
  { id: 'couple.shots', title: 'Photo shot list', subtitle: 'Must-have photos for your photographer', icon: 'camera-outline', group: 'The wedding day', Component: ShotList },
  { id: 'couple.music', title: 'Music and playlist', subtitle: 'Songs for every moment', icon: 'musical-notes-outline', group: 'The wedding day', Component: MusicPlan },
  { id: 'couple.menu', title: 'Bhoj menu', subtitle: 'Dishes, diets and per-plate cost', icon: 'restaurant-outline', group: 'The wedding day', Component: MenuPlanner },
  { id: 'couple.meetings', title: 'Vendor meetings', subtitle: 'Visits, tastings and what was agreed', icon: 'chatbox-ellipses-outline', group: 'Vendors', Component: VendorMeetings },
  { id: 'couple.tips', title: 'Tips and dakshina', subtitle: 'Envelopes for the crew and purohit ji', icon: 'mail-open-outline', group: 'Money', Component: TipsPlanner },
  { id: 'couple.gifts', title: 'Shagun and gifts', subtitle: 'Who gave what, and thank-yous', icon: 'gift-outline', group: 'Money', Component: GiftLedger },
  { id: 'couple.whatif', title: 'What-if budget', subtitle: 'How guests and services move the total', icon: 'calculator-outline', group: 'Money', Component: WhatIfBudget },
  { id: 'couple.savings', title: 'Savings goal', subtitle: 'Monthly target to reach your budget', icon: 'trending-up-outline', group: 'Money', Component: SavingsGoal },
  { id: 'couple.keepsakes', title: 'Baby keepsakes', subtitle: 'Firsts, weight and gifts from relatives', icon: 'happy-outline', group: 'Family and guests', Component: BabyKeepsakes },
  { id: 'couple.surprise', title: 'Surprise plan', subtitle: 'Keep it secret, keep it on track', icon: 'heart-circle-outline', group: 'Family and guests', Component: SurprisePlan },
  { id: 'couple.games', title: 'Games and activities', subtitle: 'What happens when, and the prizes', icon: 'dice-outline', group: 'Family and guests', Component: GamesActivities },
  { id: 'couple.health', title: 'Plan health check', subtitle: 'Your readiness score and what to do next', icon: 'pulse-outline', group: 'Smart planning', Component: HealthCheck },
  { id: 'couple.headcount', title: 'Headcount forecast', subtitle: 'Who will really come, and plates to order', icon: 'people-outline', group: 'Smart planning', Component: HeadcountForecast },
  { id: 'couple.pricecheck', title: 'Fair price check', subtitle: 'Is a quote fair for your city?', icon: 'pricetags-outline', group: 'Smart planning', Component: PriceCheck },
  { id: 'couple.votes', title: 'Family vote', subtitle: 'Decide venues, menus and outfits together', icon: 'hand-left-outline', group: 'Smart planning', Component: FamilyVote },
  { id: 'couple.registration', title: 'Marriage registration', subtitle: 'Ward office papers and the 35-day deadline', icon: 'ribbon-outline', group: 'After the wedding', Component: MarriageRegistration },
  { id: 'couple.honeymoon', title: 'Honeymoon planner', subtitle: 'Nepal getaways for two, costed', icon: 'airplane-outline', group: 'After the wedding', Component: HoneymoonPlanner },
];

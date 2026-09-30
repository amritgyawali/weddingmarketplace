import type { ToolDef } from '../hub';

import { Certifications, Clients, Network, PitchBuilder, ReliabilityCoach } from './growth';
import { EarningsGoal, ExpensesMileage, PrivateInvoices, RateCalculator, SavingsPots, TaxEstimate } from './money';
import { BackupLog, Deliveries, GearCare, GearChecklist, OpenDates, SafetyChecklist, TravelPlanner, WeekPlanner, WorkDiary } from './work';

/** The freelancer's 20 extra tools (`/freelancer/tools`). */
export const FREELANCER_TOOLS: ToolDef[] = [
  { id: 'freelancer.week', title: 'This week', subtitle: 'Jobs, trips, deadlines and days off', icon: 'calendar-outline', group: 'Plan your work', Component: WeekPlanner },
  { id: 'freelancer.open', title: 'Open dates', subtitle: 'Share when you can take work', icon: 'calendar-clear-outline', group: 'Plan your work', Component: OpenDates },
  { id: 'freelancer.travel', title: 'Travel planner', subtitle: 'Distances, departures and routes', icon: 'navigate-outline', group: 'Plan your work', Component: TravelPlanner },
  { id: 'freelancer.gear', title: 'Gear checklist', subtitle: 'Pack the night before every job', icon: 'briefcase-outline', group: 'On the job', Component: GearChecklist },
  { id: 'freelancer.safety', title: 'Health and safety', subtitle: 'Look after yourself on long days', icon: 'medkit-outline', group: 'On the job', Component: SafetyChecklist },
  { id: 'freelancer.backup', title: 'Card backup log', subtitle: 'Two copies before you format', icon: 'save-outline', group: 'On the job', Component: BackupLog },
  { id: 'freelancer.deliveries', title: 'Edits and deliveries', subtitle: 'What you owe each client, and when', icon: 'cloud-upload-outline', group: 'On the job', Component: Deliveries },
  { id: 'freelancer.diary', title: 'Work diary', subtitle: 'Notes and lessons from each job', icon: 'book-outline', group: 'On the job', Component: WorkDiary },
  { id: 'freelancer.rates', title: 'Rate calculator', subtitle: 'Quote a private job in a minute', icon: 'calculator-outline', group: 'Money', Component: RateCalculator },
  { id: 'freelancer.invoices', title: 'Private invoices', subtitle: 'Bill clients from outside Vivah', icon: 'document-text-outline', group: 'Money', Component: PrivateInvoices },
  { id: 'freelancer.expenses', title: 'Expenses and mileage', subtitle: 'Receipts and kilometres for tax time', icon: 'receipt-outline', group: 'Money', Component: ExpensesMileage },
  { id: 'freelancer.tax', title: 'Income tax estimate', subtitle: 'Nepal slabs on this year’s income', icon: 'business-outline', group: 'Money', Component: TaxEstimate },
  { id: 'freelancer.goals', title: 'Earnings goal', subtitle: 'Monthly target and history', icon: 'flag-outline', group: 'Money', Component: EarningsGoal },
  { id: 'freelancer.pots', title: 'Savings pots', subtitle: 'Tax, gear and emergency funds', icon: 'wallet-outline', group: 'Money', Component: SavingsPots },
  { id: 'freelancer.pitch', title: 'Pitch builder', subtitle: 'Application messages that win gigs', icon: 'megaphone-outline', group: 'Grow', Component: PitchBuilder },
  { id: 'freelancer.reliability', title: 'Reliability coach', subtitle: 'Your score and how to raise it', icon: 'shield-checkmark-outline', group: 'Grow', Component: ReliabilityCoach },
  { id: 'freelancer.clients', title: 'Clients and organisers', subtitle: 'Studios, venues and planners', icon: 'people-outline', group: 'Grow', Component: Clients },
  { id: 'freelancer.network', title: 'Crew network', subtitle: 'Second shooters and assistants', icon: 'git-network-outline', group: 'Grow', Component: Network },
  { id: 'freelancer.certs', title: 'Skills and certificates', subtitle: 'Courses, permits and renewals', icon: 'ribbon-outline', group: 'Grow', Component: Certifications },
  { id: 'freelancer.gearcare', title: 'Gear care and insurance', subtitle: 'Servicing, warranty and value', icon: 'construct-outline', group: 'Grow', Component: GearCare },
];

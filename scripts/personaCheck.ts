/**
 * Registry check and persona matrix (master plan §3.5). Run with
 * `npm run check:personas`; add `-- --update` after an intended change to
 * rewrite the expected matrix in `scripts/persona-matrix.json`.
 *
 * Fails when a registry references a capability, occasion, permission or
 * service that does not exist, when a service has no capabilities or trade,
 * or when a persona fixture ends up with fewer than three tools.
 */
import { PLATFORM_ROUTE_RULES, TODAY_FOCUS, TOOL_RULES, toolRole, UNIVERSAL_TOOLS, type ToolId } from '@/data/access';
import { isCapability } from '@/data/capabilities';
import { CRAFTS } from '@/data/crafts';
import { EVENT_TYPE_BY_ID } from '@/data/events';
import { BUILT_IN_OCCASIONS } from '@/data/occasions';
import { isPermission, PERMISSIONS, STAFF_PERMISSIONS } from '@/data/permissions';
import { CREW_ROLES, SERVICE_BY_ID, SERVICES } from '@/data/services';
import { BUSINESS_FORMS, SERVICE_CAPABILITIES, TRADES } from '@/data/trades';
import { allows, allowsTool, resolveExperience } from '@/services/experience';
import type { PersonaInput, When } from '@/types/persona';

export interface CheckResult {
  errors: string[];
  notes: string[];
  matrix: Record<string, string[]>;
}

const FORMS = new Set<string>(BUSINESS_FORMS.map((f) => f.id));
const OCCASIONS = new Set<string>(BUILT_IN_OCCASIONS.map((o) => o.id));

function checkRule(where: string, rule: When, errors: string[]) {
  rule.capsAny?.forEach((c) => isCapability(c) || errors.push(`${where}: unknown capability ${c}`));
  rule.capsAll?.forEach((c) => isCapability(c) || errors.push(`${where}: unknown capability ${c}`));
  rule.perms?.forEach((p) => isPermission(p) || errors.push(`${where}: unknown permission ${p}`));
  rule.permsAny?.forEach((p) => isPermission(p) || errors.push(`${where}: unknown permission ${p}`));
  rule.forms?.forEach((f) => FORMS.has(f) || errors.push(`${where}: unknown business form ${f}`));
  rule.occasions?.forEach((o) => OCCASIONS.has(o) || errors.push(`${where}: unknown occasion ${o}`));
  if (rule.not) checkRule(`${where} (not)`, rule.not, errors);
}

/** One fixture per trade, craft, occasion and staff role, plus the demo personas. */
export const FIXTURES: Record<string, PersonaInput> = {
  ...Object.fromEntries(TRADES.map((t) => [`vendor:${t.id}`, { role: 'vendor', services: t.core, primaryService: t.core[0], businessForm: t.defaultForm } satisfies PersonaInput])),
  'vendor:demo-everest': { role: 'vendor', services: ['venue', 'catering'], primaryService: 'venue', businessForm: 'venue' },
  'vendor:demo-wedding-story': { role: 'vendor', services: ['photography', 'videography', 'drone', 'pre-wedding', 'album'], primaryService: 'photography', businessForm: 'studio' },
  'vendor:demo-phoolbari': { role: 'vendor', services: ['decoration', 'florist', 'lighting'], primaryService: 'decoration', businessForm: 'studio' },
  'freelancer:photographer': { role: 'freelancer', skills: ['Photographer', 'Editor'], primarySkill: 'Photographer' },
  'freelancer:makeup': { role: 'freelancer', skills: ['Makeup Artist'], primarySkill: 'Makeup Artist' },
  'freelancer:dj': { role: 'freelancer', skills: ['DJ'], primarySkill: 'DJ' },
  'freelancer:driver': { role: 'freelancer', skills: ['Driver'], primarySkill: 'Driver' },
  ...Object.fromEntries(CRAFTS.map((c) => [`freelancer:craft-${c.id}`, { role: 'freelancer', skills: [c.skills[0]], primarySkill: c.skills[0] } satisfies PersonaInput])),
  'freelancer:demo-dj': { role: 'freelancer', skills: ['DJ', 'MC'], primarySkill: 'DJ' },
  ...Object.fromEntries(BUILT_IN_OCCASIONS.map((o) => [`customer:${o.id}`, { role: 'customer', occasion: o.id } satisfies PersonaInput])),
  ...Object.fromEntries(Object.keys(STAFF_PERMISSIONS).map((r) => [`platform:${r}`, { role: 'platform', staffRole: r as PersonaInput['staffRole'] } satisfies PersonaInput])),
  'platform:support-vendor-success': { role: 'platform', staffRole: 'support', team: 'Vendor Success' },
};

export function runPersonaCheck(): CheckResult {
  const errors: string[] = [];
  const notes: string[] = [];

  // Services, trades and their capabilities.
  for (const s of SERVICES) {
    const caps = SERVICE_CAPABILITIES[s.id];
    if (!caps?.length) errors.push(`service ${s.id}: no capabilities in SERVICE_CAPABILITIES`);
    caps?.forEach((c) => isCapability(c) || errors.push(`service ${s.id}: unknown capability ${c}`));
    const trades = TRADES.filter((t) => t.services.includes(s.id));
    if (trades.length !== 1) errors.push(`service ${s.id}: in ${trades.length} trades (needs exactly 1)`);
  }
  Object.keys(SERVICE_CAPABILITIES).forEach((id) => SERVICE_BY_ID[id] || errors.push(`SERVICE_CAPABILITIES: unknown service ${id}`));
  for (const t of TRADES) {
    [...t.services, ...t.neighbours].forEach((id) => SERVICE_BY_ID[id] || errors.push(`trade ${t.id}: unknown service ${id}`));
    t.core.forEach((id) => t.services.includes(id) || errors.push(`trade ${t.id}: core service ${id} is not in the trade`));
    if (!FORMS.has(t.defaultForm)) errors.push(`trade ${t.id}: unknown business form ${t.defaultForm}`);
  }

  // Crafts: every crew role in exactly one craft.
  for (const role of CREW_ROLES) {
    const crafts = CRAFTS.filter((c) => c.skills.includes(role));
    if (crafts.length !== 1) errors.push(`crew role ${role}: in ${crafts.length} crafts (needs exactly 1)`);
  }
  for (const c of CRAFTS) {
    [...c.skills, ...c.neighbours].forEach((k) => CREW_ROLES.includes(k) || errors.push(`craft ${c.id}: unknown crew role ${k}`));
    if (!c.profile.length) errors.push(`craft ${c.id}: no profile questions`);
  }

  // Occasions.
  if (OCCASIONS.size !== BUILT_IN_OCCASIONS.length) errors.push('occasions: duplicate ids');
  for (const o of BUILT_IN_OCCASIONS) {
    if (!o.eventTypes.length) errors.push(`occasion ${o.id}: no functions`);
    o.eventTypes.forEach((t) => EVENT_TYPE_BY_ID[t] || errors.push(`occasion ${o.id}: unknown event type ${t}`));
    o.services.forEach((id) => SERVICE_BY_ID[id] || errors.push(`occasion ${o.id}: unknown service ${id}`));
    o.defaultServices.forEach((id) => o.services.includes(id) || errors.push(`occasion ${o.id}: default service ${id} is hidden in its marketplace`));
    o.modules.forEach((m) => isCapability(`plan.${m}`) || errors.push(`occasion ${o.id}: unknown module ${m}`));
  }

  // Permissions.
  Object.entries(STAFF_PERMISSIONS).forEach(([role, perms]) => perms.forEach((p) => isPermission(p) || errors.push(`staff role ${role}: unknown permission ${p}`)));
  if (!PERMISSIONS.every((p) => STAFF_PERMISSIONS.super_admin.includes(p))) errors.push('super_admin must hold every permission');

  // Tool rules.
  for (const id of Object.keys(TOOL_RULES) as ToolId[]) {
    if (!toolRole(id)) errors.push(`tool ${id}: id prefix is not a role app`);
    checkRule(`tool ${id}`, TOOL_RULES[id], errors);
  }
  Object.entries(PLATFORM_ROUTE_RULES).forEach(([route, rule]) => checkRule(`route ${route}`, rule, errors));
  TODAY_FOCUS.forEach((f) => checkRule(`today focus ${f.id}`, f.when, errors));
  notes.push(`${UNIVERSAL_TOOLS.length} of ${Object.keys(TOOL_RULES).length} tools are universal for their role on purpose`);

  // Persona matrix.
  const matrix: Record<string, string[]> = {};
  for (const [name, input] of Object.entries(FIXTURES)) {
    const exp = resolveExperience(input);
    const tools = (Object.keys(TOOL_RULES) as ToolId[]).filter((id) => allowsTool(exp, id)).sort();
    if (tools.length < 3) errors.push(`fixture ${name}: only ${tools.length} tools`);
    if (input.role !== 'customer' && input.role !== 'platform' && !exp.services.length) errors.push(`fixture ${name}: resolved no services`);
    // Staff also get the console screens their permissions open, so a matrix change that hides finance from finance fails the build.
    const routes = input.role === 'platform' ? Object.keys(PLATFORM_ROUTE_RULES).filter((r) => allows(exp, PLATFORM_ROUTE_RULES[r])).map((r) => `route:${r}`) : [];
    matrix[name] = [...tools, ...routes.sort()];
  }

  return { errors, notes, matrix };
}

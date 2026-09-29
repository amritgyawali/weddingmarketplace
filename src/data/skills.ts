import { CREW_ROLES } from './services';

/** Every crew role a freelancer can offer (derived from the service catalogue). */
export const FREELANCE_SKILLS = CREW_ROLES;

const ICONS: [RegExp, string][] = [
  [/photo/i, 'camera-outline'],
  [/video|cinema/i, 'videocam-outline'],
  [/drone/i, 'airplane-outline'],
  [/edit|retouch/i, 'color-wand-outline'],
  [/makeup/i, 'color-palette-outline'],
  [/hair/i, 'cut-outline'],
  [/mehendi/i, 'hand-left-outline'],
  [/decor|florist|rigging/i, 'flower-outline'],
  [/dj|musician/i, 'musical-notes-outline'],
  [/mc|choreo/i, 'mic-outline'],
  [/chef|server|bartender/i, 'restaurant-outline'],
  [/driver/i, 'car-outline'],
  [/light|av|sound|stream|technician/i, 'flash-outline'],
  [/coordinator|staff|attendant/i, 'people-outline'],
];

export const skillIcon = (skill: string) => ICONS.find(([re]) => re.test(skill))?.[1] ?? 'briefcase-outline';

/** @deprecated use skillIcon */
export const SKILL_ICONS: Record<string, string> = Object.fromEntries(CREW_ROLES.map((r) => [r, skillIcon(r)]));

/**
 * Role toolkits: the smaller planning, business, freelance and operations
 * tools each app offers on top of the core orchestration loop. They share two
 * generic collections so a new tool needs no new persisted key:
 *
 *   ToolEntry   one record in a tool (a gift, an expense, a ticket…)
 *   ToolState   per-owner settings for a tool (targets, templates, flags)
 *
 * Mirrored by supabase/migrations/0004_toolkits.sql.
 */
import type { UserRole } from './platform';

export type ToolValue = string | number | boolean;

export interface ToolEntry {
  id: string;
  /**
   * Who the record belongs to: the couple's project id (so collaborators share
   * it), a vendor or freelancer account id, or `'platform'` for the ops team.
   */
  ownerId: string;
  /** Tool id from the registry, e.g. `couple.gifts`, `vendor.expenses`. */
  tool: string;
  title: string;
  note?: string;
  /** Whole NPR. */
  amount?: number;
  qty?: number;
  /** yyyy-mm-dd */
  date?: string;
  /** HH:mm (24 h) */
  time?: string;
  status?: string;
  /** Section / category inside the tool. */
  group?: string;
  done?: boolean;
  /** Linked project, booking, assignment, lead or account id. */
  refId?: string;
  fields?: Record<string, ToolValue>;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type ToolEntryInput = Omit<ToolEntry, 'id' | 'createdAt' | 'updatedAt'>;

/** Settings for one tool and owner, keyed `${ownerId}:${tool}` in the store. */
export type ToolState = Record<string, ToolValue | string[]>;

/** A role-wide announcement sent from the operations console. */
export interface Broadcast {
  id: string;
  audience: UserRole | 'all';
  title: string;
  body: string;
  sentById: string;
  sentByName: string;
  at: string;
  recipients: number;
}

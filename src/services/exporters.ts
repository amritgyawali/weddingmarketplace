/**
 * Files the app hands to other apps: calendar (.ics), spreadsheets (.csv) and
 * PDFs (via expo-print). Works on iOS/Android (share sheet) and web (download).
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';

import { toast } from '@/components/ui/Toast';

// Generic save/share
function downloadOnWeb(content: string, fileName: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function shareText(content: string, fileName: string, mime: string) {
  try {
    if (Platform.OS === 'web') return downloadOnWeb(content, fileName, mime);
    const file = new File(Paths.cache, fileName);
    file.create({ overwrite: true });
    file.write(content);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: fileName });
    else toast('Sharing is not available on this device');
  } catch {
    toast('Could not export the file');
  }
}

/** Render HTML to a PDF and open the share sheet (print dialog on web). */
export async function sharePdf(html: string, fileName: string) {
  try {
    if (Platform.OS === 'web') {
      await Print.printAsync({ html });
      return;
    }
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: fileName });
  } catch {
    toast('Could not create the PDF');
  }
}

// Calendar
export interface CalendarItem {
  title: string;
  date: string;
  time?: string;
  durationHours?: number;
  location?: string;
  description?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (d: Date) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}00Z`;

function range(item: CalendarItem): { start: Date; end: Date; allDay: boolean } {
  const [y, m, d] = item.date.split('-').map(Number);
  if (!item.time) return { start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 1), allDay: true };
  const [h, min] = item.time.split(':').map(Number);
  const start = new Date(y, m - 1, d, h, min);
  return { start, end: new Date(start.getTime() + (item.durationHours ?? 3) * 3_600_000), allDay: false };
}

const escapeIcs = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

export function buildIcs(items: CalendarItem[], calName = 'Vivah wedding'): string {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Vivah//Wedding Planner//EN', `X-WR-CALNAME:${escapeIcs(calName)}`, 'X-WR-TIMEZONE:Asia/Kathmandu'];
  items.forEach((item, i) => {
    const { start, end, allDay } = range(item);
    lines.push('BEGIN:VEVENT', `UID:vivah-${item.date}-${i}@vivah.com.np`, `DTSTAMP:${stamp(new Date())}`);
    if (allDay) lines.push(`DTSTART;VALUE=DATE:${item.date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${`${end.getFullYear()}${pad(end.getMonth() + 1)}${pad(end.getDate())}`}`);
    else lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`);
    lines.push(`SUMMARY:${escapeIcs(item.title)}`);
    if (item.location) lines.push(`LOCATION:${escapeIcs(item.location)}`);
    if (item.description) lines.push(`DESCRIPTION:${escapeIcs(item.description)}`);
    lines.push('BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${escapeIcs(item.title)}`, 'END:VALARM', 'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** Opens an import in Apple/Google Calendar via the system share sheet. */
export const exportCalendar = (items: CalendarItem[], name = 'vivah-wedding') => shareText(buildIcs(items), `${name}.ics`, 'text/calendar');

export function googleCalendarUrl(item: CalendarItem): string {
  const { start, end, allDay } = range(item);
  const fmt = (d: Date) => (allDay ? `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` : stamp(d));
  const params = new URLSearchParams({ action: 'TEMPLATE', text: item.title, dates: `${fmt(start)}/${fmt(end)}`, details: item.description ?? '', location: item.location ?? '', ctz: 'Asia/Kathmandu' });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export const addToGoogleCalendar = (item: CalendarItem) => Linking.openURL(googleCalendarUrl(item));

// CSV
const csvCell = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const toCsv = (rows: Record<string, unknown>[]) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  return [headers.join(','), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(','))].join('\n');
};

export const exportCsv = (rows: Record<string, unknown>[], name: string) => shareText(toCsv(rows), `${name}.csv`, 'text/csv');

/** Minimal RFC-4180 parser (quoted cells, escaped quotes, CRLF). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

/** Let the user pick a .csv file and parse it. Returns null when cancelled. */
export async function pickCsv(): Promise<Record<string, string>[] | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const text = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new File(asset.uri).text();
  return parseCsv(text);
}

/** Printable HTML documents (quotation, receipt, contract, guest list, seating, run sheet). */
import { BRAND } from '@/constants/brand';
import { milestonePurpose, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_TEXT } from '@/services/paymentInfo';
import { paymentSummary } from '@/services/pricing';
import { quoteTotals, lineTotal } from '@/services/quotes';
import type { Contract, Guest, Payment, Project, ProjectEvent, Quotation, SeatingLayout } from '@/types/platform';
import { formatLongDate, formatNpr, formatShortDate, formatTime } from '@/utils/format';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const page = (title: string, body: string) => `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(title)}</title>
<style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#251B18;background:#FFFCF8;margin:32px;font-size:13px}
  h1{font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#681C2A;margin:0 0 4px} h2{font-family:Georgia,'Times New Roman',serif;font-size:15px;margin:22px 0 8px;color:#681C2A}
  .brand{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #C8A46B;padding-bottom:14px;margin-bottom:18px}
  .muted{color:#6F625B} table{width:100%;border-collapse:collapse} th,td{padding:8px 6px;border-bottom:1px solid #EFE3D5;text-align:left;vertical-align:top}
  th{font-size:11px;color:#6F625B} .r{text-align:right} .total td{font-weight:700;font-size:15px;border-top:2px solid #681C2A}
  .box{border:1px solid #E5D6C5;border-radius:10px;padding:12px;margin:10px 0} .grid{display:flex;gap:16px} .grid>div{flex:1}
  .pill{display:inline-block;padding:2px 8px;border-radius:99px;background:#F3E7D2;color:#681C2A;font-size:11px;font-weight:700}
  .sig{margin-top:28px;display:flex;gap:24px} .sig>div{flex:1;border-top:1px solid #C8A46B;padding-top:6px}
  .foot{margin-top:30px;font-size:11px;color:#6F625B;text-align:center}
  .status{border-radius:10px;padding:10px 12px;margin:0 0 12px} .status.ok{background:#E6F0E8;color:#2E5A3F} .status.bad{background:#FBE9E7;color:#8F1C12} .status.wait{background:#F3E7D2;color:#6B4A12}
</style></head><body>
<div class="brand"><div><h1>${esc(BRAND.name)} Weddings</h1><div class="muted">Vivah Weddings Pvt. Ltd. · Baneshwor, Kathmandu · PAN 609000111 · ${esc(BRAND.supportEmail)}</div></div><div class="r muted">${esc(title)}<br/>${formatLongDate(new Date().toISOString())}</div></div>
${body}
<div class="foot">Made with the ${esc(BRAND.name)} app · Vivah holds payments safely and releases them to providers as the agreed payment plan says.</div>
</body></html>`;

export function quoteHtml(q: Quotation) {
  const totals = quoteTotals(q);
  const rows = q.items
    .map((i) => `<tr><td><b>${esc(i.title)}</b>${i.description ? `<div class="muted">${esc(i.description)}</div>` : ''}</td><td class="r">${i.qty}${i.unit ? ` ${esc(i.unit)}` : ''}</td><td class="r">${formatNpr(i.rate)}</td><td class="r">${formatNpr(lineTotal(i))}</td></tr>`)
    .join('');
  const schedule = q.schedule.map((s) => `<tr><td>${esc(s.label)}</td><td class="r">${s.percent}%</td><td class="r">${formatNpr(Math.round((totals.total * s.percent) / 100))}</td></tr>`).join('');
  return page(
    `Quotation ${q.number} · v${q.version}`,
    `<div class="grid"><div><h2>Prepared for</h2><b>${esc(q.customerName)}</b><div class="muted">${esc(q.city)}</div></div><div><h2>Details</h2>Event: ${formatLongDate(q.eventDate)}<br/>Valid until: ${formatLongDate(q.validUntil)}<br/>From: ${esc(q.fromName)}</div></div>
<h2>Services</h2><table><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr>${rows}
<tr><td colspan="3" class="r">Subtotal</td><td class="r">${formatNpr(totals.subtotal)}</td></tr>
${totals.discount ? `<tr><td colspan="3" class="r">Package discount</td><td class="r">− ${formatNpr(totals.discount)}</td></tr>` : ''}
${totals.serviceFee ? `<tr><td colspan="3" class="r">Service fee</td><td class="r">${formatNpr(totals.serviceFee)}</td></tr>` : ''}
<tr><td colspan="3" class="r">VAT (${Math.round(q.taxRate * 100)}%)</td><td class="r">${formatNpr(totals.tax)}</td></tr>
<tr class="total"><td colspan="3" class="r">Total</td><td class="r">${formatNpr(totals.total)}</td></tr></table>
<h2>Payment schedule</h2><table>${schedule}</table>
${q.notes ? `<h2>Notes</h2><p>${esc(q.notes)}</p>` : ''}<h2>Terms</h2><p class="muted">${esc(q.terms)}</p>`,
  );
}

/** Printable receipt: what was paid, for what, how, its status in words, and the balance left. Always in NPR. */
export function receiptHtml(payment: Payment, project: Project) {
  const milestone = project.milestones.find((m) => m.id === payment.milestoneId);
  const status = PAYMENT_STATUS_TEXT[payment.status];
  const tone = payment.status === 'SUCCEEDED' ? 'ok' : payment.status === 'FAILED' ? 'bad' : 'wait';
  const summary = milestone ? paymentSummary(project) : null;
  const description = milestone
    ? `<b>${esc(milestone.label)}</b>${milestone.percent ? ` (${milestone.percent}% of the total)` : ''}<div class="muted">Instalment due ${formatLongDate(milestone.due)} · ${esc(milestonePurpose(milestone))}</div>`
    : payment.registryItemId
      ? '<b>Wedding gift</b><div class="muted">A blessing sent through the couple’s gift registry</div>'
      : '<b>Payment</b>';
  const balance = summary
    ? `<h2>Your payment plan</h2><table>
<tr><td>Total for the celebration (incl. 13% VAT)</td><td class="r">${formatNpr(summary.total)}</td></tr>
<tr><td>Paid to date, including this payment</td><td class="r">${formatNpr(summary.paid)}</td></tr>
<tr><td><b>Still to pay</b></td><td class="r"><b>${formatNpr(summary.outstanding)}</b></td></tr>
${summary.next ? `<tr><td>Next instalment</td><td class="r">${esc(summary.next.label)} · ${formatNpr(summary.next.amount - summary.next.paidAmount)} due ${formatLongDate(summary.next.due)}</td></tr>` : '<tr><td colspan="2" class="muted">Everything is paid. Thank you!</td></tr>'}
</table>`
    : '';
  return page(
    `Receipt ${payment.receiptNo}`,
    `<div class="status ${tone}"><b>${esc(status.label)}</b> · ${esc(status.detail)}</div>
<div class="box"><div class="grid"><div><h2>Received from</h2><b>${esc(payment.payerName)}</b><div class="muted">${esc(project.title)} · ${esc(project.code)}</div><div class="muted">Celebration date: ${formatLongDate(project.weddingDate)}</div>${project.coordinatorName ? `<div class="muted">Coordinator: ${esc(project.coordinatorName)}</div>` : ''}</div>
<div><h2>Payment details</h2>Receipt number: <b>${esc(payment.receiptNo)}</b><br/>Paid on: ${formatLongDate(payment.at)} at ${formatTime(payment.at)}<br/>Method: ${esc(PAYMENT_METHOD_LABEL[payment.method] ?? payment.method)}<br/>Transaction reference: ${esc(payment.reference)}</div></div></div>
<table><tr><th>Description</th><th class="r">Amount</th></tr><tr><td>${description}</td><td class="r">${formatNpr(payment.amount)}</td></tr>
${payment.refunded ? `<tr><td>Refunded to you</td><td class="r">− ${formatNpr(payment.refunded)}</td></tr>` : ''}
<tr class="total"><td class="r">${payment.refunded ? 'Kept after refund' : 'Total received'}</td><td class="r">${formatNpr(payment.amount - payment.refunded)}</td></tr></table>
<p class="muted">Amounts are in Nepali rupees (NPR). Instalments are part of a total that includes 13% VAT.</p>
${balance}
<p class="muted">Keep this receipt for your records. This is a computer-generated receipt and needs no signature. Questions about this payment? Write to ${esc(BRAND.supportEmail)} and quote ${esc(payment.receiptNo)}.</p>`,
  );
}

export function contractHtml(c: Contract) {
  const sections = c.sections.map((s, i) => `<h2>${i + 1}. ${esc(s.heading)}</h2><p>${esc(s.body)}</p>`).join('');
  const sig = (party: 'customer' | 'provider' | 'platform', label: string, name: string) => {
    const s = c.signatures.find((x) => x.party === party);
    return `<div><b>${esc(label)}</b><br/>${esc(name)}<br/>${s ? `Signed by ${esc(s.name)} on ${formatLongDate(s.at)}` : '<span class="muted">Not signed</span>'}</div>`;
  };
  return page(
    `${c.number} · v${c.version}`,
    `<h1 style="font-size:18px">${esc(c.title)}</h1>${sections}<div class="sig">${sig('customer', 'Customer', c.parties.customer)}${sig('provider', 'Provider', c.parties.provider)}${sig('platform', 'Platform', c.parties.platform)}</div>`,
  );
}

export function guestListHtml(project: Project, guests: Guest[], events: ProjectEvent[]) {
  const head = events.map((e) => `<th>${esc(e.name)}</th>`).join('');
  const rows = guests
    .map((g) => `<tr><td><b>${esc(g.name)}</b>${g.vip ? ' (VIP)' : ''}<div class="muted">${esc(g.category)} · ${g.side}</div></td><td>${esc(g.phone ?? '')}</td>${events.map((e) => {
      const inv = g.invites.find((i) => i.eventId === e.id);
      return `<td>${inv ? `${inv.rsvp.toUpperCase()}${inv.attending ? ` (${inv.attending})` : ''}` : '—'}</td>`;
    }).join('')}<td>${esc(g.dietary.join(', '))}</td></tr>`)
    .join('');
  return page(`Guest list · ${project.title}`, `<table><tr><th>Guest</th><th>Phone</th>${head}<th>Dietary</th></tr>${rows}</table><p class="muted">${guests.length} guests</p>`);
}

export function seatingHtml(project: Project, event: ProjectEvent, layout: SeatingLayout, guests: Guest[]) {
  const tables = layout.elements.filter((e) => e.capacity > 0);
  const blocks = tables
    .map((t) => {
      const seated = guests.filter((g) => g.invites.some((i) => i.eventId === event.id && i.tableId === t.id));
      const count = seated.reduce((s, g) => s + Math.max(1, g.invites.find((i) => i.eventId === event.id)?.attending ?? 1), 0);
      return `<div class="box"><b>${esc(t.label)}</b>${t.vip ? ' <span class="pill">VIP</span>' : ''} <span class="muted">${count}/${t.capacity}</span><ul>${seated.map((g) => `<li>${esc(g.name)}${g.dietary.length ? ` <span class="muted">(${esc(g.dietary.join(', '))})</span>` : ''}</li>`).join('')}</ul></div>`;
    })
    .join('');
  return page(`Seating · ${project.title} · ${event.name}`, `<p>${event.date ? formatLongDate(event.date) : ''} · ${esc(event.venue)}</p><div style="columns:2">${blocks}</div>`);
}

export function runSheetHtml(project: Project, event: ProjectEvent) {
  const rows = event.runSheet.map((r) => `<tr><td><b>${esc(r.time)}</b></td><td>${esc(r.title)}</td><td>${esc(r.owner)}</td><td>${r.status}</td></tr>`).join('');
  const crew = project.bookings
    .filter((b) => b.eventIds.includes(event.id) && b.status !== 'CANCELLED')
    .map((b) => `<tr><td>${esc(b.providerName)}</td><td>${b.assignments.filter((a) => a.eventId === event.id).map((a) => `${esc(a.workerName)} (${esc(a.role)})`).join(', ') || '—'}</td></tr>`)
    .join('');
  return page(`Run sheet · ${project.title} · ${event.name}`, `<p>${event.date ? formatShortDate(event.date) : ''} · ${esc(event.venue)} · ${event.guests} guests</p><table><tr><th>Time</th><th>Cue</th><th>Owner</th><th>Status</th></tr>${rows}</table><h2>Providers & crew</h2><table>${crew}</table>`);
}

/** Printable invitation card (A5) — its own design, without the Vivah letterhead. */
export function invitationHtml(opts: { names: string; message: string; accent: string; background: string; events: ProjectEvent[]; footer?: string }) {
  const events = opts.events
    .map((e) => `<div class="ev"><b>${esc(e.name)}</b><br/>${e.date ? formatLongDate(e.date) : 'Date to be announced'} · ${esc(e.startTime)}<br/><span>${esc(e.venue)}, ${esc(e.city)}</span></div>`)
    .join('');
  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(opts.names)}</title><style>
  @page{size:A5;margin:0} body{margin:0;font-family:Georgia,'Times New Roman',serif;background:${opts.background};color:#2b2118}
  .card{margin:24px;padding:36px 28px;border:2px solid ${opts.accent};border-radius:18px;text-align:center;min-height:90vh}
  .om{font-size:28px;color:${opts.accent}} h1{font-size:34px;color:${opts.accent};margin:14px 0} p{white-space:pre-line;font-size:15px;line-height:1.6}
  .ev{margin:14px auto;padding:10px;border-top:1px solid ${opts.accent}33;max-width:320px;font-size:14px} .ev span{color:#6b5b4b}
  .foot{margin-top:22px;font-size:12px;color:#6b5b4b}
  </style></head><body><div class="card"><div class="om">ॐ श्री गणेशाय नमः</div><h1>${esc(opts.names)}</h1><p>${esc(opts.message)}</p>${events}${opts.footer ? `<div class="foot">${esc(opts.footer)}</div>` : ''}</div></body></html>`;
}

/** A freelancer's income statement for a period: Vivah payouts (from the ledger) and private invoices they entered. */
export function incomeStatementHtml(opts: { name: string; phone?: string; pan?: string; from: string; to: string; rows: { date: string; source: 'vivah' | 'private'; label: string; amount: number }[] }) {
  const sorted = [...opts.rows].sort((a, b) => a.date.localeCompare(b.date));
  const vivah = sorted.filter((r) => r.source === 'vivah').reduce((s, r) => s + r.amount, 0);
  const own = sorted.filter((r) => r.source === 'private').reduce((s, r) => s + r.amount, 0);
  const rows = sorted.map((r) => `<tr><td>${formatShortDate(r.date)}</td><td>${esc(r.label)}</td><td>${r.source === 'vivah' ? 'Vivah payout' : 'Private client'}</td><td class="r">${formatNpr(r.amount)}</td></tr>`).join('');
  return page(
    `Income statement · ${opts.name}`,
    `<div class="grid"><div><h2>Earner</h2><b>${esc(opts.name)}</b>${opts.phone ? `<div class="muted">${esc(opts.phone)}</div>` : ''}${opts.pan ? `<div class="muted">PAN ${esc(opts.pan)}</div>` : ''}</div><div><h2>Period</h2>${formatLongDate(opts.from)} to ${formatLongDate(opts.to)}</div></div>
<table><tr><th>Date</th><th>Job</th><th>Source</th><th class="r">Amount</th></tr>${rows || '<tr><td colspan="4" class="muted">No income in this period</td></tr>'}
<tr><td colspan="3" class="r">Paid through Vivah</td><td class="r">${formatNpr(vivah)}</td></tr>
<tr><td colspan="3" class="r">Private clients (self-declared)</td><td class="r">${formatNpr(own)}</td></tr>
<tr class="total"><td colspan="3" class="r">Total income</td><td class="r">${formatNpr(vivah + own)}</td></tr></table>
<p class="muted">Vivah payouts are listed from Vivah’s payout records. Private-client income was entered by the earner and is not verified by Vivah. Amounts are before income tax.</p>`,
  );
}

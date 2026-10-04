import './ts-loader.mjs';
import assert from 'node:assert/strict';
import { importApp } from './ts-loader.mjs';

const { guideSections, relatedEvents, personalizedPackagePrice, dailyCapacity, listingAvailability } = await importApp('@/services/customerPlanning');
const { CHECKLIST } = await importApp('@/data/checklist');
const { BUILT_IN_OCCASIONS } = await importApp('@/data/occasions');
const { buildEvents, guideSuggestions } = await importApp('@/services/planner');
const { today, addDays } = await importApp('@/utils/format');
let checks = 0;
const test = (name, fn) => { fn(); checks++; console.log(`pass  ${name}`); };

for (const days of [0, 1, 10, 32, 300, 500, null, -5]) {
  test(`guide keeps every existing task exactly once with ${days} days remaining`, () => {
    const sections = guideSections(CHECKLIST, days);
    assert.equal(new Set(sections.flatMap((s) => s.tasks.map((t) => t.id))).size, CHECKLIST.length);
    assert.equal(sections.flatMap((s) => s.tasks).length, CHECKLIST.length);
    assert.ok(sections.every((s) => !/month|week/i.test(s.label)));
    if (days !== null) assert.ok(sections.every((s) => Number(s.id) <= Math.max(0, days)));
  });
}
test('ten-day guide includes venue and budget preparation in Do now', () => {
  const now = guideSections(CHECKLIST, 10)[0];
  assert.equal(now.label, 'Do now');
  assert.ok(now.tasks.some((t) => t.title === 'Book the wedding venue'));
  assert.ok(now.tasks.some((t) => t.category === 'Budget'));
});
for (const occasion of BUILT_IN_OCCASIONS) {
  test(`${occasion.id} keeps its main function and offers only related additions`, () => {
    const types = relatedEvents(occasion);
    assert.ok(types.includes(occasion.eventTypes[0]));
    assert.equal(new Set(types).size, types.length);
    if (occasion.id !== 'wedding') assert.ok(!types.includes('WEDDING'));
  });
}
test('admin-created occasions keep their configured functions', () => {
  assert.deepEqual(relatedEvents({ id: 'custom', eventTypes: ['BIRTHDAY', 'OTHER'] }), ['BIRTHDAY', 'OTHER']);
});
const project = {
  guests: 200,
  events: [{ id: 'w', guests: 200, status: 'planned' }, { id: 'r', guests: 100, status: 'planned' }, { id: 'c', guests: 300, status: 'cancelled' }],
  requirements: [{ serviceId: 'photography', status: 'OPEN', eventIds: ['w', 'r'], details: { addOnTotal: 5000 } }],
};
test('photography total follows selected functions and priced extras', () => {
  assert.equal(personalizedPackagePrice({ price: 10000, unit: 'per day' }, 'photography', project), 25000);
});
test('a requirement covering one event charges for one event', () => {
  assert.equal(personalizedPackagePrice({ price: 10000, unit: 'per event' }, 'photography', { ...project, requirements: [{ ...project.requirements[0], eventIds: ['r'] }] }), 15000);
});
test('catering total uses each active function headcount', () => {
  assert.equal(personalizedPackagePrice({ price: 100, unit: 'per plate' }, 'catering', project), 30000);
});
test('no project means a quote is needed, not a fabricated personal price', () => {
  assert.equal(personalizedPackagePrice({ price: 10000, unit: 'per day' }, 'photography', null), null);
});
test('capacity defaults safely for missing or malformed values', () => {
  for (const value of [undefined, 0, -1, Infinity, 'bad', 1.5, 101]) assert.equal(dailyCapacity({ tradeProfile: { eventsPerDay: value } }), 1);
  assert.equal(dailyCapacity({ tradeProfile: { eventsPerDay: 3 } }), 3);
});
const date = '2026-11-01';
const reservation = { id: 'a', ownerId: 'listing', date, part: 'full', status: 'BOOKED', source: 'booking', refId: 'booking1' };
test('a booking consumes one slot, leaving a multi-event business available', () => {
  assert.deepEqual(listingAvailability(['listing'], date, [reservation], [], 2), { status: 'AVAILABLE', remaining: 1 });
});
test('duplicate rows for the same booking do not consume extra capacity', () => {
  assert.equal(listingAvailability(['listing'], date, [reservation, { ...reservation, id: 'b' }], [], 2).remaining, 1);
});
test('holds count toward the daily limit', () => {
  assert.deepEqual(listingAvailability(['listing'], date, [reservation, { ...reservation, id: 'b', refId: 'booking2', status: 'HELD' }], [], 2), { status: 'BOOKED', remaining: 0 });
});
test('manual unavailability overrides free slots', () => {
  assert.equal(listingAvailability(['listing'], date, [{ ...reservation, status: 'UNAVAILABLE', source: 'manual' }], [], 5).status, 'UNAVAILABLE');
});
test('weekly closures appear immediately on the public calendar', () => {
  assert.equal(listingAvailability(['listing'], date, [], [{ ownerId: 'listing', weekday: 0, part: 'full', status: 'UNAVAILABLE' }], 5).remaining, 0);
});
test('unrelated providers and dates do not affect availability', () => {
  assert.equal(listingAvailability(['other'], date, [reservation], [], 1).remaining, 1);
  assert.equal(listingAvailability(['listing'], '2026-11-02', [reservation], [], 1).remaining, 1);
});
test('per-function dates, names and cities survive plan creation', () => {
  const events = buildEvents({ eventTypes: ['WEDDING', 'OTHER'], dates: { WEDDING: date, OTHER: '2026-11-02' }, eventCities: { OTHER: 'Pokhara' }, eventNames: { OTHER: 'Bachelor party' }, city: 'Kathmandu', guests: 200 });
  assert.equal(events[1].city, 'Pokhara');
  assert.equal(events[1].name, 'Bachelor party');
  assert.equal(events[1].date, '2026-11-02');
  assert.equal(events[0].city, 'Kathmandu');
});
test('ten-day task suggestions include unfinished preparation due today', () => {
  const p = { ...project, weddingDate: addDays(today(), 10), occasion: 'wedding', tasks: [], customerId: 'c', customerName: 'Couple' };
  const suggestions = guideSuggestions(p);
  assert.equal(suggestions.find((t) => t.title === 'Book the wedding venue').due, today());
  assert.ok(suggestions.every((t) => t.due <= p.weddingDate));
});
console.log(`${checks} customer planning checks passed.`);

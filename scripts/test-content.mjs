/**
 * Checks the content a super admin edits in the console (src/services/content.ts):
 * edits are laid over the bundled catalogue without touching it, hidden
 * records leave lists but still resolve, field checks keep a record's shape,
 * the home keeps a sensible order when sections or banners come and go,
 * photo addresses are validated, saved content is read defensively, and the
 * brand details and the marketplace categories follow the edits. Node 24+
 * strips the TypeScript.
 *
 *   npm run test:content
 */
import './ts-loader.mjs';

import { importApp } from './ts-loader.mjs';

const c = await importApp('@/services/content');
const { HOME_SECTION_IDS, HOME_SECTIONS } = await importApp('@/data/homeSections');
const { FEATURE_BY_ID } = await importApp('@/data/features');
const { VENUES } = await importApp('@/data/venues');
const { VENDORS } = await importApp('@/data/vendors');
const cat = await importApp('@/data/categories');
const { catalogue, catalogueAll } = await importApp('@/data/live');
const { api } = await importApp('@/services/api');
const { BRAND, BRAND_DEFAULTS } = await importApp('@/constants/brand');
const { SERVICES } = await importApp('@/data/services');

const results = [];
const ok = (name, pass, detail = '') => results.push({ name, pass: !!pass, detail });
const content = (patch = {}) => ({ ...c.emptyContent(), ...patch });
const live = (patch) => {
  c.contentRuntime.content = content(patch);
};

// ─── Catalogue edits ────────────────────────────────────────────────────────────
const venue = VENUES[0];
const other = VENUES[1];
const frozen = JSON.stringify(VENUES);
const edited = content({ entries: { [`venue:${venue.id}`]: { fields: { name: 'Renamed Palace', rentalCost: 123456 } }, [`venue:${other.id}`]: { fields: {}, hidden: true } } });

ok('untouched content returns the bundled list itself', c.patchList('venue', VENUES, c.EMPTY_CONTENT) === VENUES && c.visibleList('venue', VENUES, c.EMPTY_CONTENT) === VENUES);
const patched = c.patchList('venue', VENUES, edited);
ok('the same content gives the same list (stable for React)', c.patchList('venue', VENUES, edited) === patched && c.visibleList('venue', VENUES, edited) === c.visibleList('venue', VENUES, edited));
ok('an edit changes the record', patched[0].name === 'Renamed Palace' && patched[0].rentalCost === 123456 && patched[0].city === venue.city);
ok('the id can never be edited away', c.patchList('venue', VENUES, content({ entries: { [`venue:${venue.id}`]: { fields: { id: 'x', name: 'N' } } } }))[0].id === venue.id);
ok('untouched records keep their identity', patched[2] === VENUES[2]);
ok('the bundled catalogue is never mutated', JSON.stringify(VENUES) === frozen && VENUES[0].name === venue.name);
ok('edits to one kind leave the others alone', c.patchList('vendor', VENDORS, edited) === VENDORS);
ok('a hidden record leaves lists', !c.visibleList('venue', VENUES, edited).some((v) => v.id === other.id) && c.visibleList('venue', VENUES, edited).length === VENUES.length - 1);
ok('a hidden record still resolves by id', c.patchList('venue', VENUES, edited).some((v) => v.id === other.id) && c.isHidden('venue', other.id, edited));

// ─── The app reads the edits ────────────────────────────────────────────────────
live({ entries: edited.entries });
ok('lists and search use the edited catalogue', catalogue.venues()[0].name === 'Renamed Palace' && !catalogue.venues().some((v) => v.id === other.id));
ok('lookups keep hidden records', catalogueAll.venues().some((v) => v.id === other.id));
const found = await api.search('Renamed Palace', venue.city);
ok('search finds the new name', found.some((r) => r.kind === 'venue' && r.item.id === venue.id));
const gone = await api.search(other.name, other.city);
ok('search leaves a hidden venue out', !gone.some((r) => r.kind === 'venue' && r.item.id === other.id));
ok('a hidden venue still opens from a link', (await api.getVenue(other.id)).id === other.id);
live({ entries: { 'category:decor': { fields: { title: 'Decor and flowers' } }, 'shortcut:makeup': { fields: {}, hidden: true } } });
const all = SERVICES.map((s) => s.id);
ok('category helpers follow the edits', cat.findCategory('decor')?.title === 'Decor and flowers' && cat.categoriesFor(all).find((x) => x.id === 'decor')?.title === 'Decor and flowers');
ok('an occasion filter keeps the edited title', cat.categoriesFor(['decoration']).find((x) => x.id === 'decor')?.title === 'Decor and flowers');
ok('a hidden home shortcut leaves the home', !cat.homeCategoriesFor(all).some((x) => x.id === 'makeup') && cat.homeCategoriesFor(all).length === cat.HOME_CATEGORIES.length - 1);
live({ brand: { name: 'Shubha', supportPhone: '+9779800000000' } });
ok('brand details follow the edits', BRAND.name === 'Shubha' && BRAND.supportPhone === '+9779800000000' && BRAND.supportEmail === BRAND_DEFAULTS.supportEmail);
live();
ok('removing the edits restores the originals', BRAND.name === BRAND_DEFAULTS.name && catalogue.venues() === VENUES && cat.findCategory('decor')?.title !== 'Decor and flowers');

// ─── Field checks ───────────────────────────────────────────────────────────────
// Stands in for `isImageRef` (bundled photo keys can't be loaded in Node: they are image files).
const bundled = new Set(VENUES.flatMap((v) => v.images));
const isImage = (ref) => bundled.has(ref) || !!c.imageAddress(ref);
const check = (fields) => c.checkFields(venue, fields, ['images'], isImage);
ok('only the differences are kept', JSON.stringify(check({ ...venue, name: 'New name' }).fields) === JSON.stringify({ name: 'New name' }));
ok('nothing changed keeps nothing', Object.keys(check({ ...venue }).fields).length === 0);
ok('text is trimmed', check({ name: '  Spaced  ' }).fields.name === 'Spaced');
ok('an unknown field is refused', !!check({ nope: 1 }).error);
ok('the id is refused', !!check({ id: 'other' }).error);
ok('a number must stay a number', !!check({ rentalCost: '5000' }).error && !!check({ rentalCost: Number.NaN }).error);
ok('a price can’t be negative', !!check({ rentalCost: -1 }).error);
ok('whole-rupee fields are rounded', check({ rentalCost: 250000.6 }).fields.rentalCost === 250001);
ok('a rating keeps its decimals', check({ rating: 4.25 }).fields.rating === 4.25);
ok('a name can’t be emptied', !!check({ name: '   ' }).error);
ok('a list must stay a list', !!check({ amenities: 'Parking' }).error);
ok('list items are trimmed and blanks dropped', JSON.stringify(check({ amenities: [' Parking ', '', 'Lift'] }).fields.amenities) === JSON.stringify(['Parking', 'Lift']));
ok('a gallery needs at least one photo', !!check({ images: [] }).error);
ok('a gallery takes bundled photos and links', !check({ images: [venue.images[0], 'https://res.cloudinary.com/x/y.jpg'] }).error);
ok('a gallery refuses something that is not a photo', !!check({ images: ['javascript:alert(1)'] }).error);
ok('a nested object must stay an object', !!check({ capacity: 500 }).error && !check({ capacity: { min: 100, max: 900 } }).error);
ok('a flag must stay on or off', !!check({ featured: 'yes' }).error);
ok('very long text is refused', !!check({ about: 'x'.repeat(c.MAX_TEXT + 1) }).error);

// ─── Photo addresses ────────────────────────────────────────────────────────────
ok('a web link is a photo address', c.imageAddress(' https://example.com/a.jpg ') === 'https://example.com/a.jpg');
ok('a photo kept on the device is one', c.imageAddress(`${c.LOCAL_IMAGE_SCHEME}abc.jpg`) === `${c.LOCAL_IMAGE_SCHEME}abc.jpg`);
ok('a small inline image is one', !!c.imageAddress('data:image/png;base64,iVBORw0KGgo='));
ok('scripts, files and blobs are not', [`javascript:alert(1)`, 'file:///etc/passwd', 'blob:http://x/1', 'data:text/html;base64,PHNjcmlwdD4=', 'ftp://x.y/a.jpg', 'https://', 'not a link', '', null, 42].every((x) => c.imageAddress(x) === null));
ok('an oversized inline image is not', c.imageAddress(`data:image/png;base64,${'A'.repeat(c.MAX_INLINE_IMAGE)}`) === null);

// ─── Home sections ──────────────────────────────────────────────────────────────
const D = ['a', 'b', 'c', 'd'];
const banner = (id, extra = {}) => ({ id, title: `Banner ${id}`, active: true, ...extra });
const eq = (x, y) => JSON.stringify(x) === JSON.stringify(y);
ok('no saved order keeps the built-in one', eq(c.orderSections(D, [], []), D));
ok('a saved order is used', eq(c.orderSections(D, ['d', 'c', 'b', 'a'], []), ['d', 'c', 'b', 'a']));
ok('a section added later goes after the one it follows by default', eq(c.orderSections(D, ['d', 'a', 'b'], []), ['d', 'a', 'b', 'c']));
ok('a new first section goes first', eq(c.orderSections(D, ['d', 'b', 'c'], []), ['a', 'd', 'b', 'c']));
ok('unknown and repeated ids are dropped', eq(c.orderSections(D, ['x', 'b', 'b', 'a', 'c', 'd'], []), ['b', 'a', 'c', 'd']));
ok('a new banner goes to the top', eq(c.orderSections(D, [], [banner('1')]), ['banner:1', ...D]) && eq(c.orderSections(D, ['b', 'a', 'c', 'd'], [banner('1')]), ['banner:1', 'b', 'a', 'c', 'd']));
ok('a placed banner stays where it was put', eq(c.orderSections(D, ['a', 'banner:1', 'b', 'c', 'd'], [banner('1')]), ['a', 'banner:1', 'b', 'c', 'd']));
ok('a deleted banner leaves the order', eq(c.orderSections(D, ['a', 'banner:1', 'b', 'c', 'd'], []), D));
ok('every home section is listed once', new Set(HOME_SECTION_IDS).size === HOME_SECTION_IDS.length && HOME_SECTION_IDS.length === HOME_SECTIONS.length);
const unknownFlags = HOME_SECTIONS.filter((s) => s.feature && !FEATURE_BY_ID[s.feature]).map((s) => s.feature);
ok('every home section switch is a registered feature', unknownFlags.length === 0, unknownFlags.join(', '));
ok('a renamed heading fills in the city', c.sectionTitle('venues', 'Venues', 'Pokhara', content({ home: { order: [], titles: { venues: 'Halls in {city}' } } })) === 'Halls in Pokhara');
ok('no rename keeps the built-in heading', c.sectionTitle('venues', 'Venues in Pokhara', 'Pokhara', c.EMPTY_CONTENT) === 'Venues in Pokhara');

// ─── Reading saved content ──────────────────────────────────────────────────────
ok('nothing saved reads as empty content', c.normalizeContent(undefined) === c.EMPTY_CONTENT && c.normalizeContent('x') === c.EMPTY_CONTENT && c.normalizeContent([]) === c.EMPTY_CONTENT);
const clean = content({ images: { venueLawn: 'https://example.com/lawn.jpg' }, entries: edited.entries, banners: [banner('1')], brand: { name: 'Shubha' } });
ok('clean content comes back as the same object', c.normalizeContent(clean) === clean);
const messy = c.normalizeContent({
  images: { venueLawn: 'javascript:alert(1)', venueCliffside: 'https://example.com/c.jpg', bad: 7 },
  entries: { 'venue:v1': { fields: { id: 'hack', name: 'N' } }, 'unknown:v1': { fields: { name: 'N' } }, 'venue:': { fields: {} }, 'venue:v2': 'nope', 'vendor:v3': { fields: {} }, 'idea:i1': { hidden: true } },
  home: { order: ['a', 'a', 3, 'b'], titles: { venues: '  Halls  ', x: 5 } },
  banners: [banner('1'), banner('1'), { id: 'no-title' }, 'junk', banner('2', { active: false, body: 'Hello' })],
  brand: { name: ' Shubha ', empty: '   ' },
  extra: 'ignored',
});
ok('a bad photo address is dropped', eq(messy.images, { venueCliffside: 'https://example.com/c.jpg' }));
ok('bad entries are dropped and ids protected', eq(Object.keys(messy.entries).sort(), ['idea:i1', 'venue:v1']) && messy.entries['venue:v1'].fields.id === undefined && messy.entries['idea:i1'].hidden === true);
ok('the home order is cleaned', eq(messy.home.order, ['a', 'b']) && eq(messy.home.titles, { venues: 'Halls' }));
ok('banners are cleaned and unique', messy.banners.length === 2 && messy.banners[1].active === false && messy.banners[1].body === 'Hello');
ok('brand details are trimmed', eq(messy.brand, { name: 'Shubha' }));
ok('no more banners than the limit', c.normalizeContent({ banners: Array.from({ length: 30 }, (_, i) => banner(String(i))) }).banners.length === c.MAX_BANNERS);
ok('the change count adds up', c.contentChangeCount(c.EMPTY_CONTENT) === 0 && c.contentChangeCount(clean) === 5);

const failed = results.filter((r) => !r.pass);
results.forEach((r) => console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${!r.pass && r.detail ? `  (${r.detail})` : ''}`));
console.log(`\n${results.length - failed.length} of ${results.length} checks passed.`);
if (failed.length) process.exit(1);

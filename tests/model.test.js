// Run with: node tests/model.test.js
const assert = require('assert');
const CK = require('../js/model.js');
const { calc, costs, DEF, rankRecs, applyPlan, grade, monthlyKwh, F, REF, REF_META, BASIS } = CK;
const close = (a, b, tol = 0.5, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b}, got ${a}`);
let n = 0; const test = (name, fn) => { fn(); n++; console.log('ok  ' + name); };

test('electricity = kWh x 12 x grid / household size', () => {
  close(calc(DEF).elec, 200 * 12 * 0.675 / 4, 0.01);
});
test('bill mode converts rupees to units with the tariff', () => {
  close(monthlyKwh({ ...DEF, elecMode: 'bill', bill: 1600, tariff: 8 }), 200, 0.001);
});
test('appliance mode gives a plausible household figure', () => {
  const k = monthlyKwh({ ...DEF, elecMode: 'appliances' });
  assert.ok(k > 120 && k < 350, 'kWh/month ' + k);
});
test('solar offsets units but never below zero', () => {
  assert.strictEqual(calc({ ...DEF, solar: 5000 }).elec, 0);
  assert.ok(calc({ ...DEF, solar: 100 }).elec < calc(DEF).elec);
});
test('a car on the same distance: CNG < EV (on today\'s coal-heavy grid) < petrol < diesel', () => {
  const t = type => calc({ ...DEF, car: 100, twoW: 0, bus: 0, metro: 0, flDom: 0, carType: type }).parts.car;
  assert.ok(t('cng') < t('ev') && t('ev') < t('petrol') && t('petrol') < t('diesel'));
});
test('an EV suggestion is not shown to a CNG-car owner (it would not save carbon)', () => {
  assert.ok(!rankRecs({ ...DEF, carType: 'cng' }).some(x => x.r.id === 'evcar'));
});
test('a cleaner grid makes EVs better', () => {
  const ev = g => calc({ ...DEF, grid: g, car: 100, twoW: 0, bus: 0, metro: 0, flDom: 0, carType: 'ev' }).parts.car;
  assert.ok(ev(0.4) < ev(0.675));
});
test('carpooling divides car emissions per person', () => {
  const one = calc({ ...DEF, occ: 1 }).parts.car, three = calc({ ...DEF, occ: 3 }).parts.car;
  close(three, one / 3, 0.01);
});
test('flights use per-flight factors', () => {
  close(calc({ ...DEF, car: 0, twoW: 0, bus: 0, metro: 0, flDom: 2, flIntl: 1 }).travel, 2 * 165 + 750, 0.01);
});
test('LPG is shared across the household', () => {
  close(calc(DEF).home, 7 * 14.2 * 3 / 4, 0.01);
});
test('turning an activity off removes it from the total', () => {
  const on = calc(DEF), off = calc({ ...DEF, include: { ...DEF.include, travel: false } });
  assert.strictEqual(off.travel, 0);
  close(on.total - off.total, on.travel, 0.001);
});
test('total equals the sum of categories', () => {
  const c = calc(DEF);
  close(c.total, c.elec + c.travel + c.food + c.home + c.goods + c.digital, 0.001);
});
test('recommendations are ranked high to low and all save carbon', () => {
  const r = rankRecs(DEF);
  assert.ok(r.length >= 8);
  for (let i = 1; i < r.length; i++) assert.ok(r[i - 1].save >= r[i].save);
  r.forEach(x => assert.ok(x.save > 0));
});
test('recommendations for a switched-off category are hidden', () => {
  const r = rankRecs({ ...DEF, include: { ...DEF.include, food: false } });
  assert.ok(!r.some(x => x.r.id === 'diet'));
});
test('applying a plan never raises the footprint and does not double count', () => {
  const r = rankRecs(DEF), ids = r.map(x => x.r.id);
  const after = calc(applyPlan(DEF, ids, r)).total, base = calc(DEF).total;
  assert.ok(after < base);
  const sum = r.reduce((a, x) => a + x.save, 0);
  assert.ok(base - after <= sum + 0.001, 'combined savings cannot exceed the sum of individual savings');
});
test('moving car trips to the metro saves carbon and money', () => {
  const x = rankRecs(DEF).find(y => y.r.id === 'carshift');
  assert.ok(x.save > 0 && x.rs > 0);
});
test('grade bands', () => {
  assert.strictEqual(grade(1200).letter, 'A');
  assert.strictEqual(grade(2300).letter, 'B');
  assert.strictEqual(grade(3000).letter, 'C');
  assert.strictEqual(grade(5500).letter, 'D');
  assert.strictEqual(grade(9000).letter, 'E');
});
test('default grid factor is the CEA FY 2025-26 value', () => {
  assert.strictEqual(F.grid, 0.675);
  assert.strictEqual(DEF.grid, 0.675);
});
test('benchmarks come from one source and one boundary, each with a year', () => {
  assert.deepStrictEqual(REF, { india: 3000, path15: 2500, world: 4600 });
  ['india', 'path15', 'world'].forEach(k => { assert.ok(REF_META[k].year >= 2019); assert.ok(/CO2e/.test(REF_META[k].basis)); });
  assert.ok(REF_META.source && REF_META.url.startsWith('https://'));
});
test('a taxi or cab is calculated separately from an auto-rickshaw', () => {
  const only = o => calc({ ...DEF, car: 0, twoW: 0, bus: 0, metro: 0, flDom: 0, ...o }).parts;
  close(only({ cab: 100 }).cab, 100 * 52 * F.cab, 0.01);
  assert.strictEqual(only({ cab: 100 }).auto, 0);
  assert.ok(F.cab !== F.auto);
  assert.ok(costs({ ...DEF, cab: 100 }) > costs(DEF));
});
test('every factor group says whether it is CO2 or a CO2e estimate', () => {
  Object.values(BASIS).forEach(v => assert.ok(v === 'CO2' || v === 'CO2e estimate'));
  assert.strictEqual(BASIS.grid, 'CO2');
});
test('state objects are not mutated by calculations', () => {
  const snap = JSON.stringify(DEF); rankRecs(DEF); costs(DEF); calc(DEF);
  assert.strictEqual(JSON.stringify(DEF), snap);
});
console.log(`\n${n} tests passed`);

/*
 * Carbon Khata: calculation model.
 * Pure functions only (no DOM), so the same file runs in the browser and in Node tests.
 * All results are kg per person per year unless stated. Reported as "CO2e" for convenience, but the
 * energy and fuel factors below are CO2-only; see BASIS for which factor is CO2 and which is a CO2e estimate.
 */
(function (root) {
  'use strict';

  /* ---------- Emission factors (kg per unit; see BASIS for CO2 vs CO2e) ---------- */
  const F = {
    grid: 0.675,                      // kg CO2 per kWh: CEA CO2 Baseline Database v22.0, FY 2025-26 weighted average (FY 2024-25 was 0.71). Editable in the UI.
    // Road factors are approximate representative values, not exact for every vehicle (India GHG Program gives separate values by vehicle type and engine size).
    car: { petrol: 0.14, diesel: 0.15, cng: 0.07 }, // kg per vehicle-km, representative passenger car
    evCarKwh: 0.15,                   // kWh per km
    twoW: 0.035,                      // kg per km, representative petrol two-wheeler (India GHG Program range is about 0.029 to 0.054 by engine size, before its uplift factor)
    evTwoKwh: 0.03,                   // kWh per km
    auto: 0.077,                      // kg per passenger-km (CNG auto, ~0.108 per vehicle-km, 1.4 riders)
    cab: 0.093,                       // kg per passenger-km, taxi or app cab: assumed petrol-car 0.14 per vehicle-km shared by ~1.5 passengers (approximate assumption)
    bus: 0.02,                        // kg per passenger-km
    metroKwh: 0.042,                  // kWh per passenger-km
    train: 0.035,                     // kg per passenger-km, long-distance rail
    flDom: 165, flIntl: 750,          // kg per one-way flight (about 1,100 km and 5,000 km at 0.15 kg/pkm)
    flTrainKm: 1100,                  // km of one replaced domestic flight
    lpgCyl: 14.2, lpgKg: 3.0,         // kg per cylinder, kg CO2 per kg LPG
    waste: 140, wasteC: 80,           // kg per person per year, without / with composting
    streamKgHr: 0.04,                 // kg per hour of video streaming
    phoneKg: 60, laptopKg: 250,       // kg embodied per new device
    tree: 21                          // kg CO2 absorbed by a mature tree per year (approximate)
  };
  F.lpg = F.lpgCyl * F.lpgKg;

  /* ---------- What each factor measures ---------- */
  // 'CO2'  = carbon dioxide only (fuel or grid electricity); full CO2e would be slightly higher.
  // 'CO2e' = rounded estimate that already includes other greenhouse gases (for example methane from waste and food).
  const BASIS = {
    grid: 'CO2', road: 'CO2', auto: 'CO2', cab: 'CO2', bus: 'CO2', metro: 'CO2', lpg: 'CO2',
    train: 'CO2e estimate', flights: 'CO2e estimate', diet: 'CO2e estimate', shopping: 'CO2e estimate',
    waste: 'CO2e estimate', digital: 'CO2e estimate'
  };

  /* ---------- Rough rupee costs, used only to show money saved ---------- */
  const R = {
    car: { petrol: 6.7, diesel: 5, cng: 3.5 }, // Rs per km
    twoW: 2.2, auto: 12, cab: 15, bus: 1.5, metro: 2.5, train: 1.8,
    flDom: 5500, flIntl: 30000,                 // Rs per one-way flight
    lpgCyl: 900
  };

  const DIETS = [
    { id: 'vegan',  label: 'Vegan',                                          kg: 600 },
    { id: 'veg',    label: 'Vegetarian (dairy, no eggs)',                    kg: 900 },
    { id: 'egg',    label: 'Eggs, with chicken or fish now and then',        kg: 1200 },
    { id: 'nonveg', label: 'Non-vegetarian most days',                       kg: 1600 },
    { id: 'heavy',  label: 'Meat at most meals, including mutton or beef',   kg: 2300 }
  ];
  const SHOP = { minimal: 150, average: 300, frequent: 700 };

  const CATS = [
    { k: 'elec',    name: 'Electricity',        c: '--c-elec' },
    { k: 'travel',  name: 'Travel',             c: '--c-travel' },
    { k: 'food',    name: 'Food',               c: '--c-food' },
    { k: 'home',    name: 'Cooking (LPG)',      c: '--c-home' },
    { k: 'goods',   name: 'Shopping and waste', c: '--c-goods' },
    { k: 'digital', name: 'Digital',            c: '--c-digital' }
  ];

  const DEF = {
    include: { elec: true, travel: true, food: true, home: true, goods: true, digital: true },
    members: 4, elecMode: 'units', kwh: 200, bill: 1600, tariff: 8, solar: 0, grid: F.grid,
    acHrs: 3, acMonths: 6, fans: 3, fanHrs: 10, lights: 8, lightHrs: 5, fridge: true,
    geyserHrs: 0.5, washLoads: 3, tvHrs: 3, pcHrs: 4,
    car: 40, carType: 'petrol', occ: 1, twoW: 60, twoWType: 'petrol', auto: 0, cab: 0, bus: 20, metro: 30, train: 0,
    flDom: 2, flIntl: 0,
    diet: 'veg', cyl: 7,
    shop: 'average', compost: false,
    streamHrs: 1.5, phones: 0.3, laptops: 0.1,
    // multipliers and extras that only recommendations touch
    elecMul: 1, shopMul: 1, cookMul: 1, devMul: 1, trainExtraKm: 0
  };

  /* ---------- Electricity ---------- */
  function applianceKwh(s) {
    const ac = s.acHrs * 1.2 * 30 * (s.acMonths / 12);
    const fans = s.fans * 0.06 * s.fanHrs * 30;
    const lights = s.lights * 0.009 * s.lightHrs * 30;
    const fridge = s.fridge ? 30 : 0;
    const geyser = s.geyserHrs * 2 * 30;
    const wash = s.washLoads * 4.3 * 0.5;
    const tv = s.tvHrs * 0.1 * 30;
    const pc = s.pcHrs * 0.06 * 30;
    return (ac + fans + lights + fridge + geyser + wash + tv + pc) * 1.1; // +10% small loads
  }
  function monthlyKwh(s) {
    if (s.elecMode === 'bill') return s.bill / Math.max(1, s.tariff);
    if (s.elecMode === 'appliances') return applianceKwh(s);
    return s.kwh;
  }
  const netKwh = s => Math.max(0, monthlyKwh(s) * s.elecMul - s.solar);

  /* ---------- Footprint ---------- */
  function calc(s) {
    const inc = s.include, g = s.grid, m = Math.max(1, s.members);
    const elec = inc.elec ? netKwh(s) * 12 * g / m : 0;

    const carF = s.carType === 'ev' ? F.evCarKwh * g : F.car[s.carType];
    const twF = s.twoWType === 'ev' ? F.evTwoKwh * g : F.twoW;
    const parts = {
      car: s.car * 52 * carF / Math.max(1, s.occ),
      twoW: s.twoW * 52 * twF,
      auto: s.auto * 52 * F.auto,
      cab: s.cab * 52 * F.cab,
      bus: s.bus * 52 * F.bus,
      metro: s.metro * 52 * F.metroKwh * g,
      train: (s.train * 52 + s.trainExtraKm) * F.train,
      flights: s.flDom * F.flDom + s.flIntl * F.flIntl
    };
    const travel = inc.travel ? Object.values(parts).reduce((a, b) => a + b, 0) : 0;

    const food = inc.food ? DIETS.find(d => d.id === s.diet).kg : 0;
    const home = inc.home ? s.cyl * F.lpg * s.cookMul / m : 0;
    const goods = inc.goods ? SHOP[s.shop] * s.shopMul + (s.compost ? F.wasteC : F.waste) : 0;
    const digital = inc.digital
      ? s.streamHrs * 365 * F.streamKgHr + (s.phones * F.phoneKg + s.laptops * F.laptopKg) * s.devMul
      : 0;
    return { elec, travel, food, home, goods, digital, parts,
             total: elec + travel + food + home + goods + digital };
  }

  /* Rough yearly rupee cost of the parts of life that recommendations can change (your share). */
  function costs(s) {
    const inc = s.inc || s.include, m = Math.max(1, s.members);
    const e = (inc.elec ? netKwh(s) * 12 * s.tariff / m : 0);
    let t = 0;
    if (inc.travel) {
      const carKm = s.carType === 'ev' ? F.evCarKwh * s.tariff : R.car[s.carType];
      const twKm = s.twoWType === 'ev' ? F.evTwoKwh * s.tariff : R.twoW;
      t = s.car * 52 * carKm / Math.max(1, s.occ) + s.twoW * 52 * twKm + s.auto * 52 * R.auto + s.cab * 52 * R.cab +
          s.bus * 52 * R.bus + s.metro * 52 * R.metro + (s.train * 52 + s.trainExtraKm) * R.train +
          s.flDom * R.flDom + s.flIntl * R.flIntl;
    }
    const l = inc.home ? s.cyl * R.lpgCyl * s.cookMul / m : 0;
    return e + t + l;
  }

  /* ---------- Recommendations ---------- */
  const dietIdx = s => DIETS.findIndex(d => d.id === s.diet);
  const RECS = [
    { id: 'appl', cat: 'elec', effort: 'Easy', cost: 'Low',
      title: 'Set the AC to 24–26 °C, move to 5-star appliances and LEDs',
      detail: 'Typically trims 10–20% of household units. Modelled at 15%.',
      ok: s => monthlyKwh(s) > 0, mod: s => ({ ...s, elecMul: s.elecMul * 0.85 }) },
    { id: 'solar', cat: 'elec', effort: 'Big', cost: 'High upfront',
      title: 'Put rooftop solar on the house, or buy a green-power plan',
      detail: 'Modelled as covering about half of your monthly units. Rupee figure is bill savings, not payback.',
      ok: s => s.solar < monthlyKwh(s) * 0.5, mod: s => ({ ...s, solar: Math.max(s.solar, monthlyKwh(s) * 0.5) }) },
    { id: 'ev2w', cat: 'travel', effort: 'Medium', cost: 'High upfront',
      title: 'Switch your petrol two-wheeler to an electric one',
      detail: 'Electric scooters use roughly 30 Wh per km, charged on the grid mix.',
      ok: s => s.twoWType === 'petrol' && s.twoW > 0, mod: s => ({ ...s, twoWType: 'ev' }) },
    { id: 'evcar', cat: 'travel', effort: 'Big', cost: 'High upfront',
      title: 'Switch your car to an electric car',
      detail: 'About 0.15 kWh per km. The gain grows as the grid gets cleaner.',
      ok: s => s.carType !== 'ev' && s.car > 0, mod: s => ({ ...s, carType: 'ev' }) },
    { id: 'carshift', cat: 'travel', effort: 'Medium', cost: 'Free',
      title: 'Move half your car kilometres to the metro or bus',
      detail: 'Metro is counted at about 28 g CO₂ per passenger-km on the current grid. Fares are netted off the rupee figure.',
      ok: s => s.car > 0, mod: s => ({ ...s, car: s.car / 2, metro: s.metro + s.car / 2 }) },
    { id: 'pool', cat: 'travel', effort: 'Easy', cost: 'Free',
      title: 'Share the ride: carpool so three people travel per trip',
      detail: 'Emissions and fuel cost per person fall as occupancy rises.',
      ok: s => s.car > 0 && s.occ < 3, mod: s => ({ ...s, occ: 3 }) },
    { id: 'flight', cat: 'travel', effort: 'Medium', cost: 'Free',
      title: 'Take the train instead of one domestic flight a year',
      detail: 'Assumes an 1,100 km one-way trip.',
      ok: s => s.flDom >= 1, mod: s => ({ ...s, flDom: s.flDom - 1, trainExtraKm: s.trainExtraKm + F.flTrainKm }) },
    { id: 'diet', cat: 'food', effort: 'Medium', cost: 'Free',
      title: 'Move one step lighter on the diet ladder',
      detail: 'For example, meat-free three or four days a week, or lentils in place of mutton.',
      ok: s => dietIdx(s) > 0, mod: s => ({ ...s, diet: DIETS[dietIdx(s) - 1].id }) },
    { id: 'cook', cat: 'home', effort: 'Easy', cost: 'Free',
      title: 'Cook with lids and a pressure cooker, keep the flame low',
      detail: 'Modelled at about 15% less LPG.',
      ok: s => s.cyl > 0, mod: s => ({ ...s, cookMul: s.cookMul * 0.85 }) },
    { id: 'compost', cat: 'goods', effort: 'Easy', cost: 'Low',
      title: 'Compost kitchen waste and segregate dry waste',
      detail: 'Keeps wet waste out of landfill, where it releases methane.',
      ok: s => !s.compost, mod: s => ({ ...s, compost: true }) },
    { id: 'shop', cat: 'goods', effort: 'Medium', cost: 'Free',
      title: 'Buy 30% less new: repair, resell and buy second-hand',
      detail: 'Clothes, gadgets and furniture carry most of the shopping footprint.',
      ok: s => s.shop !== 'minimal', mod: s => ({ ...s, shopMul: s.shopMul * 0.7 }) },
    { id: 'devices', cat: 'digital', effort: 'Easy', cost: 'Free',
      title: 'Keep phones and laptops twice as long, and repair them',
      detail: 'Making a device causes most of its lifetime emissions.',
      ok: s => s.phones + s.laptops > 0, mod: s => ({ ...s, devMul: s.devMul * 0.5 }) }
  ];

  function rankRecs(s) {
    const base = calc(s).total, baseRs = costs(s);
    return RECS.filter(r => s.include[r.cat] && r.ok(s))
      .map(r => { const n = r.mod(s); return { r, save: base - calc(n).total, rs: baseRs - costs(n) }; })
      .filter(x => x.save >= 1)
      .sort((a, b) => b.save - a.save);
  }
  function applyPlan(s, ids, ranked) {
    let cur = s;
    for (const x of ranked) if (ids.includes(x.r.id) && x.r.ok(cur)) cur = x.r.mod(cur);
    return cur;
  }

  /* ---------- Grade against reference levels (per person per year) ----------
   * All three are consumption-based "lifestyle carbon footprints" in t CO2e, from the same study, so they share one boundary:
   * Akenji et al. (2021), 1.5-Degree Lifestyles, Hot or Cool Institute, as cited in the UNEP report "Enabling Sustainable
   * Lifestyles in a Climate Emergency" (2021). The India and world figures are 2019 data; the 1.5 C figure is the 2030 target.
   * The app does not count every lifestyle category (services, public infrastructure), so the comparison is indicative. */
  const REF = { india: 3000, path15: 2500, world: 4600 };
  const REF_META = {
    india:  { label: 'India average',          year: 2019, basis: 'Lifestyle footprint, t CO2e per person' },
    path15: { label: '1.5 °C lifestyle target', year: 2030, basis: 'Lifestyle footprint target, t CO2e per person' },
    world:  { label: 'World average',          year: 2019, basis: 'Lifestyle footprint, t CO2e per person' },
    source: 'Akenji et al. 2021, 1.5-Degree Lifestyles (Hot or Cool Institute), as cited by UNEP 2021',
    url: 'https://wedocs.unep.org/bitstream/handle/20.500.11822/39972/Lifestyles_climate.pdf?sequence=6'
  };
  function grade(kg) {
    if (kg <= 1500) return { letter: 'A', label: 'Well below the 1.5 °C target', tone: 'good' };
    if (kg <= REF.path15) return { letter: 'B', label: 'Within the 1.5 °C target', tone: 'good' };
    if (kg <= REF.world) return { letter: 'C', label: 'Above the 1.5 °C target', tone: 'warn' };
    if (kg <= 7000) return { letter: 'D', label: 'Above the world average', tone: 'warn' };
    return { letter: 'E', label: 'Very high', tone: 'bad' };
  }

  root.CK = { F, R, DEF, DIETS, SHOP, CATS, REF, REF_META, BASIS, RECS, calc, costs, monthlyKwh, applianceKwh, netKwh, rankRecs, applyPlan, grade };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.CK;
})(typeof window !== 'undefined' ? window : globalThis);

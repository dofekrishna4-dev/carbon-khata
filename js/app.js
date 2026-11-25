/* Carbon Khata: UI. Reads the model from window.CK (js/model.js). */
(function () {
  'use strict';
  const { F, R, DEF, DIETS, SHOP, CATS, REF, REF_META, BASIS, calc, costs, monthlyKwh, netKwh, rankRecs, applyPlan, grade } = window.CK;

  const $ = id => document.getElementById(id);
  const nf = n => Math.round(n).toLocaleString('en-IN');
  const tFmt = kg => (kg / 1000).toFixed(2);
  const kgFmt = kg => (Math.abs(kg) >= 1000 ? tFmt(kg) + ' t' : nf(kg) + ' kg');
  const inr = n => '₹' + nf(Math.abs(n));
  const clone = o => JSON.parse(JSON.stringify(o));
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

  /* ---------- State ---------- */
  const KEY = 'carbon-khata-v2';
  let state = clone(DEF), plan = null, history = [], goalT = 2.5, step = 0, filter = 'all';
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw);
      if (o.state) state = Object.assign(clone(DEF), o.state, {
        include: Object.assign({}, DEF.include, o.state.include || {}),
        elecMul: 1, shopMul: 1, cookMul: 1, devMul: 1, trainExtraKm: 0
      });
      if (Array.isArray(o.plan)) plan = o.plan;
      if (Array.isArray(o.history)) history = o.history;
      if (typeof o.goalT === 'number') goalT = o.goalT;
    }
    const th = localStorage.getItem('ck-theme');
    if (th === 'dark' || th === 'light') document.documentElement.setAttribute('data-theme', th);
  } catch (e) { /* storage unavailable: run without it */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ state, plan, history, goalT })); } catch (e) { /* ignore */ } }

  /* ---------- Form definition ---------- */
  const N = (id, label, min, max, step, unit, small, show) => ({ id, label, type: 'num', min, max, step, unit, small, show });
  const CAT_NOTE = {
    elec: 'Enter units, your bill, or your appliances. Electricity is shared by the household.',
    travel: 'Kilometres you travel in a typical week. Vehicle factors are approximate representative values, not exact for every model.',
    food: 'Pick the line that fits most weeks.',
    home: 'LPG is shared by the household.',
    goods: 'Clothes, gadgets, furniture, online orders.',
    digital: 'Streaming time and new devices.'
  };
  const isMode = m => s => s.elecMode === m;
  const FIELDS = {
    elec: [
      { id: 'elecMode', type: 'seg', label: 'How do you want to enter it?', opts: [['units', 'Units (kWh)'], ['bill', 'Bill (₹)'], ['appliances', 'Appliances']] },
      N('members', 'People in the household', 1, 12, 1, 'people'),
      N('kwh', 'Monthly electricity use', 0, 3000, 10, 'kWh', 'Units consumed, printed on your bill', isMode('units')),
      N('bill', 'Monthly electricity bill', 0, 40000, 100, '₹', 'Average of recent months', isMode('bill')),
      N('acHrs', 'AC hours per day', 0, 24, 0.5, 'hours', 'On days you use it, all ACs together', isMode('appliances')),
      N('acMonths', 'Months you use the AC', 0, 12, 1, 'months', null, isMode('appliances')),
      N('fans', 'Ceiling fans', 0, 20, 1, 'fans', null, isMode('appliances')),
      N('fanHrs', 'Fan hours per day', 0, 24, 1, 'hours', null, isMode('appliances')),
      N('lights', 'Lights (LED)', 0, 60, 1, 'lights', null, isMode('appliances')),
      N('lightHrs', 'Light hours per day', 0, 24, 1, 'hours', null, isMode('appliances')),
      { id: 'fridge', type: 'chk', label: 'Refrigerator', show: isMode('appliances') },
      N('geyserHrs', 'Geyser (water heater)', 0, 8, 0.25, 'hrs/day', 'Average across the year', isMode('appliances')),
      N('washLoads', 'Washing machine loads', 0, 30, 1, 'per week', null, isMode('appliances')),
      N('tvHrs', 'TV hours per day', 0, 24, 0.5, 'hours', null, isMode('appliances')),
      N('pcHrs', 'Laptop or desktop hours per day', 0, 24, 0.5, 'hours', null, isMode('appliances')),
      N('solar', 'Rooftop solar you generate', 0, 3000, 10, 'kWh/mo', 'Leave at 0 if you have none')
    ],
    travel: [
      N('car', 'Car', 0, 3000, 5, 'km/week'),
      { id: 'carType', type: 'sel', label: 'Car fuel', opts: [['petrol', 'Petrol'], ['diesel', 'Diesel'], ['cng', 'CNG'], ['ev', 'Electric']] },
      N('occ', 'People usually in the car', 1, 7, 1, 'people', 'Including you'),
      N('twoW', 'Scooter or motorbike', 0, 3000, 5, 'km/week'),
      { id: 'twoWType', type: 'sel', label: 'Two-wheeler type', opts: [['petrol', 'Petrol'], ['ev', 'Electric']] },
      N('auto', 'Auto-rickshaw (CNG)', 0, 3000, 5, 'km/week'),
      N('cab', 'Taxi or app cab', 0, 3000, 5, 'km/week', 'Your own distance as a passenger; assumes a shared petrol car'),
      N('bus', 'Bus', 0, 3000, 5, 'km/week'),
      N('metro', 'Metro or local train', 0, 3000, 5, 'km/week'),
      N('train', 'Long-distance train', 0, 3000, 5, 'km/week', 'Averaged over the year'),
      N('flDom', 'Domestic flights', 0, 100, 1, 'per year', 'One-way flights, about 1,100 km each'),
      N('flIntl', 'International flights', 0, 60, 1, 'per year', 'One-way flights, about 5,000 km each')
    ],
    food: [{ id: 'diet', type: 'sel', label: 'Diet', opts: DIETS.map(d => [d.id, d.label]) }],
    home: [N('cyl', 'LPG cylinders used', 0, 60, 1, 'per year', '14.2 kg cylinders, whole household')],
    goods: [
      { id: 'shop', type: 'sel', label: 'How much new stuff you buy', opts: [['minimal', 'Little: repair, reuse, second-hand'], ['average', 'Average'], ['frequent', 'Frequent: regular online orders']] },
      { id: 'compost', type: 'chk', label: 'You compost wet kitchen waste' }
    ],
    digital: [
      N('streamHrs', 'Video streaming and gaming', 0, 24, 0.5, 'hours/day'),
      N('phones', 'New phones bought', 0, 6, 0.1, 'per year', 'Use 0.5 for one every two years'),
      N('laptops', 'New laptops bought', 0, 4, 0.1, 'per year', 'Use 0.2 for one every five years')
    ]
  };
  const ADV = { elec: [
    N('grid', 'Grid emission factor', 0.2, 1.2, 0.01, 'kg CO₂/kWh', 'Default 0.675 is the CEA national average for FY 2025-26; edit it for your state'),
    N('tariff', 'Average electricity tariff', 1, 30, 0.5, '₹/kWh', 'Used for the bill option and money saved')
  ] };
  const STEPS = [
    { title: 'Home energy', cats: ['elec'] },
    { title: 'Travel', cats: ['travel'] },
    { title: 'Food and cooking', cats: ['food', 'home'] },
    { title: 'Lifestyle', cats: ['goods', 'digital'] }
  ];

  function mkField(f) {
    const row = el('div', 'row');
    const lab = el(f.type === 'seg' ? 'div' : 'label', 'lab', f.label);
    if (f.type !== 'seg') lab.htmlFor = 'f_' + f.id;
    if (f.small) lab.appendChild(el('small', null, f.small));
    const ctl = el('div', 'ctl');
    if (f.type === 'seg') {
      const seg = el('div', 'seg'); seg.setAttribute('role', 'radiogroup'); seg.setAttribute('aria-label', f.label);
      f.opts.forEach(([v, t]) => {
        const b = el('button', null, t); b.type = 'button'; b.setAttribute('role', 'radio');
        b.setAttribute('aria-checked', String(state[f.id] === v));
        b.addEventListener('click', () => { state[f.id] = v; renderPanel(); update(); });
        seg.appendChild(b);
      });
      ctl.appendChild(seg);
    } else {
      let input;
      if (f.type === 'num') {
        input = el('input'); input.type = 'number'; input.inputMode = 'decimal';
        input.min = f.min; input.max = f.max; input.step = f.step; input.value = state[f.id];
        ctl.append(input, el('span', 'unit', f.unit));
        input.addEventListener('input', () => {
          let v = parseFloat(input.value); if (isNaN(v)) v = 0;
          state[f.id] = Math.min(f.max, Math.max(f.min, v)); update();
        });
      } else if (f.type === 'sel') {
        input = el('select');
        f.opts.forEach(([v, t]) => { const o = el('option', null, t); o.value = v; input.appendChild(o); });
        input.value = state[f.id]; ctl.appendChild(input);
        input.addEventListener('change', () => { state[f.id] = input.value; update(); });
      } else {
        input = el('input'); input.type = 'checkbox'; input.checked = !!state[f.id]; ctl.appendChild(input);
        input.addEventListener('change', () => { state[f.id] = input.checked; update(); });
      }
      input.id = 'f_' + f.id;
    }
    row.append(lab, ctl);
    return row;
  }

  function mkGroup(k) {
    const cat = CATS.find(c => c.k === k);
    const sec = el('section', 'group');
    const h = el('h3'); const d = el('span', 'dot'); d.style.background = 'var(' + cat.c + ')';
    h.append(d, document.createTextNode(cat.name));
    sec.append(h, el('p', 'note', CAT_NOTE[k]));
    (FIELDS[k] || []).filter(f => !f.show || f.show(state)).forEach(f => sec.appendChild(mkField(f)));
    if (k === 'elec' && state.elecMode !== 'units') { const p = el('p', 'derived'); p.id = 'derived'; sec.appendChild(p); }
    if (ADV[k]) {
      const det = el('details', 'adv'); det.appendChild(el('summary', null, 'Advanced'));
      ADV[k].forEach(f => det.appendChild(mkField(f))); sec.appendChild(det);
    }
    return sec;
  }

  function renderChips() {
    const host = $('chips'); host.textContent = '';
    CATS.forEach(c => {
      const b = el('button', 'chip'); b.type = 'button'; b.setAttribute('aria-pressed', String(!!state.include[c.k]));
      const d = el('span', 'dot'); d.style.background = 'var(' + c.c + ')';
      b.append(d, document.createTextNode(c.name));
      b.addEventListener('click', () => { state.include[c.k] = !state.include[c.k]; renderChips(); renderPanel(); update(); });
      host.appendChild(b);
    });
  }
  function renderSteps() {
    const host = $('steps'); host.textContent = '';
    STEPS.forEach((s, i) => {
      const b = el('button', 'step'); b.type = 'button'; b.id = 'tab_' + i;
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(i === step));
      b.append(el('span', 'n', String(i + 1)), document.createTextNode(s.title));
      b.addEventListener('click', () => goStep(i));
      host.appendChild(b);
    });
    $('progress').style.width = ((step + 1) / STEPS.length * 100) + '%';
    $('stepCount').textContent = 'Step ' + (step + 1) + ' of ' + STEPS.length;
    $('backBtn').disabled = step === 0;
    $('nextBtn').textContent = step === STEPS.length - 1 ? 'See my plan' : 'Next: ' + STEPS[step + 1].title;
  }
  function renderPanel() {
    const host = $('panel'); host.textContent = '';
    host.setAttribute('aria-labelledby', 'tab_' + step);
    const cats = STEPS[step].cats, on = cats.filter(k => state.include[k]);
    if (!on.length) {
      const d = el('div', 'empty');
      d.append(el('span', null, 'You switched off everything on this step, so it does not count towards your total.'));
      const b = el('button', 'primary', 'Turn it back on'); b.type = 'button';
      b.addEventListener('click', () => { cats.forEach(k => { state.include[k] = true; }); renderChips(); renderPanel(); update(); });
      d.appendChild(b); host.appendChild(d); return;
    }
    on.forEach(k => host.appendChild(mkGroup(k)));
  }
  function goStep(i) {
    step = i; renderSteps(); renderPanel();
    const top = $('steps').parentElement.getBoundingClientRect().top;
    if (top < 64 || top > window.innerHeight * 0.6) { try { $('steps').parentElement.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* ignore */ } }
  }

  /* ---------- Results ---------- */
  function renderResults(c, total, afterTotal, saved) {
    $('liveTotal').textContent = tFmt(total);
    $('bigT').textContent = tFmt(total);
    const frac = Math.min(1, total / 6000);
    const arc = $('ringArc'); arc.setAttribute('stroke-dasharray', (frac * 100).toFixed(2) + ' 100'); arc.style.opacity = total >= 1 ? 1 : 0;
    [['tickIndia', REF.india], ['tickPath', REF.path15]].forEach(([id, v]) => {
      const t = $(id); t.style.transformOrigin = '110px 110px'; t.style.transform = 'rotate(' + (v / 6000 * 360) + 'deg)';
    });
    const g = grade(total);
    $('gradeL').textContent = g.letter; $('gradeT').textContent = g.label;
    $('ringwrap').dataset.tone = g.tone; document.querySelector('.gradebox').dataset.tone = g.tone;
    $('ringLeg').innerHTML = '<i class="k k-path"></i>' + REF_META.path15.label + ' ' + (REF.path15 / 1000).toFixed(1) + ' t (' + REF_META.path15.year + ') <i class="k k-india"></i>India average ' + (REF.india / 1000).toFixed(1) + ' t (' + REF_META.india.year + ')';
    $('eq').textContent = 'About ' + nf(total / F.tree) + ' mature trees absorbing for a year, or ' + nf(total / F.car.petrol) + ' km in a petrol car.';

    const inc = CATS.filter(k => state.include[k.k]);
    $('stack').innerHTML = inc.map(k => '<i style="width:' + (total ? c[k.k] / total * 100 : 0).toFixed(2) + '%;background:var(' + k.c + ')"></i>').join('');
    const max = Math.max(1, ...inc.map(k => c[k.k]));
    $('lines').innerHTML = inc.length ? inc.map(k => {
      const v = c[k.k], p = total ? Math.round(v / total * 100) : 0;
      return '<div class="line"><span class="nm"><span class="dot" style="background:var(' + k.c + ')"></span>' + k.name +
        '</span><span class="v">' + nf(v) + ' kg · ' + p + '%</span><span class="track"><i style="width:' + (v / max * 100).toFixed(1) + '%;background:var(' + k.c + ')"></i></span></div>';
    }).join('') : '<p class="foot">Nothing is switched on. Pick at least one activity above.</p>';

    const refs = [{ n: 'You, today', v: total, cls: 'you' }];
    if (saved >= 1) refs.push({ n: 'You, with plan', v: afterTotal, cls: 'after' });
    refs.push({ n: 'India average, ' + REF_META.india.year, v: REF.india, cls: '' }, { n: '1.5 °C target, ' + REF_META.path15.year, v: REF.path15, cls: '' }, { n: 'World average, ' + REF_META.world.year, v: REF.world, cls: '' });
    const scale = Math.max(...refs.map(r => r.v)) * 1.02;
    $('cmp').innerHTML = '<div class="h3">How you compare, tonnes CO₂e per person</div>' + refs.map(r =>
      '<div class="c ' + r.cls + '"><span>' + r.n + '</span><span class="t"><i style="width:' + (r.v / scale * 100).toFixed(1) + '%"></i></span><span class="n">' + tFmt(r.v) + '</span></div>').join('') +
      '<p class="foot">Benchmarks are consumption-based lifestyle footprints from one study (<a href="' + REF_META.url + '" target="_blank" rel="noopener">Akenji et al. 2021, via UNEP</a>). Indicative only: this calculator does not cover every lifestyle category.</p>';

    const d = $('derived');
    if (d) d.innerHTML = 'About <b>' + nf(monthlyKwh(state)) + ' kWh</b> a month for the household' + (state.solar > 0 ? ', <b>' + nf(netKwh(state)) + ' kWh</b> after your solar' : '') + '.';
  }

  /* ---------- Plan ---------- */
  const FILTERS = [['all', 'All actions'], ['easy', 'Easy wins'], ['free', 'No cost']];
  function renderPlan(ranked, total, saved, rsSaved, afterTotal) {
    $('planKg').textContent = nf(saved) + ' kg';
    $('planSub').textContent = saved >= 1 ? 'saved per year, ' + Math.round(saved / Math.max(1, total) * 100) + '% of your footprint, leaving ' + tFmt(afterTotal) + ' t' : 'Tick an action below to build a plan';
    $('planRs').textContent = rsSaved >= 100 ? 'About ' + inr(rsSaved) + ' a year back in your pocket' : '';

    const fh = $('filters'); fh.textContent = '';
    FILTERS.forEach(([id, t]) => {
      const b = el('button', 'chip', t); b.type = 'button'; b.setAttribute('aria-pressed', String(filter === id));
      b.addEventListener('click', () => { filter = id; update(); }); fh.appendChild(b);
    });

    const list = ranked.filter(x => filter === 'all' || (filter === 'easy' && x.r.effort === 'Easy') || (filter === 'free' && x.r.cost === 'Free'));
    const top = ranked.length ? ranked[0].save : 1;
    const ol = $('recs'); ol.textContent = '';
    if (!list.length) { ol.appendChild(el('li', 'nomatch', ranked.length ? 'No actions match this filter.' : 'Switch on at least one activity to see recommendations.')); return; }
    list.forEach(x => {
      const on = plan.includes(x.r.id);
      const li = el('li', 'rec' + (on ? ' on' : ''));
      const cb = el('input'); cb.type = 'checkbox'; cb.id = 'r_' + x.r.id; cb.checked = on;
      cb.addEventListener('change', () => { plan = cb.checked ? [...plan, x.r.id] : plan.filter(z => z !== x.r.id); update(); });
      const body = el('div'); const h = el('h3'); const lb = el('label', null, x.r.title); lb.htmlFor = cb.id; h.appendChild(lb);
      if (ranked.indexOf(x) < 3) h.appendChild(el('span', 'badge top', 'Biggest cut'));
      h.appendChild(el('span', 'badge', x.r.effort)); h.appendChild(el('span', 'badge', x.r.cost));
      body.append(h, el('p', null, x.r.detail));
      const sv = el('div', 'save');
      sv.innerHTML = '<span class="t"><i style="width:' + (x.save / top * 100).toFixed(1) + '%"></i></span><b>−' + nf(x.save) + ' kg/yr · ' + Math.round(x.save / Math.max(1, total) * 100) + '%</b>';
      if (Math.abs(x.rs) >= 100) sv.appendChild(el('span', 'rs', x.rs > 0 ? 'Saves about ' + inr(x.rs) + ' a year' : 'Costs about ' + inr(x.rs) + ' more a year'));
      li.append(cb, body, sv); ol.appendChild(li);
    });
  }

  /* ---------- Goal and history ---------- */
  function renderGoal(total, saved) {
    const goalKg = goalT * 1000;
    $('goalFill').style.width = (total <= 0 ? 100 : Math.min(100, goalKg / total * 100)).toFixed(1) + '%';
    let msg;
    if (total <= goalKg) msg = 'You are ' + kgFmt(goalKg - total) + ' under your goal. Keep it going.';
    else {
      const gap = total - goalKg;
      msg = 'You are ' + kgFmt(gap) + ' over your goal. ' + (saved >= gap ? 'Your plan closes the whole gap.' : saved >= 1 ? 'Your plan closes ' + Math.round(saved / gap * 100) + '% of it.' : 'Tick actions in the plan to close it.');
    }
    $('goalMsg').textContent = msg;
  }
  function renderHist(c, total) {
    const goalKg = goalT * 1000;
    const items = history.slice(-11).map(h => ({ label: new Date(h.t).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) + (h.sample ? '*' : ''), total: h.total, cats: h.cats, sample: h.sample }));
    items.push({ label: 'Now', total, cats: c, now: true });
    const max = Math.max(goalKg, ...items.map(i => i.total), 1) * 1.15;
    const host = $('hist'); host.textContent = '';
    items.forEach(i => {
      const col = el('div', 'hcol');
      col.appendChild(el('span', 'hval', tFmt(i.total)));
      const bar = el('div', 'hbar'); bar.style.height = (i.total / max * 100).toFixed(1) + '%';
      if (i.sample) bar.style.opacity = '.55';
      if (i.now) { bar.style.outline = '2px dashed var(--ink)'; bar.style.outlineOffset = '-2px'; }
      CATS.forEach(k => { const v = i.cats[k.k] || 0; if (v > 0) { const s = el('i'); s.style.height = (i.total ? v / i.total * 100 : 0) + '%'; s.style.background = 'var(' + k.c + ')'; bar.appendChild(s); } });
      col.append(bar, el('span', 'hlab', i.label)); host.appendChild(col);
    });
    const gl = el('div', 'goalline'); gl.style.bottom = 'calc(26px + (100% - 26px) * ' + (goalKg / max).toFixed(4) + ')';
    host.appendChild(gl);
    const sc = host.parentElement; sc.scrollLeft = sc.scrollWidth;
    $('legend').innerHTML = CATS.map(k => '<span><i class="dot" style="background:var(' + k.c + ')"></i>' + k.name + '</span>').join('') +
      '<span><i class="goalkey"></i>Your goal, ' + goalT.toFixed(1) + ' t</span>';
    $('histMsg').textContent = history.some(h => h.sample) ? 'Faded bars marked * are demo data made up from your current numbers, not your real history. Save your own snapshots to replace them.' : (history.length ? history.length + ' snapshot' + (history.length > 1 ? 's' : '') + ' saved in this browser.' : 'Snapshots stay in this browser only.');
  }

  /* ---------- Main update ---------- */
  function update() {
    const c = calc(state), total = c.total;
    const ranked = rankRecs(state);
    if (plan === null) plan = ranked.slice(0, 3).map(x => x.r.id);
    const afterState = applyPlan(state, plan, ranked), afterC = calc(afterState);
    const saved = total - afterC.total, rsSaved = costs(state) - costs(afterState);
    renderResults(c, total, afterC.total, saved);
    renderPlan(ranked, total, saved, rsSaved, afterC.total);
    renderGoal(total, saved);
    renderHist(c, total);
    save();
  }

  /* ---------- Method table ---------- */
  function buildFactors() {
    const rows = [
      ['Grid electricity', F.grid + ' kg per kWh', BASIS.grid, 'CEA CO₂ Baseline Database v22.0, FY 2025-26 weighted average (FY 2024-25 was 0.71). Editable.'],
      ['Electricity tariff', '₹8 per kWh', '–', 'Used to turn a bill into units and to show money saved. Editable.'],
      ['Petrol / diesel / CNG car', F.car.petrol + ' / ' + F.car.diesel + ' / ' + F.car.cng + ' kg per km', BASIS.road, 'Approximate representative values per vehicle-km, divided by people in the car. Real values vary by vehicle and engine.'],
      ['Electric car / two-wheeler', F.evCarKwh + ' / ' + F.evTwoKwh + ' kWh per km', BASIS.grid, '× grid factor, so a cleaner grid helps EVs'],
      ['Petrol two-wheeler', F.twoW + ' kg per km', BASIS.road, 'Approximate representative value. India GHG Program lists about 0.029 to 0.054 by engine size.'],
      ['Auto-rickshaw (CNG)', F.auto + ' kg per passenger-km', BASIS.auto, 'About 0.108 per vehicle-km, 1.4 riders'],
      ['Taxi or app cab', F.cab + ' kg per passenger-km', BASIS.cab, 'Assumption: petrol car 0.14 per vehicle-km shared by about 1.5 passengers'],
      ['City bus', F.bus + ' kg per passenger-km', BASIS.bus, 'Rounded from published intracity figures'],
      ['Metro / local train', F.metroKwh + ' kWh per passenger-km', BASIS.metro, '× grid factor'],
      ['Long-distance train', F.train + ' kg per passenger-km', BASIS.train, 'Rounded estimate'],
      ['Flights', F.flDom + ' / ' + F.flIntl + ' kg per flight', BASIS.flights, 'About 1,100 km and 5,000 km one-way at 0.15 kg per passenger-km'],
      ['LPG', F.lpg.toFixed(1) + ' kg per 14.2 kg cylinder', BASIS.lpg, 'About 3.0 kg CO₂ per kg (IPCC default)'],
      ['Diet', DIETS.map(d => d.kg).join(' / ') + ' kg per year', BASIS.diet, 'Vegan to heavy meat, rounded estimates'],
      ['Shopping and waste', Object.values(SHOP).join(' / ') + ' + ' + F.waste + ' (or ' + F.wasteC + ' with compost) kg per year', BASIS.shopping, 'Rounded estimates'],
      ['Digital', F.streamKgHr + ' kg per hour; ' + F.phoneKg + ' kg per phone; ' + F.laptopKg + ' kg per laptop', BASIS.digital, 'Streaming plus device manufacturing']
    ];
    $('factorTbl').innerHTML = '<thead><tr><th>Item</th><th>Factor used</th><th>Measures</th><th>Basis</th></tr></thead><tbody>' +
      rows.map(r => '<tr><td>' + r[0] + '</td><td class="num">' + r[1] + '</td><td>' + r[2] + '</td><td>' + r[3] + '</td></tr>').join('') + '</tbody>';
  }

  /* ---------- Events ---------- */
  $('backBtn').addEventListener('click', () => { if (step > 0) goStep(step - 1); });
  $('nextBtn').addEventListener('click', () => {
    if (step < STEPS.length - 1) goStep(step + 1);
    else { try { $('plan').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { location.hash = 'plan'; } }
  });
  $('resetBtn').addEventListener('click', () => {
    state = clone(DEF); plan = null; renderChips(); renderPanel(); update(); $('copyMsg').textContent = 'Reset to the example household.';
  });
  $('goalT').addEventListener('input', e => {
    let v = parseFloat(e.target.value); if (isNaN(v)) return; goalT = Math.min(10, Math.max(0.5, v)); update();
  });
  $('snapBtn').addEventListener('click', () => {
    const c = calc(state);
    history = history.filter(h => !h.sample);
    history.push({ t: Date.now(), total: c.total, cats: { elec: c.elec, travel: c.travel, food: c.food, home: c.home, goods: c.goods, digital: c.digital } });
    history = history.slice(-24); update();
  });
  $('sampleBtn').addEventListener('click', () => {
    const c = calc(state), f = [1.34, 1.27, 1.2, 1.12, 1.06, 1.02];
    history = f.map((m, i) => {
      const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - (f.length - i));
      const cats = {}; CATS.forEach(k => { cats[k.k] = c[k.k] * m; });
      return { t: d.getTime(), total: c.total * m, cats, sample: true };
    });
    update();
  });
  let clearArmed = null;
  $('clearBtn').addEventListener('click', () => {
    const b = $('clearBtn');
    if (clearArmed) { clearTimeout(clearArmed); clearArmed = null; b.textContent = 'Clear history'; history = []; update(); return; }
    b.textContent = 'Click again to clear'; clearArmed = setTimeout(() => { clearArmed = null; b.textContent = 'Clear history'; }, 4000);
  });
  $('copyBtn').addEventListener('click', () => {
    const c = calc(state), ranked = rankRecs(state), after = applyPlan(state, plan || [], ranked), a = calc(after), g = grade(c.total);
    const lines = ['My carbon footprint (Carbon Khata, indicative estimate): ' + tFmt(c.total) + ' t CO2e per year, grade ' + g.letter + ' (' + g.label + ')']
      .concat(CATS.filter(k => state.include[k.k]).map(k => '- ' + k.name + ': ' + nf(c[k.k]) + ' kg'))
      .concat(['With my plan: ' + tFmt(a.total) + ' t (saves ' + nf(c.total - a.total) + ' kg and about ' + inr(costs(state) - costs(after)) + ' a year)']);
    const txt = lines.join('\n'), msg = $('copyMsg');
    const fallback = () => {
      const ta = el('textarea'); ta.value = txt; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ } ta.remove();
      msg.textContent = ok ? 'Summary copied.' : 'Copy is blocked here. Select the figures on screen instead.';
    };
    try { navigator.clipboard.writeText(txt).then(() => { msg.textContent = 'Summary copied.'; }, fallback); } catch (e) { fallback(); }
  });
  $('themeBtn').addEventListener('click', () => {
    const t = document.documentElement.getAttribute('data-theme');
    const dark = t ? t === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('ck-theme', next); } catch (e) { /* ignore */ }
  });

  /* ---------- Boot ---------- */
  $('goalT').value = goalT;
  renderChips(); renderSteps(); renderPanel(); buildFactors(); update();
})();

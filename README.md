# Carbon Khata
 **Demo link : https://dofekrishna4-dev.github.io/carbon-khata/**

**Personal Carbon Footprint Calculator for India** · Srujan 2026 Mega Hackathon · Problem **SUS-05** (Sustainability, Track T3) · Team **SRJ-0098**

> Problem statement: *Build a calculator that estimates carbon emissions from electricity use, transport and other selected activities and recommends ways to reduce them.*

Carbon Khata ("khata" is the Hindi word for a ledger) turns a person's everyday activity into a yearly carbon account, grades it against the 1.5 °C lifestyle target, and ranks the actions that cut it the most, with the rupees each one saves.

## Every point of the problem statement, and where it lives

| Requirement | What the project does |
|---|---|
| Estimate emissions from **electricity use** | Three ways to enter it: monthly **units (kWh)**, monthly **bill (₹)** converted with a tariff, or an **appliance-by-appliance** estimate (AC, fans, lights, fridge, geyser, washing machine, TV, computer). Rooftop solar is netted off. Result is divided by household size. Grid factor is editable. |
| Estimate emissions from **transport** | Car (petrol, diesel, CNG, electric) with occupancy, two-wheeler (petrol or electric), CNG auto-rickshaw, taxi or app cab, bus, metro, long-distance train, domestic and international flights. |
| Estimate emissions from **other selected activities** | Six activity areas the user can switch on or off with chips: electricity, travel, food, cooking (LPG), shopping and waste, digital (streaming and new devices). Switched-off areas leave the total and the recommendations. |
| **Recommend ways to reduce** them | 12 actions, ranked by kg CO₂e saved *for the user's own numbers*, tagged by effort and cost, with yearly **₹ saved** where it applies. Users tick actions into a plan and see the combined result without double counting. |
| A usable **calculator** | Guided four-step flow, live results, no sign-up, works on phones, light and dark themes. |

## Extras that make it more than a form

- **Ring gauge and grade (A to E)** against India's average, the 1.5 °C lifestyle target and the world average (all from one sourced study, see below).
- **Plan simulator:** tick actions and watch "You, with plan" move, with the money saved.
- **Goal and tracker:** set a yearly target, save monthly snapshots, see a stacked trend chart. Stored in the browser only.
- **Honest numbers:** every factor, its source and whether it measures CO₂ or CO₂e is listed in the Method section, and the limits are stated on the page.

## How the model works

`footprint = Σ activity × emission factor`, per person per year, in kg. It is labelled CO₂e for convenience, but some factors are CO₂ only (see *CO₂ versus CO₂e* below). Shared items (electricity, LPG) are divided by household size.

Recommendations are found by **re-running the same model** on a modified copy of the user's inputs (for example `car = car / 2`, `metro = metro + car / 2`) and taking the difference. That means savings always reflect the user's own habits, and a plan applies actions one after another so effects are not counted twice.

Insight the model surfaces: on today's coal-heavy grid (0.675 kg/kWh) an electric car emits about 0.10 kg/km, which is **more** than a CNG car (about 0.07) and less than petrol (0.14). The app therefore does not suggest an EV to a CNG owner, and EVs get better automatically as the grid factor is lowered.

## Emission factors

| Item | Factor | Source |
|---|---|---|
| Grid electricity | 0.675 kg CO₂/kWh (editable) | CEA CO₂ Baseline Database v22.0, FY 2025-26 weighted average (FY 2024-25 was 0.71) |
| Petrol / diesel / CNG car | 0.14 / 0.15 / 0.07 kg/km | Approximate representative values (India GHG Program; TERI) |
| Petrol two-wheeler | 0.035 kg/km | Approximate representative value; India GHG Program lists about 0.029 to 0.054 by engine size |
| Electric car / two-wheeler | 0.15 / 0.03 kWh/km × grid | ITF/OECD India LCA (direction), rounded |
| Auto-rickshaw (CNG) | 0.077 kg/passenger-km | India GHG Program, 1.4 riders |
| Taxi or app cab | 0.093 kg/passenger-km | Assumption: petrol car 0.14 per vehicle-km shared by about 1.5 passengers |
| City bus | 0.02 kg/passenger-km | Rounded from published intracity figures |
| Metro | 0.042 kWh/passenger-km × grid | Rounded estimate |
| LPG | 3.0 kg CO₂ per kg (42.6 kg per cylinder) | IPCC default |
| Diet, shopping, flights, rail, streaming, devices | Rounded estimates | Published ranges |

**Vehicle factors** are approximate representative values, not exact for every vehicle. Real emissions depend on vehicle type, engine size, age and driving.

**CO₂ versus CO₂e.** Grid electricity, road fuel, bus, metro and LPG factors are CO₂ only, so those parts may slightly understate full CO₂e. Diet, shopping, waste, flights, rail and digital factors are rounded estimates that already include other greenhouse gases. The in-app Method table has a column showing which is which.

**Benchmarks.** All three comparison lines are consumption-based *lifestyle footprints* in t CO₂e per person, from one study, so they share a boundary: India average 3.0 t and world average 4.6 t (2019 data), and the 1.5 °C target of 2.5 t (for 2030). Source: Akenji et al. (2021), *1.5-Degree Lifestyles*, Hot or Cool Institute, as cited in the UNEP report below. They are not comparable with territorial CO₂ statistics (for example India's per-capita CO₂ of about 2.1 t in 2024), and the calculator does not cover every lifestyle category, so the comparison is indicative.

Rupee figures use rough national prices for petrol, LPG, fares and tariff.

Sources: [CEA baseline database](https://cea.nic.in/wp-content/uploads/baseline/2026/09/User_Guide__Version_22.0.pdf) · [India GHG Program road transport factors](https://indiaghgp.org/sites/default/files/Road%20Transport%20Technical%20Paper.pdf) · [TERI Delhi per-passenger study](https://teriin.org/sites/default/transport/Per_passenger_emission_in_Delhi_Different_Modes.pdf) · [ITF/OECD India passenger transport LCA](https://www.itf-oecd.org/sites/default/files/docs/life-cycle-assessment-passenger-transport-india.pdf) · [UNEP, Enabling Sustainable Lifestyles in a Climate Emergency (2021)](https://wedocs.unep.org/bitstream/handle/20.500.11822/39972/Lifestyles_climate.pdf?sequence=6)

## Run it

No build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

Run the model tests (Node 18+):

```bash
node tests/model.test.js
```

## Deploy for free

1. Create a GitHub repository and upload this folder.
2. Settings → Pages → deploy from the `main` branch, root folder.
3. Submit the `https://<username>.github.io/<repo>/` link.

## Project structure

```
index.html          page structure
style.css           design system (light and dark tokens), responsive layout
js/model.js         pure calculation model, no DOM (also used by the tests)
js/app.js           interface: steps, results, plan, tracker
tests/model.test.js 22 checks on the model
PITCH.md            pitch, demo script, likely judge questions
```

## Limitations and future scope

- One national grid factor. Future: state-wise factors and live grid intensity.
- Vehicle factors are representative, not per model. Future: vehicle categories and engine sizes.
- The tracker's "demo history" button creates sample bars from your current numbers. It is not real history.
- Results are indicative estimates; accuracy has not been validated against measured data. Future: upload a bill photo, read units with OCR.
- Embodied emissions of vehicles and appliances are not counted (except phones and laptops).
- Future: neighbourhood or campus leaderboards, shareable report card, Hindi and Marathi interface, carbon-offset suggestions.

## Team

Team SRJ-0098 · Srujan 2026 Mega Hackathon · Problem SUS-05

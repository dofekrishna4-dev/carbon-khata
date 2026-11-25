# Pitch notes: Carbon Khata (SUS-05)

## 30-second pitch

Most carbon calculators give you one scary number and stop. Carbon Khata gives you the number, a grade against the 1.5 °C lifestyle target, and then ranks what to do about it **for your own life**, with the rupees each action saves. It is built for India: bills in ₹ and kWh, LPG cylinders, autos, metro, Indian grid factor. It runs in the browser, needs no sign-up, and every factor is sourced on the page.

## 3-minute demo (click order)

1. **Open the page.** Point at the live total in the top bar and the ring gauge. "2.7 tonnes a year, grade C, with ticks for India's average and the 1.5 °C target."
2. **Switch off Digital** in "What should we count?" "The user chooses which activities count. The total and the recommendations update."
3. **Home energy → Appliances.** "No bill handy? Enter your appliances and we estimate the units." Change AC hours and watch the total move. Show the Bill (₹) option in one sentence.
4. **Travel.** Set car to 120 km/week, diesel. "Occupancy matters: this is per person." Switch fuel to CNG and show it drops.
5. **See my plan.** Show the ranked actions with kg, percent and ₹ saved. Tick two. "The plan total accounts for overlap, so savings are not double counted."
6. **Filter: Easy wins / No cost.** "Start with what is free."
7. **Track.** Set the goal to 2.5 t. Click *Load demo history* to show the trend (say clearly that these bars are sample data, not real history), then *Save this month's snapshot*. "Come back monthly and watch the bars fall."
8. **Method section.** "Every factor and source, and the limits, stated openly."
9. **Dark mode and phone width.** Toggle the theme, then resize the window.

## What makes it different

- **Personalised ranking:** actions are ranked by simulating *your* inputs, not by a generic list.
- **Money next to carbon:** each action shows yearly rupees saved, which is what drives behaviour change.
- **India-first inputs:** units or bill, LPG cylinders, autos, metro, local grid factor and tariff.
- **Honest model:** shows when an action would not help (for example, an EV is not suggested to a CNG-car owner on today's grid).
- **Tested logic:** 22 automated checks on the calculation model.

## Likely judge questions

**How accurate is it?**
It is an indicative estimate, and we have not validated its accuracy against measured data. Factors come from CEA (FY 2025-26 grid factor, 0.675 kg CO₂/kWh), the India GHG Program, TERI and ITF/OECD where available and are rounded where sources give ranges. Vehicle factors are representative values, not exact for every vehicle. All of them are listed in the Method section with whether each is CO₂ or CO₂e, and the grid factor and tariff are editable.

**Why is an EV not always recommended?**
On a grid near 0.675 kg/kWh an EV emits about 0.10 kg/km, more than a CNG car (about 0.07) and less than petrol (0.14). The model uses the grid factor, so EVs automatically look better as it falls. We show that instead of hiding it.

**How do you avoid double counting in the plan?**
Actions are applied one after another to a copy of the user's inputs. A test checks that the combined saving never exceeds the sum of the individual ones.

**Is it CO₂ or CO₂e?**
Mixed, and we say so. Grid, fuel and LPG factors are CO₂ only; food, waste, flights and goods factors are CO₂e estimates. The Method table shows which is which, and energy-related parts may slightly understate full CO₂e.

**Where do the comparison lines come from?**
All three (India 3.0 t, world 4.6 t, 1.5 °C target 2.5 t) are lifestyle footprints in t CO₂e from the Hot or Cool Institute's 1.5-Degree Lifestyles study (Akenji et al. 2021, cited by UNEP). They are consumption-based, so they are not comparable with territorial CO₂ figures such as India's roughly 2.1 t per person.

**Where is the data stored? Is it private?**
Nowhere but the user's browser. No server, no account, no tracking.

**How would this scale?**
The model is a pure function in `js/model.js`, so it can move behind an API or into a mobile app unchanged. Next steps: state-wise grid factors, bill-photo OCR, regional languages, campus and community challenges.

**What are the limits?**
One national grid factor, representative (not per-model) vehicle factors, rough rupee prices, no embodied emissions for vehicles and appliances, and diet and shopping are band estimates. These are stated on the page.

**Why "Khata"?**
A khata is a ledger. The app is a yearly carbon account you can read line by line, with a goal and a history.

## Before you present

- Open the live link once to be sure it loads on the venue network (fonts come from Google Fonts; the page still works without them).
- Use the default example household for the demo and keep a phone ready to show the mobile layout.
- Know your own number: the example household is about 2.7 t per person per year.

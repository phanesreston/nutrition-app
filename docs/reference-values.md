# Reference values

Targets are based on the European Food Safety Authority's Dietary Reference Values (DRVs) for **healthy adults
(18+)**. They are implemented in `src/domain/reference/efsa.ts`.

> **Verification status.** These values were transcribed by hand from EFSA's published DRVs, not imported from a
> machine-readable source. Check them against the EFSA DRV Finder
> (https://multimedia.efsa.europa.eu/drvs/index.htm) before relying on them beyond a prototype.
> Children, adolescents, pregnancy and lactation are not covered.

## Kinds of value

| Term | Meaning | How the app treats it |
| --- | --- | --- |
| **PRI** — Population Reference Intake | Covers the needs of ~97.5% of people | Minimum target |
| **AI** — Adequate Intake | Used when a PRI cannot be set | Minimum target |
| **Safe and adequate intake** | Sodium only | A limit: aim to stay at or below |
| **UL** — Tolerable Upper Intake Level | Highest chronic intake unlikely to cause harm | Flagged at ≥ 80% ("near") and > 100% ("above") |
| **Safe level of intake** | Given where a UL cannot be derived (iron, manganese) | Treated like a UL, labelled differently |
| **Estimate / Derived / Generic** | Not EFSA values for the individual: see below | Labelled as such |
| **Your goal** | Entered by the user | Overrides the default, labelled "Your goal" |

## Micronutrients (per day)

| Nutrient | Men | Women | Kind | Upper level | Upper level applies to |
| --- | --- | --- | --- | --- | --- |
| Vitamin A (µg) | 750 | 650 | PRI | 3,000 | Preformed vitamin A (retinol) only |
| Thiamin B1 (mg) | 0.1 per MJ | 0.1 per MJ | PRI | – | |
| Riboflavin B2 (mg) | 1.6 | 1.6 | PRI | – | |
| Niacin B3 (mg NE) | 1.6 per MJ | 1.6 per MJ | PRI | 10 | Supplemental nicotinic acid only — not evaluated |
| Pantothenic acid B5 (mg) | 5 | 5 | AI | – | |
| Vitamin B6 (mg) | 1.7 | 1.6 | PRI | 12 | Total |
| Biotin B7 (µg) | 40 | 40 | AI | – | |
| Folate B9 (µg DFE) | 330 | 330 | PRI | 1,000 | Synthetic folic acid only |
| Vitamin B12 (µg) | 4 | 4 | AI | – | |
| Vitamin C (mg) | 110 | 95 | PRI | – | |
| Vitamin D (µg) | 15 | 15 | AI | 100 | Total |
| Vitamin E (mg α-tocopherol) | 13 | 11 | AI | 300 | Total |
| Vitamin K (µg phylloquinone) | 70 | 70 | AI | – | |
| Calcium (mg) | 1,000 (18–24) / 950 (25+) | same | PRI | 2,500 | Total |
| Iron (mg) | 11 | 16 premenopausal / 11 postmenopausal | PRI | 40 (safe level) | Total |
| Magnesium (mg) | 350 | 300 | AI | 250 | Supplements only — not evaluated |
| Potassium (mg) | 3,500 | 3,500 | AI | – | |
| Sodium (mg) | 2,000 | 2,000 | Safe and adequate | – | |
| Zinc (mg) | 11.7 | 9.3 | PRI (at 600 mg/day phytate) | 25 | Total |
| Selenium (µg) | 70 | 70 | AI | 255 | Total |
| Copper (mg) | 1.6 | 1.3 | AI | 5 | Total |
| Manganese (mg) | 3 | 3 | AI | 8 (safe level) | Total |
| Phosphorus (mg) | 550 | 550 | AI | – | |
| Iodine (µg) | 150 | 150 | AI | 600 | Total |

When sex is not specified the higher of the two values is used. Menopausal status is assumed from age (51+).

## Energy and macronutrients

| Target | Default | Origin |
| --- | --- | --- |
| Energy | Mifflin–St Jeor resting energy × activity factor (1.2 / 1.375 / 1.55 / 1.725 / 1.9), −500 kcal to lose, +300 kcal to gain, floor 1,200 kcal | **Estimate** — a common approach, not EFSA's method (EFSA uses Henry equations and PAL values) |
| Energy, profile incomplete | 2,000 kcal | **Generic** — EU labelling reference intake (Reg. (EU) 1169/2011) |
| Protein | 0.83 g per kg body weight | PRI (50 g generic fallback without a weight) |
| Fat | 30% of energy | **Derived** — inside EFSA's 20–35 E% range |
| Carbohydrate | 50% of energy | **Derived** — inside EFSA's 45–60 E% range |
| Fibre | 25 g | AI |

## Known mismatches between the food data and the references

- **Vitamin A**: USDA reports retinol activity equivalents (RAE); EFSA's PRI is in retinol equivalents (RE). RAE counts
  provitamin A carotenoids at half the RE rate, so plant-heavy intakes read lower here than they would in RE.
- **Niacin**: the PRI is in niacin equivalents (including niacin made from tryptophan); the food data is preformed
  niacin only, so intake is understated.
- **Vitamin K**: phylloquinone (K1) only; menaquinones (K2) are not counted.
- **Biotin, iodine**: no values in USDA SR Legacy. Shown as "No data", never as zero.
- **Selenium**: US values; European-grown plant foods are typically lower.
- **Sodium**: salt added in cooking or at the table is counted only if logged.

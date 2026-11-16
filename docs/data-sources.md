# Food composition data sources

The app keeps the source database, the source's own food identifier, the unit of every value and the licence for
each food. Sources plug in through `FoodSourceAdapter` (`src/food-sources/types.ts`): one function that maps a
native record to `NormalisedFood`.

> Details for the sources **not yet integrated** (everything except USDA SR Legacy) are from general knowledge of
> these datasets and were not re-checked against the publishers' sites while writing this. Confirm current
> versions and licence terms before integrating any of them.

## In use: USDA SR Legacy (via FoodData Central)

| | |
| --- | --- |
| Publisher | U.S. Department of Agriculture, Agricultural Research Service |
| Release | Standard Reference Legacy, April 2018 — the final SR release; no longer updated |
| Coverage | 7,793 foods, mostly generic/commodity foods, per 100 g edible portion, with household portions |
| Licence | Public domain (CC0 1.0). USDA asks to be cited |
| Access | Free bulk download (JSON/CSV), no key: https://fdc.nal.usda.gov/download-datasets |
| In this repo | 221 curated foods in `data/seed/foods.json`, selected by `data/seed/curated-foods.txt`. Values are copied unmodified; only the administrative suffix on some names is removed |

**Nutrients mapped** (FDC nutrient id): energy 1008, protein 1003, fat 1004, carbohydrate by difference 1005,
fibre 1079, sugars 2000, saturated fat 1258, vitamin A RAE 1106, retinol 1105, thiamin 1165, riboflavin 1166,
niacin 1167, pantothenic acid 1170, B6 1175, folate DFE 1190, folic acid 1186, B12 1178, C 1162, D 1114,
E (α-tocopherol) 1109, K (phylloquinone) 1185, calcium 1087, iron 1089, magnesium 1090, potassium 1092, sodium 1093,
zinc 1095, selenium 1103, copper 1098, manganese 1101, phosphorus 1091.

**Limitations**

- **No iodine and no biotin** anywhere in the release. USDA publishes iodine separately (USDA/FDA/ODS-NIH iodine
  database) — a candidate for a later import.
- Not every food has every nutrient. In the seed set, vitamin K is missing for 12 foods, vitamins D and E for 9 each,
  pantothenic acid for 7, selenium and folate for 4 each.
- US foods, US fortification practice (e.g. enriched flour, vitamin D milk) and US soils; frozen in 2018.
- Many values are calculated or imputed by USDA rather than analysed; the download marks each value's derivation,
  which the app does not yet store.
- Vitamin A is in RAE, niacin is preformed only, vitamin K is K1 only (see `reference-values.md`).

## In use: Open Food Facts (packaged products, by barcode)

| | |
| --- | --- |
| Publisher | Open Food Facts, a non-profit; data entered by volunteers and some manufacturers |
| Coverage | Several million packaged products worldwide, keyed by barcode; strongest in Europe |
| Access | Product API v3: `GET https://world.openfoodfacts.org/api/v3/product/<barcode>.json`, no key |
| Licence | Database: Open Database License (ODbL) 1.0. Individual contents: Database Contents License. Product images: CC BY-SA |
| In this app | Fetched one product at a time when a barcode is scanned, then cached in PostgreSQL |

**What is read**: name, brand, quantity, serving size, ingredients text, front image URL, category, and the
declared per-100 values in `nutriments`. The API normalises every mass value to grams per 100 g (iron `0.012`
means 12 mg) and energy to kcal; the mapper converts to the catalogue's units. This was verified against live
responses, and trimmed copies of four real responses are the test fixtures.

**Nutrients mapped** (Open Food Facts id): energy-kcal (or energy-kj converted), proteins, carbohydrates, fat,
fiber, sugars, saturated-fat, vitamin-a, vitamin-b1, vitamin-b2, vitamin-pp (niacin), pantothenic-acid, vitamin-b6,
biotin, vitamin-b9, vitamin-b12, vitamin-c, vitamin-d, vitamin-e, vitamin-k, calcium, iron, magnesium, potassium,
sodium, zinc, selenium, copper, manganese, phosphorus, iodine, chloride, fluoride, chromium, molybdenum, choline.
The last five are stored and shown on the product but have no dashboard meter or target yet.

**Limitations**

- **Micronutrients are usually absent.** Labels only have to state energy, fat, saturates, carbohydrate, sugars,
  protein and salt; vitamins and minerals appear mainly on fortified products. Absent values are stored as
  unknown, so a day of mostly packaged food shows many "≥" and "No data" figures. That is the honest answer.
- Open Food Facts also publishes values *estimated from the ingredient list* (`nutriments_estimated`). They are
  deliberately not used.
- Crowd-sourced: names, brands and figures can be wrong, incomplete or in another language. The preview links to
  the product page and offers "enter your own values", which saves a custom food that takes precedence.
- Sodium is usually derived from the salt figure. Carbohydrate on EU labels excludes fibre, whereas USDA's
  "by difference" figure includes it.
- Drinks: Open Food Facts often records "per 100 g" even when the label is per 100 ml. A product whose serving or
  pack size is in millilitres is treated as per 100 ml.

**Usage rules the app follows**

- Requests are made server-side with an identifying `User-Agent` (`OFF_USER_AGENT`; set it to your app name and a
  contact). Open Food Facts asks for this and may block clients without it.
- The documented limit is 100 product reads per minute. The app caps itself at 40 per minute, backs off for a
  minute after any HTTP 429, caches every product for 30 days and remembers unknown barcodes for 10 minutes.
- Attribution to Open Food Facts with a link is shown on the scan screen, in every product preview and on the
  product's detail page. Images are linked from Open Food Facts' servers, not copied.

**Licence obligations to keep in mind** (a summary, not legal advice)

- ODbL requires attribution, and share-alike for *publicly used adapted databases*: if you publish or
  redistribute a database that incorporates Open Food Facts data, that database must be offered under ODbL too.
- The app keeps Open Food Facts records separate and identifiable (`sourceId = "open-food-facts"`) rather than
  merging them into the USDA data, which keeps that boundary clear. Running the app for yourself does not
  redistribute the database. Exporting or publishing the cached products would.

### Other FoodData Central data types (not integrated)

| Type | Notes |
| --- | --- |
| Foundation Foods | Newer analytical data with sample metadata; a few hundred foods, updated twice a year; some iodine values |
| FNDDS (Survey) | ~7,000 foods as eaten, including mixed dishes; 65 nutrients; values largely derived from SR |
| Branded Foods | Hundreds of thousands of label entries from industry; label nutrients only, so micronutrient coverage is poor |

The FDC REST API needs a free api.data.gov key and is rate-limited; the adapter here reads the bulk download format,
and FDC nutrient ids are the same across data types, so `FDC_NUTRIENT_IDS` can be reused.

## Candidate: UK CoFID

McCance and Widdowson's *Composition of Foods Integrated Dataset*, published by the UK government (OHID, formerly
Public Health England). About 2,900 foods in an Excel workbook.

- **Strengths**: UK/European foods and recipes; includes **iodine**, **biotin**, selenium, and both total and
  component vitamin values; vitamin A as retinol equivalents and niacin equivalents, which match EFSA's units.
- **Licence**: Open Government Licence v3.0 (attribution required) — to be confirmed for the release used.
- **Limitations**: some analytical values are decades old; cells may contain `Tr` (trace) and `N` (present in
  significant quantity but not determined), which must map to "small known value" and "missing" respectively — never
  both to zero; no household portion weights in the dataset.

## Candidates: other European datasets

| Dataset | Country / publisher | Notes |
| --- | --- | --- |
| CIQUAL | France, ANSES | ~3,000 foods, ~60 components including iodine; open licence (Licence Ouverte); French and English names |
| Frida | Denmark, DTU | ~1,300 foods; broad micronutrient coverage including iodine and biotin; free with attribution |
| Fineli | Finland, THL | ~4,000 foods; open data (CC BY 4.0) |
| NEVO | Netherlands, RIVM | ~2,300 foods; free download subject to RIVM's terms |
| BLS | Germany, MRI | ~7,000+ foods, very complete nutrient matrix (largely calculated); licence terms changed with version 4 — check |
| EuroFIR FoodEXplorer | EuroFIR AISBL | Harmonised access to many national datasets; membership required |

## Integration notes for the next source

1. Write an adapter that returns `NormalisedFood` and a `FoodSourceInfo` with the licence.
2. Convert every value to the catalogue unit with `convertAmount`; it throws on unknown or incommensurable units
   (including IU) rather than guessing.
3. Leave absent, `N`, or non-numeric values out of `nutrients`. Keep reported zeros.
4. Mixing sources means mixing definitions (RE vs RAE, NE vs niacin, fibre methods). Storing the definition alongside
   each value is the next schema step before a second source is merged into the same totals.

# Architecture

## Layers

| Layer | Location | May import | Responsibility |
| --- | --- | --- | --- |
| Domain | `src/domain` | `decimal.js` only | Nutrient catalogue, units, reference values, all nutrition maths |
| Food sources | `src/food-sources` | Domain | Map external databases to `NormalisedFood`; bulk import |
| Server | `src/server` | Domain, Prisma | Queries, view models, validated server actions, the auth seam |
| UI | `src/app`, `src/components` | Server (types and actions), Domain | Rendering and interaction |

The domain layer has no knowledge of Next.js, React or Prisma, so a mobile client (React Native, or a native app
talking to an API built on `src/server`) can reuse it unchanged. `GET /api/foods/search` is the first such endpoint.

## Database

```
User 1─1 Profile
User 1─* DiaryEntry *─1 Food *─1 FoodSource
                         Food 1─* FoodNutrient   (one row per known nutrient, per 100 g)
                         Food 1─* FoodPortion    (household measures with gram weights)
```

- **FoodSource** — the database a food came from, with version and licence.
- **Food** — unique on `(sourceId, sourceFoodId)`, so provenance is never lost and re-imports are idempotent.
- **FoodNutrient** — `(foodId, nutrientKey)` → `amount NUMERIC(14,4)` + `unit`. No row means the value is unknown.
- **FoodPortion** — label and gram weight, e.g. "1 cup, chopped" = 21 g.
- **DiaryEntry** — calendar `date`, `meal`, the amount as the user expressed it (`quantity` × `unitLabel`,
  `unitGrams`), the resolved `grams`, and `per100g`: a snapshot of the food's nutrient values at the moment of
  logging. Totals are computed from the snapshot, so correcting a food never rewrites days already recorded.
- **FoodOverride**, **FoodAudit**, **FoodImage** — admin corrections, their history and uploaded photos (below).
- **Profile** — everything targets depend on, all optional, plus the user's own energy/macro goals.

Data completeness is derived, not stored: of the 29 core nutrients (5 macro + 24 micro), how many have a row.

## From a logged food to the dashboard

1. `addDiaryEntry` (server action) validates input with Zod, looks the portion's gram weight up in the database
   (the client's figure is never trusted) and stores `grams = quantity × unitGrams`.
2. `getDayView` loads the day's entries with their foods and calls the domain:
   - `summariseIntake` scales each per-100 g value by grams and sums per nutrient, tracking which entries had no value.
   - `computeTargets` turns the profile into targets with an origin, a direction and any upper level.
   - `assessNutrient` produces a status: `below`, `met`, `within` (limit-type), `near-upper`, `over`, `no-data`.
3. The result is converted to plain numbers and rendered by server components; charts are client components.

## Barcode lookup

```
camera / typed number
  -> GET /api/barcode/[code]            src/app/api/barcode/[code]/route.ts
  -> lookupBarcode()                    src/server/barcode.ts
       1. parseBarcode(): check digit, canonical form          src/domain/barcode.ts
       2. the user's own custom food with that barcode
       3. cached Open Food Facts product younger than 30 days
       4. Open Food Facts API v3 (8 s timeout, rate-limited)   src/food-sources/open-food-facts/client.ts
       5. normaliseOffProduct() -> importFoods()               …/mapper.ts, src/food-sources/import.ts
  -> product preview -> existing serving form -> existing addDiaryEntry action
```

A scanned product is an ordinary `Food` row (`sourceId = "open-food-facts"`, `sourceFoodId` = barcode) with
`FoodNutrient` and `FoodPortion` rows, so the diary, totals, targets and dashboard need no special handling.
`Food` carries the packaged-product extras: `barcode`, `brand`, `imageUrl`, `ingredients`, `amountUnit`
(`"g"`, or `"ml"` for drinks whose values are per 100 ml — diary amounts for that food are then in ml),
`fetchedAt` (cache age) and `createdByUserId` (custom foods, visible only to their owner).

Barcodes are stored in one canonical form: EAN-8 as 8 digits; UPC-A zero-padded to 13 digits, which is also how
Open Food Facts stores them; EAN-13 unchanged. UPC-E from a scanner is expanded to UPC-A first.

Failure handling: an invalid code never leaves the server (HTTP 400); an unknown product is remembered for
10 minutes and offers the custom-food form; a timeout, outage or rate limit falls back to an expired cached copy
if there is one (marked as such) and otherwise reports the specific reason with a retry.

The scanner uses the browser's `BarcodeDetector` where it supports retail codes and otherwise the
`barcode-detector` ponyfill (ZXing compiled to WebAssembly). A code is accepted only when read identically in
two consecutive frames and its check digit is valid.

## Corrections, overrides and imports

```
Food.sourceData   the record exactly as imported (never edited)
FoodOverride      one row per corrected field: value, estimated flag, who, when
        │
        ▼  mergeFood()            src/food-sources/merge.ts   (pure, unit-tested)
Food / FoodNutrient / FoodPortion   the EFFECTIVE values everything else reads
```

`materialiseFood()` in `src/food-sources/store.ts` is the only code that writes nutrients and portions. Bulk
imports, barcode refreshes, custom foods and admin saves all store their input (a new imported record, or an
override) and then call it. Because the merge is re-run on every import, an import cannot overwrite a correction.
Search, barcode lookup, the product page and the dashboard read the effective columns, so they need no changes and
see corrections immediately.

Value priority, highest first: administrator override → values declared on the pack (Open Food Facts, custom
foods) → reference database values (USDA) → source estimates → unknown. Each food has one imported record, so the
rule that does the work is "an override beats the source". `FoodNutrient.origin` records which tier each effective
value came from (`admin`, `admin-estimate`, `label`, `reference`, `user`). Source estimates are tier 4 on paper
only: Open Food Facts' ingredient-based estimates are still not imported. An administrator can flag their own
value as an estimate, which is tracked and shown.

An override's value may be null, meaning "explicitly unknown" (or "no image", "no serving"). That is different
from zero and different from having no override, so all three states survive a round trip.

Saving (`applyFoodEdits`, `src/server/admin/food-admin.ts`) is one transaction: validate every field, upsert or
delete overrides (a value equal to the imported one deletes the override), write one `FoodAudit` row per field
that actually changed, re-merge. One invalid field rejects the whole save. Reverting an audit entry applies its
old value through the same path.

Rows created before `sourceData` existed have their imported record rebuilt from the row on first use, which is
correct because nothing could have edited them before overrides existed.

## Administrator access

There are no user accounts, so admin rights come from a password in `ADMIN_PASSWORD` (`src/server/admin/session.ts`,
`auth.ts`). Sign-in compares in constant time, is locked for 15 minutes after five failures, and sets an HTTP-only,
SameSite=Lax cookie holding `v1.admin.<expiry>.<HMAC>`, signed with a key derived from the password. `getAdmin()`
verifies it and is called by every admin page (`requireAdminPage`), every admin server action and the upload
endpoint. Pages are streamed, so an unauthenticated request receives only the empty shell and a redirect.

When real sign-in is added, `getAdmin()` is the one function to change: return the signed-in user if their role
is admin.

## Rendering model

Next.js Cache Components is on: the shell (navigation) is prerendered and each page's data streams in behind its
`loading.tsx` boundary. All user data is request-time (`getCurrentUser` awaits `connection()`); nothing user-specific
is cached. Mutations are server actions that call `revalidatePath`.

"Today" is the server's local date. For a local app that is the user's date; a hosted version should store a
timezone on the profile.

## Testing

`npm run test:integration` runs against a separate PostgreSQL database and covers the admin feature end to end
at the service level: updating products, rejection of unauthenticated/forged/expired sessions, persistence, barcode
lookups returning corrected values, bulk and barcode-refresh imports not overwriting corrections, restore and
revert, image validation and replacement, and diary entries keeping their logged values until an explicit
recalculation.

`npm test` covers the domain and the source adapters: portion scaling, decimal exactness, missing-vs-zero, coverage
states, upper-level rules (retinol-only, supplements-only), limit-type nutrients, target computation by sex, age,
weight and energy, and unit conversion. The end-to-end flow was verified in a browser during development; an
automated Playwright suite is a sensible addition in Phase 2.

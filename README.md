# Nourish — micronutrient-focused nutrition tracking

A nutrition tracker that goes past calories and macros: every food you log updates 13 vitamins and 11 minerals
against EFSA reference values, with honest handling of missing data and upper limits.

This is the **Phase 1 prototype**: a local, single-user app with a working daily logging workflow.

## What works today

- **Dashboard** — energy, macros, energy split, per-meal energy chart, and a progress meter for every vitamin and mineral.
- **Food Diary** — breakfast / lunch / dinner / snacks; add, edit and delete entries; browse any day.
- **Food Search** — 221 real foods from USDA SR Legacy, with a per-food nutrient table, serving sizes and provenance.
- **Scan Barcode** — scan a pack with a phone camera (or type the number) to look a product up in Open Food Facts,
  preview it, pick a serving and log it. Unknown products can be entered from the label and tied to the barcode.
- **Nutrients** — every nutrient expandable: amount, reference, type of reference (PRI / AI / limit), upper level,
  what it does, food sources, caveats, and which logged foods supplied it.
- **Settings** — profile (age, sex, height, weight, activity, goal), your own energy/macro targets, the resulting
  target table, light and dark mode.
- Everything is stored in PostgreSQL and survives restarts.

Not built yet (see [Roadmap](#roadmap)): insights and gap analysis, recommendations, history charts, saved meals,
copying meals, sign-in.

## Run it locally

Requirements: Node.js 20.9+ and Docker (or any PostgreSQL 14+).

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npm run db:up
```

```bash
npm run db:setup
```

```bash
npm run dev
```

Open http://localhost:3000.

- `npm run db:up` starts PostgreSQL 16 in Docker (`docker-compose.yml`). To use your own PostgreSQL instead, skip it
  and point `DATABASE_URL` in `.env` at your database.
- `npm run db:setup` applies the migrations and loads the seed foods. It is safe to re-run.

### Barcode scanning

- **The camera needs HTTPS.** Browsers only allow camera access on `https://` pages and on `localhost`. Over plain
  `http://` on another address the scan screen says so and manual entry still works.
- **Set `OFF_USER_AGENT` in `.env`** to something that identifies your deployment, e.g.
  `"Nourish/0.1 (you@example.com)"`. Open Food Facts asks every app for this and may block anonymous clients.
- Lookups go through this app's server (`GET /api/barcode/<code>`), never straight from the browser. Each product is
  saved to PostgreSQL on first scan, so repeat scans make no outside request.
- The barcode reader (ZXing, WebAssembly) is served by the app itself; `npm install` copies it into `public/vendor/`.

### Other commands

| Command | What it does |
| --- | --- |
| `npm test` | Unit tests for the nutrition maths, reference values, unit conversion and the USDA adapter |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run build` then `npm start` | Production build |
| `npm run db:migrate` | Create/apply a migration after editing `prisma/schema.prisma` |
| `npm run db:import-fdc -- <file>` | Import the **full** USDA SR Legacy download (~7,800 foods) |
| `npm run seed:build -- <file>` | Rebuild `data/seed/foods.json` from the USDA download and `curated-foods.txt` |

The USDA file for the last two is "SR Legacy" (JSON) from https://fdc.nal.usda.gov/download-datasets.

## Architecture

```
src/
  domain/          Pure TypeScript, no framework or database imports. Reusable by a mobile client.
    nutrients/       catalogue of nutrients (units, copy) and unit conversion
    reference/       EFSA reference values and target computation from a profile
    calc/            portion maths, intake summation, status assessment
  food-sources/    Integration layer: each database maps to one normalised food shape
    usda/            USDA SR Legacy adapter
    open-food-facts/ Open Food Facts API client and mapper (barcode lookups)
  server/          Database access and use-cases (foods, diary day view, profile), server actions
  app/             Next.js routes (UI only) and the JSON search API
  components/      UI components; components/ui holds shadcn/ui-style primitives
prisma/            Schema, migrations, seed
data/seed/         Curated food list and the generated seed file
docs/              Data sources and reference values, with their limitations
```

Three rules hold the design together:

1. **Missing is not zero.** A nutrient the source does not report has no database row. Totals are computed over
   known values only, and the UI shows "≥" (some foods lack a value) or "No data" (none have one).
2. **Decimal arithmetic.** Amounts are `NUMERIC` in PostgreSQL and `decimal.js` in the domain layer; numbers are only
   converted to floats at the display boundary.
3. **Not all targets behave alike.** A target has an origin (PRI, AI, safe-and-adequate, estimate, your own goal)
   and a direction (reach it, stay under it, land near it). Upper levels are evaluated only against the form they
   apply to — retinol for vitamin A, folic acid for folate — and not at all when they concern supplements only.

More detail: [docs/architecture.md](docs/architecture.md), [docs/data-sources.md](docs/data-sources.md),
[docs/reference-values.md](docs/reference-values.md).

### Stack notes

- Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS 4, Recharts 3, Prisma 6, PostgreSQL, Zod, Vitest.
- UI primitives follow shadcn/ui conventions (`components.json` is present, so `npx shadcn add <component>` works),
  but the initial ones were written by hand.
- **Authentication is deliberately deferred.** The app has one seeded local user; `src/server/auth.ts` is the single
  place to swap in real sessions, and every query is already scoped by user id.

## Roadmap

| Phase | Scope |
| --- | --- |
| **1 (done)** | App shell, dashboard, food database, logging, live macro and micronutrient totals, targets, persistence |
| 1b (done) | Barcode scanning, Open Food Facts lookup with local caching, custom foods from a label |
| 2 | Editing custom foods, saved meals, copy a meal from a previous day, per-nutrient custom targets |
| 3 | Nutrient gap analysis: weekly averages, persistent vs. one-off lows, upper-limit and insufficient-data views |
| 4 | Rules-based food recommendations that respect diet, allergies, energy budget and upper limits |
| 5 | History: calendar, weekly/monthly trends, per-nutrient trends, target consistency |
| 6 | Sign-in and multi-user, more food databases (CoFID, CIQUAL), iodine and biotin coverage |

## Important

Intake figures are estimates from food composition tables. Reference values describe populations of healthy adults.
Nothing here diagnoses a deficiency or replaces advice from a health professional.

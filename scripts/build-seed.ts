/**
 * Builds data/seed/foods.json from the official USDA SR Legacy download and
 * the curated list in data/seed/curated-foods.txt.
 *
 *   npm run seed:build -- /path/to/FoodData_Central_sr_legacy_food_json_2018-04.json
 *
 * Download: https://fdc.nal.usda.gov/download-datasets ("SR Legacy", JSON).
 * No values are edited: this only selects foods and maps them to the app's
 * normalised shape.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { cleanDescription, usdaSrLegacy, type FdcFood } from "../src/food-sources/usda/sr-legacy";

const input = process.argv[2];
if (!input) {
  console.error("Usage: npm run seed:build -- <SR Legacy JSON file>");
  process.exit(1);
}

const seedDir = path.join(__dirname, "..", "data", "seed");
const wanted = readFileSync(path.join(seedDir, "curated-foods.txt"), "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

const raw = JSON.parse(readFileSync(input, "utf8")) as { SRLegacyFoods: FdcFood[] };
const byName = new Map(raw.SRLegacyFoods.map((f) => [cleanDescription(f.description), f]));

const missing: string[] = [];
const foods = [];
for (const name of wanted) {
  const food = byName.get(name);
  const normalised = food && usdaSrLegacy.normalise(food);
  if (!normalised) missing.push(name);
  else foods.push(normalised);
}
if (missing.length) {
  console.error(`Not found in the dataset:\n  ${missing.join("\n  ")}`);
  process.exit(1);
}

const out = { source: usdaSrLegacy.info, generatedFrom: path.basename(input), foods };
writeFileSync(path.join(seedDir, "foods.json"), JSON.stringify(out, null, 1) + "\n");
console.log(`Wrote ${foods.length} foods to data/seed/foods.json`);

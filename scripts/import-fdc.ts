/**
 * Imports an entire FoodData Central JSON download (SR Legacy format) into
 * the database — about 7,800 foods instead of the curated seed subset.
 *
 *   npm run db:import-fdc -- /path/to/FoodData_Central_sr_legacy_food_json_2018-04.json
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { importFoods } from "../src/food-sources/import";
import { usdaSrLegacy, type FdcFood } from "../src/food-sources/usda/sr-legacy";

async function main() {
  const input = process.argv[2];
  if (!input) {
    console.error("Usage: npm run db:import-fdc -- <SR Legacy JSON file>");
    process.exit(1);
  }
  const raw = JSON.parse(readFileSync(input, "utf8")) as { SRLegacyFoods: FdcFood[] };
  const foods = raw.SRLegacyFoods.map((f) => usdaSrLegacy.normalise(f)).filter((f) => f !== null);
  const prisma = new PrismaClient();
  try {
    console.log(`Importing ${foods.length} foods…`);
    await importFoods(prisma, usdaSrLegacy.info, foods);
    console.log("Done.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

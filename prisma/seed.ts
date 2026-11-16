import { readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import type { FoodSourceInfo, NormalisedFood } from "../src/food-sources/types";
import { importFoods } from "../src/food-sources/import";

const prisma = new PrismaClient();

async function main() {
  const file = path.join(__dirname, "..", "data", "seed", "foods.json");
  const seed = JSON.parse(readFileSync(file, "utf8")) as { source: FoodSourceInfo; foods: NormalisedFood[] };
  const count = await importFoods(prisma, seed.source, seed.foods);
  console.log(`Seeded ${count} foods from ${seed.source.name}`);

  // Authentication is not part of the first prototype: one local user owns all data.
  await prisma.user.upsert({
    where: { email: "local@nutrition.app" },
    update: {},
    create: { email: "local@nutrition.app", name: "Local user", profile: { create: {} } },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

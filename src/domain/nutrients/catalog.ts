/**
 * The nutrient catalogue: every nutrient the app knows about, its canonical
 * unit, and plain-language educational copy.
 *
 * This file is framework-free so it can be shared with a future mobile client.
 * Reference intakes are NOT defined here (they depend on the person) — see
 * `src/domain/reference/efsa.ts`.
 */

export type Unit = "kcal" | "g" | "mg" | "µg";

export type NutrientGroup = "macro" | "vitamin" | "mineral" | "other" | "auxiliary";

export const NUTRIENT_KEYS = [
  // Energy and macronutrients
  "energy",
  "protein",
  "carbs",
  "fat",
  "fibre",
  // Vitamins
  "vitaminA",
  "thiamin",
  "riboflavin",
  "niacin",
  "pantothenicAcid",
  "vitaminB6",
  "biotin",
  "folate",
  "vitaminB12",
  "vitaminC",
  "vitaminD",
  "vitaminE",
  "vitaminK",
  // Minerals
  "calcium",
  "iron",
  "magnesium",
  "potassium",
  "sodium",
  "zinc",
  "selenium",
  "copper",
  "manganese",
  "phosphorus",
  "iodine",
  // Other micronutrients that packaged-food labels can declare. Stored,
  // summed and displayed, but without a dashboard meter or target yet.
  "chloride",
  "fluoride",
  "chromium",
  "molybdenum",
  "choline",
  // Auxiliary values: stored and summed, but only used to interpret other
  // nutrients (e.g. the vitamin A upper limit applies to retinol only).
  "sugars",
  "saturatedFat",
  "retinol",
  "folicAcid",
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

export interface NutrientDefinition {
  key: NutrientKey;
  name: string;
  /** Alternative name shown in smaller type, e.g. "Thiamine". */
  alias?: string;
  group: NutrientGroup;
  unit: Unit;
  /** Decimal places used when displaying amounts. */
  decimals: number;
  /** What the body uses it for. */
  functions?: string;
  /** Typical food sources. */
  sources?: string;
  /** Caveats about interpreting intake figures from a food log. */
  considerations?: string;
}

const defs: NutrientDefinition[] = [
  { key: "energy", name: "Energy", group: "macro", unit: "kcal", decimals: 0 },
  {
    key: "protein",
    name: "Protein",
    group: "macro",
    unit: "g",
    decimals: 1,
    functions: "Builds and repairs tissue; supplies essential amino acids for enzymes, hormones and immune function.",
    sources: "Meat, fish, eggs, dairy, legumes, tofu and tempeh, nuts and seeds.",
    considerations: "The EFSA reference intake (0.83 g per kg body weight) is a minimum for healthy adults, not an optimum for athletes or older adults.",
  },
  {
    key: "carbs",
    name: "Carbohydrate",
    group: "macro",
    unit: "g",
    decimals: 1,
    functions: "The body's main energy source, particularly for the brain and during exercise.",
    sources: "Grains, bread, pasta, potatoes, fruit, legumes, milk.",
    considerations: "USDA reports carbohydrate 'by difference', which includes fibre. EFSA's reference range is 45–60% of energy.",
  },
  {
    key: "fat",
    name: "Fat",
    group: "macro",
    unit: "g",
    decimals: 1,
    functions: "Supplies essential fatty acids, carries fat-soluble vitamins (A, D, E, K) and provides energy.",
    sources: "Oils, nuts, seeds, oily fish, avocado, dairy, meat.",
    considerations: "EFSA's reference range is 20–35% of energy. The type of fat matters more than the total.",
  },
  {
    key: "fibre",
    name: "Fibre",
    group: "macro",
    unit: "g",
    decimals: 1,
    functions: "Supports normal bowel function and feeds gut bacteria; higher intakes are associated with lower cardiometabolic risk.",
    sources: "Whole grains, legumes, vegetables, fruit, nuts and seeds.",
    considerations: "EFSA considers 25 g/day adequate for normal bowel function in adults.",
  },
  {
    key: "vitaminA",
    name: "Vitamin A",
    group: "vitamin",
    unit: "µg",
    decimals: 0,
    functions: "Vision (especially in low light), immune function, skin and mucous membranes, cell growth.",
    sources: "Liver, oily fish, eggs and dairy (as retinol); carrots, sweet potato, kale and spinach (as carotenoids).",
    considerations:
      "Values are in µg retinol activity equivalents (RAE), as reported by USDA. EFSA sets its reference in retinol equivalents (RE), which count carotenoids about twice as generously, so plant-heavy diets may look slightly lower here. The upper limit applies only to preformed vitamin A (retinol), not carotenoids from plants.",
  },
  {
    key: "thiamin",
    name: "Vitamin B1",
    alias: "Thiamine",
    group: "vitamin",
    unit: "mg",
    decimals: 2,
    functions: "Releases energy from carbohydrate; supports nerve and heart function.",
    sources: "Pork, whole grains, legumes, sunflower seeds, fortified cereals.",
    considerations: "EFSA sets the requirement relative to energy intake (0.1 mg per MJ), so your target scales with your calorie target.",
  },
  {
    key: "riboflavin",
    name: "Vitamin B2",
    alias: "Riboflavin",
    group: "vitamin",
    unit: "mg",
    decimals: 2,
    functions: "Energy metabolism; maintenance of skin, eyes and red blood cells.",
    sources: "Milk and dairy, eggs, liver, almonds, mushrooms.",
  },
  {
    key: "niacin",
    name: "Vitamin B3",
    alias: "Niacin",
    group: "vitamin",
    unit: "mg",
    decimals: 1,
    functions: "Energy metabolism; nervous system function; skin health.",
    sources: "Poultry, meat, fish (especially tuna), peanuts, whole grains.",
    considerations:
      "EFSA's reference is in niacin equivalents (NE), which also count niacin the body makes from the amino acid tryptophan. The food data here covers preformed niacin only, so your true NE intake is higher than shown. The upper limits concern supplemental nicotinic acid and nicotinamide, not niacin from food, so no limit is evaluated.",
  },
  {
    key: "pantothenicAcid",
    name: "Vitamin B5",
    alias: "Pantothenic acid",
    group: "vitamin",
    unit: "mg",
    decimals: 1,
    functions: "Part of coenzyme A; needed for energy metabolism and making hormones and cholesterol.",
    sources: "Widely distributed: liver, mushrooms, avocado, eggs, whole grains, chicken.",
  },
  {
    key: "vitaminB6",
    name: "Vitamin B6",
    group: "vitamin",
    unit: "mg",
    decimals: 2,
    functions: "Protein and amino acid metabolism; red blood cell formation; nervous system function.",
    sources: "Poultry, fish, potatoes, bananas, chickpeas, pistachios.",
    considerations: "Intakes above the upper limit almost always come from supplements rather than food.",
  },
  {
    key: "biotin",
    name: "Vitamin B7",
    alias: "Biotin",
    group: "vitamin",
    unit: "µg",
    decimals: 1,
    functions: "Metabolism of fats, carbohydrates and amino acids.",
    sources: "Egg yolk, liver, nuts, seeds, legumes.",
    considerations:
      "Biotin is rarely measured in food composition databases. USDA SR Legacy contains no biotin values, so intake cannot be estimated from the current food data.",
  },
  {
    key: "folate",
    name: "Vitamin B9",
    alias: "Folate",
    group: "vitamin",
    unit: "µg",
    decimals: 0,
    functions: "DNA synthesis and cell division; red blood cell formation; especially important before and during early pregnancy.",
    sources: "Leafy greens, legumes, liver, asparagus, fortified grain products.",
    considerations:
      "Values are dietary folate equivalents (DFE). The upper limit applies only to synthetic folic acid (fortified foods and supplements), not folate naturally present in food.",
  },
  {
    key: "vitaminB12",
    name: "Vitamin B12",
    group: "vitamin",
    unit: "µg",
    decimals: 2,
    functions: "Red blood cell formation; nervous system function; DNA synthesis.",
    sources: "Animal foods only: fish, shellfish, meat, liver, dairy, eggs. Also fortified foods.",
    considerations: "Unfortified plant foods contain essentially no B12; people eating fully plant-based diets need fortified foods or a supplement.",
  },
  {
    key: "vitaminC",
    name: "Vitamin C",
    group: "vitamin",
    unit: "mg",
    decimals: 0,
    functions: "Collagen formation, antioxidant protection, immune function; improves absorption of iron from plant foods.",
    sources: "Peppers, citrus fruit, kiwifruit, strawberries, broccoli, kale.",
    considerations: "Sensitive to heat and storage; cooked and stored foods may contain less than database values suggest.",
  },
  {
    key: "vitaminD",
    name: "Vitamin D",
    group: "vitamin",
    unit: "µg",
    decimals: 1,
    functions: "Calcium absorption, bone and muscle health, immune function.",
    sources: "Oily fish, egg yolk, fortified milk and spreads, UV-exposed mushrooms.",
    considerations:
      "Most vitamin D is normally made in the skin from sunlight, and few foods contain much. EFSA's adequate intake assumes minimal sun exposure. A food log alone says little about your vitamin D status.",
  },
  {
    key: "vitaminE",
    name: "Vitamin E",
    group: "vitamin",
    unit: "mg",
    decimals: 1,
    functions: "Antioxidant that protects cell membranes from oxidative damage.",
    sources: "Sunflower seeds and oil, almonds, hazelnuts, wheat germ, olive oil.",
    considerations: "Values are alpha-tocopherol, the form EFSA's adequate intake is based on.",
  },
  {
    key: "vitaminK",
    name: "Vitamin K",
    group: "vitamin",
    unit: "µg",
    decimals: 0,
    functions: "Blood clotting; bone metabolism.",
    sources: "Kale, spinach, broccoli and other green vegetables; some vegetable oils.",
    considerations:
      "Values are phylloquinone (vitamin K1). People taking vitamin K antagonist anticoagulants such as warfarin should keep intake consistent and follow medical advice.",
  },
  {
    key: "calcium",
    name: "Calcium",
    group: "mineral",
    unit: "mg",
    decimals: 0,
    functions: "Bones and teeth; muscle contraction; nerve signalling; blood clotting.",
    sources: "Dairy, calcium-set tofu, sardines with bones, kale, fortified plant drinks.",
    considerations: "Absorption varies by food: it is high from dairy and kale, low from spinach because of oxalate.",
  },
  {
    key: "iron",
    name: "Iron",
    group: "mineral",
    unit: "mg",
    decimals: 1,
    functions: "Carries oxygen in haemoglobin and myoglobin; energy metabolism; immune function.",
    sources: "Liver, red meat, shellfish (haem iron); lentils, beans, spinach, pumpkin seeds (non-haem iron).",
    considerations:
      "Non-haem iron from plants is absorbed less efficiently; vitamin C eaten at the same meal improves it. Requirements are higher for people who menstruate. Low intake in a food log is not a diagnosis — iron status is assessed by blood tests.",
  },
  {
    key: "magnesium",
    name: "Magnesium",
    group: "mineral",
    unit: "mg",
    decimals: 0,
    functions: "Muscle and nerve function, energy metabolism, bone structure; cofactor for hundreds of enzymes.",
    sources: "Pumpkin seeds, almonds, cashews, whole grains, legumes, leafy greens, dark chocolate.",
    considerations:
      "The EFSA upper limit of 250 mg/day applies only to magnesium from supplements and readily dissociable salts — not magnesium naturally present in food — so no limit is evaluated against your food log.",
  },
  {
    key: "potassium",
    name: "Potassium",
    group: "mineral",
    unit: "mg",
    decimals: 0,
    functions: "Fluid balance, nerve signalling, muscle contraction; helps maintain normal blood pressure.",
    sources: "Potatoes, beans and lentils, bananas, leafy greens, avocado, dairy, fish.",
    considerations: "People with kidney disease or taking certain blood-pressure medicines may need to limit potassium and should follow medical advice.",
  },
  {
    key: "sodium",
    name: "Sodium",
    group: "mineral",
    unit: "mg",
    decimals: 0,
    functions: "Fluid balance, nerve signalling, muscle function.",
    sources: "Salt, bread, cheese, cured meats, sauces and most processed foods.",
    considerations:
      "Unlike most nutrients here, more is not better: EFSA considers 2 g/day (about 5 g salt) 'safe and adequate', and most people exceed it. Salt added at the table or in cooking is only counted if you log it.",
  },
  {
    key: "zinc",
    name: "Zinc",
    group: "mineral",
    unit: "mg",
    decimals: 1,
    functions: "Immune function, wound healing, DNA and protein synthesis, taste and smell.",
    sources: "Oysters, beef, pumpkin seeds, cashews, chickpeas, cheese.",
    considerations:
      "EFSA's reference depends on phytate intake, which reduces zinc absorption (phytate is high in whole grains and legumes). The target here assumes a mid-range phytate intake of 600 mg/day.",
  },
  {
    key: "selenium",
    name: "Selenium",
    group: "mineral",
    unit: "µg",
    decimals: 0,
    functions: "Part of antioxidant enzymes; thyroid hormone metabolism; immune function.",
    sources: "Brazil nuts, fish and shellfish, meat, eggs.",
    considerations:
      "Selenium content of plant foods varies widely with the soil they grew in. USDA values reflect US soils, which are typically richer in selenium than European soils. A few Brazil nuts can exceed the upper limit.",
  },
  {
    key: "copper",
    name: "Copper",
    group: "mineral",
    unit: "mg",
    decimals: 2,
    functions: "Iron metabolism, connective tissue formation, energy production, antioxidant defence.",
    sources: "Liver, shellfish, cashews, sesame and sunflower seeds, dark chocolate.",
  },
  {
    key: "manganese",
    name: "Manganese",
    group: "mineral",
    unit: "mg",
    decimals: 2,
    functions: "Bone formation; metabolism of amino acids, cholesterol and carbohydrate.",
    sources: "Whole grains, nuts, legumes, tea, leafy greens.",
    considerations: "EFSA has not set a formal upper limit but gives 8 mg/day as a safe level of intake for adults.",
  },
  {
    key: "phosphorus",
    name: "Phosphorus",
    group: "mineral",
    unit: "mg",
    decimals: 0,
    functions: "Bones and teeth; energy storage (ATP); part of cell membranes and DNA.",
    sources: "Dairy, meat, fish, nuts, seeds, legumes, whole grains.",
    considerations: "Most mixed diets comfortably exceed the adequate intake.",
  },
  {
    key: "iodine",
    name: "Iodine",
    group: "mineral",
    unit: "µg",
    decimals: 0,
    functions: "Needed to make thyroid hormones, which regulate metabolism, growth and development.",
    sources: "Sea fish, shellfish, seaweed, dairy, eggs, iodised salt.",
    considerations:
      "USDA SR Legacy contains no iodine values, so intake cannot be estimated from the current food data. Iodine content also varies greatly with soil, animal feed and use of iodised salt.",
  },
  { key: "chloride", name: "Chloride", group: "other", unit: "mg", decimals: 0 },
  { key: "fluoride", name: "Fluoride", group: "other", unit: "mg", decimals: 2 },
  { key: "chromium", name: "Chromium", group: "other", unit: "µg", decimals: 0 },
  { key: "molybdenum", name: "Molybdenum", group: "other", unit: "µg", decimals: 0 },
  { key: "choline", name: "Choline", group: "other", unit: "mg", decimals: 0 },
  { key: "sugars", name: "Total sugars", group: "auxiliary", unit: "g", decimals: 1 },
  { key: "saturatedFat", name: "Saturated fat", group: "auxiliary", unit: "g", decimals: 1 },
  { key: "retinol", name: "Retinol (preformed vitamin A)", group: "auxiliary", unit: "µg", decimals: 0 },
  { key: "folicAcid", name: "Folic acid (synthetic)", group: "auxiliary", unit: "µg", decimals: 0 },
];

export const NUTRIENTS: Readonly<Record<NutrientKey, NutrientDefinition>> = Object.fromEntries(
  defs.map((d) => [d.key, d]),
) as Record<NutrientKey, NutrientDefinition>;

export const MACRO_KEYS = ["energy", "protein", "carbs", "fat", "fibre"] as const satisfies readonly NutrientKey[];
export const VITAMIN_KEYS = defs.filter((d) => d.group === "vitamin").map((d) => d.key);
export const MINERAL_KEYS = defs.filter((d) => d.group === "mineral").map((d) => d.key);
export const MICRO_KEYS: NutrientKey[] = [...VITAMIN_KEYS, ...MINERAL_KEYS];
export const OTHER_KEYS = defs.filter((d) => d.group === "other").map((d) => d.key);
/** Nutrients that count towards a food's data-completeness score. */
export const CORE_KEYS: NutrientKey[] = [...MACRO_KEYS, ...MICRO_KEYS];

export function isNutrientKey(value: string): value is NutrientKey {
  return (NUTRIENT_KEYS as readonly string[]).includes(value);
}

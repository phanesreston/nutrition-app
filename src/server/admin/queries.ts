import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { NUTRIENT_KEYS } from "@/domain/nutrients/catalog";
import {
  TEXT_FIELDS,
  effectiveValue,
  fieldStatus,
  nutrientField,
  sourceOrigin,
  sourceValue,
  uploadedImageUrl,
  type FieldStatus,
  type OverrideField,
} from "@/food-sources/merge";
import { loadOverrides, loadSource } from "@/food-sources/store";
import { fieldLabel } from "./food-admin";

export const ADMIN_PAGE_SIZE = 40;

export type AdminFlag = "missing-nutrition" | "missing-image" | "edited";
export type AdminSort = "name" | "imported" | "edited";

export interface AdminListQuery {
  q?: string;
  source?: string;
  flag?: AdminFlag;
  sort?: AdminSort;
  page?: number;
}

const BASIC_NUTRIENTS = ["energy", "protein", "carbs", "fat"];

/** Reference foods (USDA) never have photographs, so "missing photo" only concerns the others. */
const missingImage: Prisma.FoodWhereInput = { imageUrl: null, sourceId: { not: "usda-sr-legacy" } };

/** A food lacking any of energy, protein, carbohydrate or fat. */
const missingNutrition: Prisma.FoodWhereInput = {
  NOT: { AND: BASIC_NUTRIENTS.map((nutrientKey) => ({ nutrients: { some: { nutrientKey } } })) },
};

function listWhere({ q, source, flag }: AdminListQuery): Prisma.FoodWhereInput {
  const terms = (q ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 6);
  return {
    AND: [
      ...terms.map((t) => ({
        OR: [
          { name: { contains: t, mode: "insensitive" as const } },
          { brand: { contains: t, mode: "insensitive" as const } },
          { barcode: { contains: t.replace(/[\s-]/g, "") } },
        ],
      })),
      ...(source ? [{ sourceId: source }] : []),
      ...(flag === "missing-nutrition" ? [missingNutrition] : []),
      ...(flag === "missing-image" ? [missingImage] : []),
      ...(flag === "edited" ? [{ editedAt: { not: null } }] : []),
    ],
  };
}

export interface AdminFoodRow {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  imageUrl: string | null;
  sourceId: string;
  sourceName: string;
  nutrientCount: number;
  missingBasics: boolean;
  corrections: number;
  createdAt: string;
  fetchedAt: string | null;
  editedAt: string | null;
}

export async function listAdminFoods(query: AdminListQuery) {
  const where = listWhere(query);
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const orderBy: Prisma.FoodOrderByWithRelationInput[] =
    query.sort === "imported"
      ? [{ createdAt: "desc" }, { name: "asc" }]
      : query.sort === "edited"
        ? [{ editedAt: { sort: "desc", nulls: "last" } }, { name: "asc" }]
        : [{ name: "asc" }];

  const [rows, total, sources, counts] = await Promise.all([
    db.food.findMany({
      where,
      orderBy,
      skip: (page - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
      include: { source: true, nutrients: { select: { nutrientKey: true } }, _count: { select: { overrides: true } } },
    }),
    db.food.count({ where }),
    db.foodSource.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { foods: true } } } }),
    Promise.all([
      db.food.count(),
      db.food.count({ where: missingNutrition }),
      db.food.count({ where: missingImage }),
      db.food.count({ where: { editedAt: { not: null } } }),
    ]),
  ]);

  const foods: AdminFoodRow[] = rows.map((r) => {
    const keys = new Set(r.nutrients.map((n) => n.nutrientKey));
    return {
      id: r.id,
      name: r.name,
      brand: r.brand,
      barcode: r.barcode,
      imageUrl: r.imageUrl,
      sourceId: r.sourceId,
      sourceName: r.source.name,
      nutrientCount: keys.size,
      missingBasics: BASIC_NUTRIENTS.some((k) => !keys.has(k)),
      corrections: r._count.overrides,
      createdAt: r.createdAt.toISOString(),
      fetchedAt: r.fetchedAt?.toISOString() ?? null,
      editedAt: r.editedAt?.toISOString() ?? null,
    };
  });

  return {
    foods,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)),
    sources: sources.map((s) => ({ id: s.id, name: s.name, foods: s._count.foods })),
    counts: { all: counts[0], missingNutrition: counts[1], missingPackagedImage: counts[2], edited: counts[3] },
  };
}

export interface EditorField {
  /** Effective value as a string; null = none / unknown. */
  value: string | null;
  /** The imported value; null = the source has none. */
  original: string | null;
  status: FieldStatus;
}

export interface EditorData {
  food: {
    id: string;
    name: string;
    sourceId: string;
    sourceName: string;
    sourceFoodId: string;
    /** How imported values are labelled, e.g. "label" for pack declarations. */
    sourceOrigin: string;
    isCustom: boolean;
    fetchedAt: string | null;
    createdAt: string;
    editedAt: string | null;
    diaryEntries: number;
  };
  fields: Record<string, EditorField>;
  image: {
    /** "none", "source" or "upload:<id>". */
    current: string;
    currentUrl: string | null;
    status: FieldStatus;
    sourceUrl: string | null;
    uploads: { id: string; url: string; width: number; height: number; createdAt: string }[];
  };
  history: {
    id: string;
    field: string;
    label: string;
    oldValue: string | null;
    newValue: string | null;
    action: string;
    admin: string;
    createdAt: string;
    revertible: boolean;
  }[];
}

/** Audit values as shown to people: image choices are stored as codes. */
function describeValue(field: string, value: string | null): string | null {
  if (field !== "image") return value;
  if (value === null || value === "none") return "No photograph";
  if (value === "source") return "Original image";
  return "Uploaded photo";
}

export async function getEditorData(foodId: string): Promise<EditorData | null> {
  const row = await db.food.findUnique({
    where: { id: foodId },
    include: { source: true, images: { orderBy: { createdAt: "desc" } }, _count: { select: { entries: true } } },
  });
  if (!row) return null;
  const [source, overrides, audits] = await Promise.all([
    loadSource(db, foodId),
    loadOverrides(db, foodId),
    db.foodAudit.findMany({ where: { foodId }, orderBy: { createdAt: "desc" }, take: 60 }),
  ]);
  const admins = await db.user.findMany({ where: { id: { in: [...new Set(audits.map((a) => a.adminId))] } } });
  const adminName = new Map(admins.map((u) => [u.id, u.name ?? u.email]));

  const keys: OverrideField[] = [
    ...TEXT_FIELDS,
    "amountUnit",
    "servingSize",
    "packageQuantity",
    ...NUTRIENT_KEYS.map(nutrientField),
  ];
  const fields: EditorData["fields"] = {};
  for (const key of keys) {
    fields[key] = {
      value: effectiveValue(source, overrides, key),
      original: sourceValue(source, key),
      status: fieldStatus(source, overrides, key),
    };
  }

  return {
    food: {
      id: row.id,
      name: row.name,
      sourceId: row.sourceId,
      sourceName: row.source.name,
      sourceFoodId: row.sourceFoodId,
      sourceOrigin: sourceOrigin(row.sourceId),
      isCustom: row.createdByUserId !== null,
      fetchedAt: row.fetchedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
      diaryEntries: row._count.entries,
    },
    fields,
    image: {
      current: effectiveValue(source, overrides, "image") ?? "none",
      currentUrl: row.imageUrl,
      status: fieldStatus(source, overrides, "image"),
      sourceUrl: source.imageUrl ?? null,
      uploads: row.images.map((i) => ({
        id: i.id,
        url: uploadedImageUrl(i.id),
        width: i.width,
        height: i.height,
        createdAt: i.createdAt.toISOString(),
      })),
    },
    history: audits.map((a) => ({
      id: a.id,
      field: a.field,
      label: fieldLabel(a.field),
      oldValue: describeValue(a.field, a.oldValue),
      newValue: describeValue(a.field, a.newValue),
      action: a.action,
      admin: adminName.get(a.adminId) ?? "Unknown administrator",
      createdAt: a.createdAt.toISOString(),
      revertible: a.action !== "recalculate",
    })),
  };
}

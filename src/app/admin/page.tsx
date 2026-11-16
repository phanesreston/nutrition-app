import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ChevronLeft, ChevronRight, ImageOff, PencilLine, Search, TriangleAlert } from "lucide-react";
import { ProductImage } from "@/components/food/product-image";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { adminLogout } from "@/server/admin/actions";
import { requireAdminPage } from "@/server/admin/auth";
import { listAdminFoods, type AdminFlag, type AdminSort } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Admin" };

const FLAGS: AdminFlag[] = ["missing-nutrition", "missing-image", "edited"];
const SORTS: AdminSort[] = ["name", "imported", "edited"];
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const shortDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso)) : "–";

const SOURCE_SHORT: Record<string, string> = {
  "usda-sr-legacy": "USDA",
  "open-food-facts": "Open Food Facts",
  custom: "Custom",
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  await requireAdminPage("/admin");

  const q = first(params.q)?.slice(0, 100) ?? "";
  const source = first(params.source) ?? "";
  const flag = FLAGS.find((f) => f === first(params.flag));
  const sort = SORTS.find((s) => s === first(params.sort)) ?? (flag === "edited" ? "edited" : "name");
  const page = Number(first(params.page)) || 1;
  const result = await listAdminFoods({ q, source: source || undefined, flag, sort, page });

  const href = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { q, source, flag, sort: sort === "name" ? undefined : sort, ...changes };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, String(v));
    const s = next.toString();
    return s ? `/admin?${s}` : "/admin";
  };

  const chips: { label: string; count: number; flag?: AdminFlag }[] = [
    { label: "All foods", count: result.counts.all },
    { label: "Missing nutrition", count: result.counts.missingNutrition, flag: "missing-nutrition" },
    { label: "Missing photo", count: result.counts.missingPackagedImage, flag: "missing-image" },
    { label: "Corrected", count: result.counts.edited, flag: "edited" },
  ];

  return (
    <>
      <PageHeader title="Food database" description="Find a product, open it, and correct its details, nutrition or photograph.">
        <form action={adminLogout}>
          <Button type="submit" variant="outline" size="sm">
            Sign out of admin
          </Button>
        </form>
      </PageHeader>

      <nav aria-label="Quick filters" className="mb-4 flex flex-wrap gap-2">
        {chips.map((chip) => {
          const active = flag === chip.flag;
          return (
            <Link
              key={chip.label}
              href={href({ flag: chip.flag, page: undefined, sort: undefined })}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex items-baseline gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors",
                active ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted",
              )}
            >
              {chip.label}
              <span className={cn("text-xs tabular-nums", active ? "opacity-80" : "text-muted-foreground")}>{formatNumber(chip.count)}</span>
            </Link>
          );
        })}
      </nav>

      <Form action="/admin" role="search" className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        {flag ? <input type="hidden" name="flag" value={flag} /> : null}
        <div className="relative">
          <Search aria-hidden className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" type="search" defaultValue={q} placeholder="Name, brand or barcode" aria-label="Search foods" className="pl-9" />
        </div>
        <NativeSelect name="source" defaultValue={source} aria-label="Data source">
          <option value="">All sources</option>
          {result.sources.map((s) => (
            <option key={s.id} value={s.id}>
              {SOURCE_SHORT[s.id] ?? s.name} ({formatNumber(s.foods)})
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="sort" defaultValue={sort} aria-label="Sort by">
          <option value="name">Name A–Z</option>
          <option value="imported">Recently imported</option>
          <option value="edited">Recently edited</option>
        </NativeSelect>
        <Button type="submit">Apply</Button>
      </Form>

      <p className="mb-3 text-sm text-muted-foreground" aria-live="polite">
        {formatNumber(result.total)} {result.total === 1 ? "food" : "foods"}
        {flag === "missing-image" ? " packaged or custom, without a photograph" : flag === "missing-nutrition" ? " lacking energy, protein, carbohydrate or fat" : flag === "edited" ? " with corrections" : ""}
        {q ? ` matching “${q}”` : ""}
      </p>

      {result.foods.length === 0 ? (
        <Card className="border-dashed bg-transparent p-8 text-center shadow-none">
          <p className="font-medium">No foods match</p>
          <p className="mt-1 text-sm text-muted-foreground">Try a different search, or clear the filters.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="hidden border-b text-left text-xs text-muted-foreground md:table-header-group">
              <tr>
                <th scope="col" className="py-2.5 pl-5 font-medium">Product</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Barcode</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Source</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Nutrients</th>
                <th scope="col" className="px-3 py-2.5 font-medium whitespace-nowrap">Imported</th>
                <th scope="col" className="py-2.5 pr-5 pl-3 font-medium whitespace-nowrap">Edited</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {result.foods.map((food) => (
                <tr key={food.id} className="relative block hover:bg-muted/40 md:table-row">
                  <td className="block py-3 pr-4 pl-5 md:table-cell md:py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-white">
                        {food.imageUrl ? (
                          <ProductImage src={food.imageUrl} className="size-full object-contain" />
                        ) : (
                          <ImageOff className="size-4 text-neutral-400" aria-label="No photograph" />
                        )}
                      </span>
                      <span className="min-w-0">
                        {/* The link's ::after covers the whole row, so the row is one big tap target. */}
                        <Link href={`/admin/foods/${food.id}`} className="block truncate font-medium after:absolute after:inset-0">
                          {food.name}
                        </Link>
                        <span className="block truncate text-xs text-muted-foreground">
                          {food.brand ?? "No brand"}
                          <span className="md:hidden">
                            {" · "}
                            {SOURCE_SHORT[food.sourceId] ?? food.sourceName}
                            {food.barcode ? ` · ${food.barcode}` : ""}
                          </span>
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1.5 md:hidden">
                          {food.missingBasics ? <Badge className="text-warning-text">Missing nutrition</Badge> : null}
                          {food.corrections ? <Badge>{food.corrections} corrected</Badge> : null}
                        </span>
                      </span>
                    </div>
                  </td>
                  <td className="hidden px-3 font-mono text-xs text-muted-foreground md:table-cell">{food.barcode ?? "–"}</td>
                  <td className="hidden px-3 md:table-cell">
                    <Badge>{SOURCE_SHORT[food.sourceId] ?? food.sourceName}</Badge>
                  </td>
                  <td className="hidden px-3 tabular-nums md:table-cell">
                    <span className="inline-flex items-center gap-1.5">
                      {food.missingBasics ? <TriangleAlert className="size-3.5 text-warning-text" aria-label="Missing basic nutrition" /> : null}
                      {food.nutrientCount}
                      {food.corrections ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <PencilLine className="size-3" aria-hidden />
                          {food.corrections}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="hidden px-3 text-xs whitespace-nowrap text-muted-foreground md:table-cell">{shortDate(food.fetchedAt ?? food.createdAt)}</td>
                  <td className="hidden pr-5 pl-3 text-xs whitespace-nowrap text-muted-foreground md:table-cell">{shortDate(food.editedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {result.pages > 1 ? (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-between text-sm">
          <Button asChild variant="outline" size="sm" className={result.page <= 1 ? "pointer-events-none opacity-40" : ""}>
            <Link href={href({ page: String(result.page - 1) })} aria-disabled={result.page <= 1}>
              <ChevronLeft /> Previous
            </Link>
          </Button>
          <span className="text-muted-foreground tabular-nums">
            Page {result.page} of {result.pages}
          </span>
          <Button asChild variant="outline" size="sm" className={result.page >= result.pages ? "pointer-events-none opacity-40" : ""}>
            <Link href={href({ page: String(result.page + 1) })} aria-disabled={result.page >= result.pages}>
              Next <ChevronRight />
            </Link>
          </Button>
        </nav>
      ) : null}
    </>
  );
}

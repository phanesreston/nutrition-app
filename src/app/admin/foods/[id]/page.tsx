import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FoodEditor } from "@/components/admin/food-editor";
import { requireAdminPage } from "@/server/admin/auth";
import { getEditorData } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Edit food" };

export default async function AdminFoodPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireAdminPage(`/admin/foods/${id}`);
  const data = await getEditorData(id);
  if (!data) notFound();

  return (
    <>
      <Link href="/admin" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Food database
      </Link>
      {/* Remount with fresh data after every save, revert or upload. */}
      <FoodEditor key={`${data.food.editedAt}-${data.history.length}-${data.image.uploads.length}`} data={data} />
    </>
  );
}

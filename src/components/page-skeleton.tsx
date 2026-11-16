import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder shown while a page's data streams in. */
export function PageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-8 h-9 w-48" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl lg:col-span-2" />
        <Skeleton className="h-96 rounded-xl lg:col-span-3" />
      </div>
    </div>
  );
}

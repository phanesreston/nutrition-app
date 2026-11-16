"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS, isActive } from "./nav-items";

/**
 * Each nav has a `*View` that takes the pathname as a prop and a wrapper that
 * reads it with `usePathname()`. The shell renders the wrapper inside
 * <Suspense> with the view (no active item) as fallback, because the pathname
 * of a dynamic route is not known while the static shell is prerendered.
 */

export function SidebarNavView({ pathname }: { pathname: string | null }) {
  return (
    <nav aria-label="Primary" className="mt-8 flex flex-1 flex-col gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = pathname !== null && isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
              active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function SidebarNav() {
  return <SidebarNavView pathname={usePathname()} />;
}

export function TopLinksView({ pathname }: { pathname: string | null }) {
  return (
    <>
      {NAV_ITEMS.filter((i) => !i.mobile).map((item) => {
        const active = pathname !== null && isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex size-8 items-center justify-center rounded-md",
              active ? "bg-muted text-foreground" : "text-muted-foreground",
            )}
          >
            <item.icon className="size-4" aria-hidden />
          </Link>
        );
      })}
    </>
  );
}

export function TopLinks() {
  return <TopLinksView pathname={usePathname()} />;
}

export function TabBarView({ pathname }: { pathname: string | null }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {NAV_ITEMS.filter((i) => i.mobile).map((item) => {
        const active = pathname !== null && isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-14 flex-col items-center justify-center gap-1 text-[11px]",
              active ? "font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            <item.icon className="size-5" aria-hidden />
            {"short" in item ? item.short : item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TabBar() {
  return <TabBarView pathname={usePathname()} />;
}

import { Suspense } from "react";
import Link from "next/link";
import { Leaf } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav, SidebarNavView, TabBar, TabBarView, TopLinks, TopLinksView } from "./nav";

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-md">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Leaf className="size-4" aria-hidden />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">Nourish</span>
    </Link>
  );
}

/** Sidebar on desktop; top bar plus bottom tab bar on phones. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-card/60 px-3 py-5 lg:flex">
        <div className="px-2">
          <Brand />
        </div>
        <Suspense fallback={<SidebarNavView pathname={null} />}>
          <SidebarNav />
        </Suspense>
        <div className="flex items-center justify-between px-2 text-xs text-muted-foreground">
          <span>Local prototype</span>
          <ThemeToggle />
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur lg:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <Suspense fallback={<TopLinksView pathname={null} />}>
            <TopLinks />
          </Suspense>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:pt-10 lg:pb-16">{children}</main>

      <Suspense fallback={<TabBarView pathname={null} />}>
        <TabBar />
      </Suspense>
    </div>
  );
}

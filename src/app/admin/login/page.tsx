import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/login-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { getAdmin } from "@/server/admin/auth";
import { MIN_PASSWORD_LENGTH, adminConfig } from "@/server/admin/session";

export const metadata: Metadata = { title: "Admin sign-in" };

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const raw = (await searchParams).next;
  const next = (Array.isArray(raw) ? raw[0] : raw) ?? "/admin";
  if (await getAdmin()) redirect("/admin");
  const config = adminConfig();

  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Admin sign-in" description="Correcting food data is restricted to administrators." />
      <Card>
        <CardContent>
          {config.enabled ? (
            <LoginForm next={next} />
          ) : (
            <div className="flex flex-col gap-3 text-sm">
              <p className="font-medium">Admin access is switched off on this server.</p>
              <p className="text-muted-foreground">
                {config.reason === "too-short"
                  ? `ADMIN_PASSWORD is set but shorter than ${MIN_PASSWORD_LENGTH} characters.`
                  : "No administrator password has been set."}{" "}
                To enable the admin area, add a line like this to the <code className="font-mono text-xs">.env</code>{" "}
                file on the server, using a long password of your own, then restart the app:
              </p>
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs">ADMIN_PASSWORD=&quot;choose-a-long-passphrase&quot;</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

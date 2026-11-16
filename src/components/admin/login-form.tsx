"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adminLogin } from "@/server/admin/actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(adminLogin, null);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="admin-password">Administrator password</Label>
        <Input id="admin-password" name="password" type="password" autoComplete="current-password" required autoFocus />
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-critical-text">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

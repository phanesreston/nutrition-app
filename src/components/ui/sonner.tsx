"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={(resolvedTheme as ToasterProps["theme"]) ?? "system"}
      position="top-center"
      toastOptions={{ style: { background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)" } }}
      {...props}
    />
  );
}

export { Toaster };

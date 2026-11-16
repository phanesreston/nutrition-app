import * as React from "react";
import { cn } from "@/lib/utils";

function Card({ className, asSection, ...props }: React.ComponentProps<"div"> & { asSection?: boolean }) {
  const Comp = asSection ? "section" : "div";
  return (
    <Comp
      data-slot="card"
      className={cn("rounded-xl border bg-card text-card-foreground shadow-[0_1px_2px_rgb(0_0_0/0.03)]", className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-header" className={cn("flex flex-col gap-1 p-5 pb-0 sm:p-6 sm:pb-0", className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 data-slot="card-title" className={cn("text-[15px] font-semibold tracking-tight", className)} {...props} />;
}

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="card-content" className={cn("p-5 sm:p-6", className)} {...props} />;
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent };

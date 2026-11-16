import { Card, CardContent } from "@/components/ui/card";

/** Honest placeholder for a section that is planned but not built yet. */
export function ComingSoon({ phase, items }: { phase: string; items: { title: string; text: string }[] }) {
  return (
    <Card className="border-dashed bg-transparent shadow-none">
      <CardContent>
        <p className="text-sm font-medium">Planned for {phase}</p>
        <p className="mt-1 max-w-prose text-sm text-muted-foreground">
          This section is not built yet. The daily logging workflow comes first; these views build on the diary data
          you are already saving.
        </p>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.title} className="rounded-lg bg-muted/60 p-4">
              <div className="text-sm font-medium">{item.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{item.text}</p>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

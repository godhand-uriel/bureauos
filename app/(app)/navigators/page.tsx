import type { Metadata } from "next";
import { NavigatorCard } from "@/components/navigator-card";
import { NAVIGATORS } from "@/lib/navigators";

export const metadata: Metadata = { title: "Navigators" };

export default function NavigatorsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Navigators</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          Each navigator is a focused module for one bureaucratic system: guided intake, a
          rule-based action plan, checklists, deadlines, and letters.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {NAVIGATORS.map((nav) => (
          <NavigatorCard key={nav.slug} nav={nav} />
        ))}
      </div>
    </div>
  );
}

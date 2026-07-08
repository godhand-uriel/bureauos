import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { NavigatorIcon } from "@/components/navigator-icon";
import type { NavigatorDef } from "@/lib/types";

export function NavigatorCard({ nav }: { nav: NavigatorDef }) {
  return (
    <Link href={`/navigators/${nav.slug}`} className="group block h-full">
      <Card className="h-full transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/40 group-hover:shadow-lg">
        <CardContent className="flex h-full flex-col gap-3 p-5">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: `hsl(${nav.accent} / 0.15)`, color: `hsl(${nav.accent})` }}
          >
            <NavigatorIcon icon={nav.icon} className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">{nav.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{nav.tagline}</p>
          </div>
          <div className="mt-auto flex items-center gap-1 pt-2 text-sm font-medium text-primary">
            Open navigator
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface NextActionPanelProps {
  title: string;
  detail: string;
  href: string;
  ctaLabel?: string;
}

export function NextActionPanel({ title, detail, href, ctaLabel = "Take action" }: NextActionPanelProps) {
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Zap className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Recommended next action</p>
          <h3 className="mt-1 font-semibold leading-snug">{title}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
        </div>
        <Link href={href} className="shrink-0">
          <Button>
            {ctaLabel}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

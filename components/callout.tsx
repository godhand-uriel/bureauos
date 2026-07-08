import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalloutProps {
  variant?: "info" | "warning" | "critical";
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const VARIANTS = {
  info: {
    icon: Info,
    classes: "border-sky-500/30 bg-sky-500/10 text-sky-200 [&>svg]:text-sky-400",
  },
  warning: {
    icon: AlertTriangle,
    classes: "border-amber-500/30 bg-amber-500/10 text-amber-200 [&>svg]:text-amber-400",
  },
  critical: {
    icon: ShieldAlert,
    classes: "border-red-500/30 bg-red-500/10 text-red-200 [&>svg]:text-red-400",
  },
};

export function Callout({ variant = "info", title, children, className }: CalloutProps) {
  const cfg = VARIANTS[variant];
  const Icon = cfg.icon;
  return (
    <div className={cn("flex gap-3 rounded-lg border p-4 text-sm", cfg.classes, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cn(title && "mt-0.5", "leading-relaxed opacity-90")}>{children}</div>
      </div>
    </div>
  );
}

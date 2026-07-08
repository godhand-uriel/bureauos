import {
  Briefcase,
  Car,
  Home,
  Landmark,
  Medal,
  Shield,
  Store,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  car: Car,
  briefcase: Briefcase,
  store: Store,
  shield: Shield,
  medal: Medal,
  home: Home,
};

export function NavigatorIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICONS[icon] ?? Landmark;
  return <Icon className={className} aria-hidden />;
}

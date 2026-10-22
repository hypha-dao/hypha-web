import {
  ArrowUpRight,
  BookOpen,
  Flame,
  Layers,
  Lightbulb,
  Megaphone,
  Receipt,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';

const SIGNAL_TYPE_ICONS: Record<string, LucideIcon> = {
  Need: Megaphone,
  Resource: Layers,
  Opportunity: ArrowUpRight,
  Insight: Lightbulb,
  Tension: Flame,
  Risk: TriangleAlert,
  Action: Receipt,
  Impact: BookOpen,
};

/** Lucide icon for a signal type, shared by filters, chips, and cards. */
export function signalTypeIcon(type: string): LucideIcon | undefined {
  return SIGNAL_TYPE_ICONS[type];
}

export function SignalTypeIcon({
  type,
  className,
}: {
  type: string;
  className?: string;
}) {
  const Icon = SIGNAL_TYPE_ICONS[type];
  if (!Icon) return null;
  return <Icon className={className} aria-hidden />;
}

/** Same bordered type chip on exchange, field, and needs cards. */
export function SignalTypeBadge({
  type,
  label,
}: {
  type: string;
  label: string;
}) {
  return (
    <span className="inline-flex h-8 shrink-0 items-center gap-1.5 border border-border bg-background px-2 text-2 text-foreground">
      <SignalTypeIcon type={type} className="size-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

/** Space name under the title. Same line on every signal card. */
export function SignalSpaceName({ name }: { name: string }) {
  const title = name.trim();
  if (!title) return null;
  return (
    <p className="truncate text-1 uppercase tracking-[0.14em] text-neutral-11">
      {title}
    </p>
  );
}

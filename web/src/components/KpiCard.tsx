import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

type Tone = "neutral" | "ok" | "warn" | "danger" | "accent";

const ACCENTS: Record<Tone, string> = {
  neutral: "from-foreground/10 to-transparent text-foreground",
  ok: "from-ok/25 to-transparent text-ok",
  warn: "from-warn/25 to-transparent text-warn",
  danger: "from-danger/25 to-transparent text-danger",
  accent: "from-accent/25 to-transparent text-accent",
};

export function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  icon,
  loading = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: Tone;
  icon?: React.ReactNode;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-[0.18]", ACCENTS[tone])} />
      <div className="relative z-10 p-5 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
            {label}
          </span>
          {icon ? <span className={cn("opacity-80", ACCENTS[tone].split(" ").pop())}>{icon}</span> : null}
        </div>
        {loading ? (
          <Skeleton className="h-10 w-32" />
        ) : (
          <div className="text-4xl font-semibold tabular-nums leading-none tracking-tight text-foreground">
            {value}
          </div>
        )}
        {hint ? <div className="text-xs text-muted">{hint}</div> : null}
      </div>
    </Card>
  );
}

import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "danger" | "muted" | "accent";

const TONE: Record<Tone, string> = {
  ok: "bg-ok shadow-[0_0_12px_rgba(34,200,120,0.6)]",
  warn: "bg-warn shadow-[0_0_12px_rgba(250,170,40,0.55)]",
  danger: "bg-danger shadow-[0_0_12px_rgba(240,80,80,0.55)]",
  muted: "bg-muted/60",
  accent: "bg-accent shadow-[0_0_12px_rgba(34,194,255,0.55)]",
};

export function StatusDot({
  tone = "ok",
  pulse = false,
  className,
}: {
  tone?: Tone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block h-2.5 w-2.5 rounded-full",
        TONE[tone],
        pulse && "animate-pulseSoft",
        className,
      )}
    />
  );
}

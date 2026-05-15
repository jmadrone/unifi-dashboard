import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(n: number | undefined | null, opts?: Intl.NumberFormatOptions): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat(undefined, opts).format(n);
}

export function formatPercent(n: number | undefined | null, digits = 1): string {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}%`;
}

export function formatMs(ms: number | undefined | null): string {
  if (ms === undefined || ms === null || Number.isNaN(ms)) return "—";
  return `${Math.round(ms)} ms`;
}

export function formatMbps(mbps: number | undefined | null): string {
  if (mbps === undefined || mbps === null || Number.isNaN(mbps)) return "—";
  if (mbps >= 1000) return `${(mbps / 1000).toFixed(2)} Gbps`;
  if (mbps >= 1) return `${mbps.toFixed(1)} Mbps`;
  return `${(mbps * 1000).toFixed(0)} Kbps`;
}

export function relativeTime(iso: string | number | Date | undefined | null): string {
  if (!iso) return "—";
  const date = typeof iso === "string" || typeof iso === "number" ? new Date(iso) : iso;
  const diff = Date.now() - date.getTime();
  const abs = Math.abs(diff);
  const sec = Math.round(abs / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

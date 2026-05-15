import { Link } from "react-router-dom";
import { ArrowUpRight, Wifi, ServerCog, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatusDot } from "@/components/ui/StatusDot";
import { formatNumber } from "@/lib/utils";
import type { UnifiSite } from "@/lib/api";

export function SiteCard({ site }: { site: UnifiSite }) {
  const name = site.meta?.desc?.trim() || site.meta?.name?.trim() || site.siteId || "Unnamed site";
  const counts = site.statistics?.counts ?? {};
  const totalDevices = Number(counts.totalDevice ?? 0);
  const offlineDevices = Number(counts.offlineDevice ?? 0);
  const wifiClients = Number(counts.wifiClient ?? 0);
  const wiredClients = Number(counts.wiredClient ?? 0);

  const isp = site.statistics?.gateways?.[0];
  const ispStatus = (site.statistics?.ispStatus ?? "ok").toLowerCase();
  const hasIspIssue = ispStatus !== "ok" && ispStatus !== "online";
  const hasOfflineDevices = offlineDevices > 0;

  const tone = hasIspIssue
    ? ("danger" as const)
    : hasOfflineDevices
    ? ("warn" as const)
    : ("ok" as const);

  return (
    <Link
      to={`/sites/${encodeURIComponent(site.siteId ?? "")}`}
      className="group block focus:outline-none"
    >
      <Card className="relative overflow-hidden transition-all hover:border-accent/50 hover:shadow-glow">
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <StatusDot tone={tone} pulse={tone !== "ok"} />
                <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
                  {site.meta?.timezone ?? "—"}
                </span>
              </div>
              <h3 className="text-lg font-semibold tracking-tight truncate">{name}</h3>
              {isp?.ispName ? (
                <div className="text-xs text-muted mt-1 truncate">
                  ISP · {isp.ispName}
                  {isp.ispAsn ? ` · AS${isp.ispAsn}` : ""}
                </div>
              ) : null}
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Stat icon={<ServerCog className="h-3.5 w-3.5" />} label="Devices" value={formatNumber(totalDevices)} />
            <Stat icon={<Wifi className="h-3.5 w-3.5" />} label="Clients" value={formatNumber(wifiClients + wiredClients)} />
            <Stat
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              label="Offline"
              value={formatNumber(offlineDevices)}
              tone={offlineDevices > 0 ? "warn" : "muted"}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {hasIspIssue ? (
              <Badge variant="danger">Internet issue</Badge>
            ) : (
              <Badge variant="ok">Internet OK</Badge>
            )}
            {hasOfflineDevices ? (
              <Badge variant="warn">{offlineDevices} device{offlineDevices === 1 ? "" : "s"} offline</Badge>
            ) : null}
            {site.isOwner ? <Badge variant="muted">Owner</Badge> : null}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function Stat({
  icon,
  label,
  value,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "default" | "warn" | "muted";
}) {
  const toneClass =
    tone === "warn" ? "text-warn" : tone === "muted" ? "text-muted" : "text-foreground";
  return (
    <div className="rounded-lg bg-panel-2/60 ring-1 ring-border/60 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
        {icon}
        {label}
      </div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}

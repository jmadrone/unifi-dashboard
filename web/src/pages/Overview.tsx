import { useMemo } from "react";
import {
  Activity,
  AlertOctagon,
  Boxes,
  CircleCheck,
  Download,
  Globe,
  MapPinned,
  Network,
  RefreshCw,
  Users,
  Wifi,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusDot } from "@/components/ui/StatusDot";
import { KpiCard } from "@/components/KpiCard";
import { SiteCard } from "@/components/SiteCard";
import { useDevices, useOverview, useSites } from "@/hooks/useUnifi";
import { formatNumber, formatPercent } from "@/lib/utils";
import { unwrap, type UnifiDevice, type UnifiSite } from "@/lib/api";

export function Overview() {
  const overview = useOverview();
  const sitesQ = useSites();
  const devicesQ = useDevices();

  const o = overview.data;
  const sites = unwrap<UnifiSite[]>(sitesQ.data) ?? [];
  const devicesFlat = useMemo<UnifiDevice[]>(() => {
    const groups = unwrap<any[]>(devicesQ.data) ?? [];
    return groups.flatMap((g) => (Array.isArray(g?.devices) ? g.devices : []));
  }, [devicesQ.data]);

  const offlinePct =
    o && o.devices.total > 0 ? (o.devices.offline / o.devices.total) * 100 : 0;
  const onlinePct =
    o && o.devices.total > 0 ? (o.devices.online / o.devices.total) * 100 : 0;

  const sortedSites = useMemo(() => {
    return [...sites].sort((a, b) => severity(b) - severity(a));
  }, [sites]);

  const recentlyOffline = useMemo(() => {
    return devicesFlat.filter((d) => String(d.status ?? "").toLowerCase() !== "online").slice(0, 6);
  }, [devicesFlat]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Sites"
          value={formatNumber(o?.totals.sites)}
          hint={
            o ? `${o.sites.internetIssues} with internet issues` : undefined
          }
          tone={o && o.sites.internetIssues > 0 ? "warn" : "ok"}
          icon={<MapPinned className="h-4 w-4" />}
          loading={overview.isLoading}
        />
        <KpiCard
          label="Devices online"
          value={
            <span>
              {formatNumber(o?.devices.online)}
              <span className="text-muted text-xl ml-1.5">/ {formatNumber(o?.devices.total)}</span>
            </span>
          }
          hint={o ? `${formatPercent(onlinePct, 1)} availability` : undefined}
          tone={offlinePct > 5 ? "danger" : offlinePct > 0 ? "warn" : "ok"}
          icon={<Boxes className="h-4 w-4" />}
          loading={overview.isLoading}
        />
        <KpiCard
          label="Active clients"
          value={formatNumber(o?.sites.totalClients)}
          hint={
            o
              ? `${formatNumber(o.sites.wifiClients)} Wi-Fi · ${formatNumber(o.sites.wiredClients)} wired`
              : undefined
          }
          tone="accent"
          icon={<Users className="h-4 w-4" />}
          loading={overview.isLoading}
        />
        <KpiCard
          label="Firmware updates"
          value={formatNumber(o?.devices.updatesAvailable)}
          hint="Devices with updates available"
          tone={o && o.devices.updatesAvailable > 0 ? "warn" : "ok"}
          icon={<Download className="h-4 w-4" />}
          loading={overview.isLoading}
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sites</CardTitle>
              <div className="flex items-center gap-2 text-xs text-muted">
                <RefreshCw className="h-3.5 w-3.5" />
                Auto-refresh 30s
              </div>
            </CardHeader>
            <CardContent>
              {sitesQ.isLoading ? (
                <div className="grid grid-fluid gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-44 w-full" />
                  ))}
                </div>
              ) : sortedSites.length === 0 ? (
                <EmptyMessage icon={<MapPinned className="h-5 w-5" />} title="No sites visible" />
              ) : (
                <div className="grid grid-fluid gap-4">
                  {sortedSites.map((s) => (
                    <SiteCard key={s.siteId} site={s} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Device mix</CardTitle>
              <Network className="h-4 w-4 text-muted" />
            </CardHeader>
            <CardContent>
              {overview.isLoading ? (
                <Skeleton className="h-44 w-full" />
              ) : (
                <ul className="space-y-2.5">
                  {Object.entries(o?.devices.byProductLine ?? {})
                    .sort(([, a], [, b]) => b.total - a.total)
                    .map(([key, b]) => {
                      const pct = b.total > 0 ? (b.online / b.total) * 100 : 0;
                      return (
                        <li key={key} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium uppercase tracking-wider text-xs">
                              {key}
                            </span>
                            <span className="text-muted text-xs tabular-nums">
                              {b.online}/{b.total}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-panel-2 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-accent to-purple-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active alerts</CardTitle>
              <AlertOctagon className="h-4 w-4 text-muted" />
            </CardHeader>
            <CardContent className="space-y-2.5">
              {overview.isLoading ? (
                <Skeleton className="h-24 w-full" />
              ) : (o?.sites.internetIssues ?? 0) === 0 && recentlyOffline.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-muted py-2">
                  <CircleCheck className="h-4 w-4 text-ok" />
                  No active alerts.
                </div>
              ) : (
                <>
                  {(o?.sites.internetIssues ?? 0) > 0 ? (
                    <AlertRow
                      tone="danger"
                      icon={<Globe className="h-4 w-4" />}
                      title={`${o!.sites.internetIssues} site${o!.sites.internetIssues === 1 ? "" : "s"} reporting internet issues`}
                      subtitle="Check WAN health and ISP status"
                    />
                  ) : null}
                  {recentlyOffline.map((d, i) => (
                    <AlertRow
                      key={d.id ?? d.mac ?? i}
                      tone="warn"
                      icon={<Activity className="h-4 w-4" />}
                      title={d.name ?? d.mac ?? "Device offline"}
                      subtitle={`${d.model ?? d.shortname ?? "device"} · ${d.ip ?? "no IP"}`}
                    />
                  ))}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick stats</CardTitle>
              <Wifi className="h-4 w-4 text-muted" />
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <Stat label="Hosts online" value={`${o?.hosts.online ?? "—"} / ${o?.hosts.total ?? "—"}`} />
                <Stat
                  label="Guest clients"
                  value={formatNumber(o?.sites.guestClients)}
                />
                <Stat
                  label="Offline devices"
                  value={formatNumber(o?.devices.offline)}
                />
                <Stat
                  label="Updates pending"
                  value={formatNumber(o?.devices.updatesAvailable)}
                />
              </dl>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function severity(s: UnifiSite): number {
  const counts = s.statistics?.counts ?? {};
  const offline = Number(counts.offlineDevice ?? 0);
  const ispBad =
    s.statistics?.ispStatus && String(s.statistics.ispStatus).toLowerCase() !== "ok";
  return (ispBad ? 1000 : 0) + offline;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function AlertRow({
  tone,
  icon,
  title,
  subtitle,
}: {
  tone: "warn" | "danger";
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg bg-panel-2/60 ring-1 ring-border/50 p-3">
      <div
        className={
          tone === "danger"
            ? "text-danger bg-danger-soft ring-1 ring-danger/30 rounded-md p-1.5"
            : "text-warn bg-warn-soft ring-1 ring-warn/30 rounded-md p-1.5"
        }
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{title}</div>
        {subtitle ? <div className="text-xs text-muted truncate">{subtitle}</div> : null}
      </div>
      <Badge variant={tone} className="ml-auto shrink-0">
        <StatusDot tone={tone} pulse />
        {tone === "danger" ? "Critical" : "Warning"}
      </Badge>
    </div>
  );
}

function EmptyMessage({
  icon,
  title,
  hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="py-16 text-center">
      <div className="mx-auto mb-3 h-10 w-10 grid place-items-center rounded-full bg-panel-2 text-muted ring-1 ring-border">
        {icon}
      </div>
      <div className="font-medium">{title}</div>
      {hint ? <div className="text-sm text-muted mt-1">{hint}</div> : null}
    </div>
  );
}

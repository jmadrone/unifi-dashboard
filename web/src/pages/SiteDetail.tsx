import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { ChevronLeft, Globe, MapPin, Server } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { KpiCard } from "@/components/KpiCard";
import { DeviceTable } from "@/components/DeviceTable";
import { BandwidthChart, LatencyChart } from "@/components/IspMetricsChart";
import { useDevices, useIspMetrics, useSites } from "@/hooks/useUnifi";
import { unwrap, type UnifiDevice, type UnifiSite } from "@/lib/api";
import { formatNumber, formatPercent } from "@/lib/utils";

export function SiteDetail() {
  const params = useParams<{ siteId: string }>();
  const siteId = params.siteId ? decodeURIComponent(params.siteId) : undefined;

  const sitesQ = useSites();
  const devicesQ = useDevices();
  const metricsQ = useIspMetrics("5m", siteId ? { siteId, duration: "24h" } : undefined);

  const sites = unwrap<UnifiSite[]>(sitesQ.data) ?? [];
  const site = sites.find((s) => s.siteId === siteId);

  const allDeviceGroups = unwrap<any[]>(devicesQ.data) ?? [];
  const devicesForHost = useMemo<UnifiDevice[]>(() => {
    if (!site?.hostId) return [];
    const group = allDeviceGroups.find((g) => g?.hostId === site.hostId);
    return Array.isArray(group?.devices) ? group.devices : [];
  }, [allDeviceGroups, site]);

  const metrics = unwrap<any[]>(metricsQ.data) ?? [];

  if (!sitesQ.isLoading && !site) {
    return (
      <div className="space-y-4">
        <Link to="/sites" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> All sites
        </Link>
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted">
            Site not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const counts = site?.statistics?.counts ?? {};
  const isp = site?.statistics?.gateways?.[0];
  const ispStatus = (site?.statistics?.ispStatus ?? "ok").toLowerCase();
  const hasIspIssue = ispStatus !== "ok" && ispStatus !== "online";

  const totalDevices = Number(counts.totalDevice ?? 0);
  const offlineDevices = Number(counts.offlineDevice ?? 0);
  const online = Math.max(totalDevices - offlineDevices, 0);
  const onlinePct = totalDevices ? (online / totalDevices) * 100 : 0;
  const totalClients = Number(counts.wifiClient ?? 0) + Number(counts.wiredClient ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/sites" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> All sites
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted flex items-center gap-1.5">
              <MapPin className="h-3 w-3" />
              {site?.meta?.timezone ?? "—"}
            </div>
            <h2 className="text-3xl font-semibold tracking-tight">
              {site?.meta?.desc?.trim() || site?.meta?.name?.trim() || siteId}
            </h2>
            {isp?.ispName ? (
              <div className="mt-1 text-sm text-muted flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" />
                {isp.ispName}
                {isp.ispAsn ? ` · AS${isp.ispAsn}` : ""}
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {hasIspIssue ? <Badge variant="danger">Internet issue</Badge> : <Badge variant="ok">Internet OK</Badge>}
            {offlineDevices > 0 ? <Badge variant="warn">{offlineDevices} offline</Badge> : null}
          </div>
        </div>
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Devices online"
          value={
            <span>
              {formatNumber(online)}
              <span className="text-muted text-xl ml-1.5">/ {formatNumber(totalDevices)}</span>
            </span>
          }
          hint={formatPercent(onlinePct, 1)}
          tone={offlineDevices > 0 ? "warn" : "ok"}
          loading={sitesQ.isLoading}
        />
        <KpiCard
          label="Active clients"
          value={formatNumber(totalClients)}
          hint={`${formatNumber(counts.wifiClient ?? 0)} Wi-Fi · ${formatNumber(counts.wiredClient ?? 0)} wired`}
          tone="accent"
          loading={sitesQ.isLoading}
        />
        <KpiCard
          label="Guest clients"
          value={formatNumber(counts.guestClient ?? 0)}
          loading={sitesQ.isLoading}
        />
        <KpiCard
          label="WAN uptime (24h)"
          value={
            site?.statistics?.percentages?.wanUptime != null
              ? formatPercent(Number(site.statistics.percentages.wanUptime), 2)
              : "—"
          }
          tone={hasIspIssue ? "danger" : "ok"}
          loading={sitesQ.isLoading}
        />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <BandwidthChart data={metrics as any} loading={metricsQ.isLoading} />
        <LatencyChart data={metrics as any} loading={metricsQ.isLoading} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Devices at this site</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted">
            <Server className="h-3.5 w-3.5" />
            {devicesForHost.length} device{devicesForHost.length === 1 ? "" : "s"}
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {devicesQ.isLoading ? (
            <Skeleton className="m-5 h-40 w-[calc(100%-2.5rem)]" />
          ) : (
            <DeviceTable devices={devicesForHost} emptyMessage="No devices found for this host." />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

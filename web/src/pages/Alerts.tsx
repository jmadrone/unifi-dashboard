import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertOctagon, AlertTriangle, CircleCheck, Download, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDevices, useSites } from "@/hooks/useUnifi";
import { unwrap, type UnifiDevice, type UnifiSite } from "@/lib/api";

type Alert = {
  id: string;
  tone: "warn" | "danger";
  category: "ISP" | "Device" | "Firmware";
  title: string;
  detail?: string;
  link?: string;
};

export function Alerts() {
  const sitesQ = useSites();
  const devicesQ = useDevices();

  const sites = unwrap<UnifiSite[]>(sitesQ.data) ?? [];
  const groups = unwrap<any[]>(devicesQ.data) ?? [];
  const devices = useMemo<UnifiDevice[]>(
    () => groups.flatMap((g) => (Array.isArray(g?.devices) ? g.devices : [])),
    [groups],
  );

  const alerts = useMemo<Alert[]>(() => {
    const out: Alert[] = [];
    for (const s of sites) {
      const ispStatus = (s.statistics?.ispStatus ?? "ok").toLowerCase();
      if (ispStatus !== "ok" && ispStatus !== "online") {
        out.push({
          id: `isp-${s.siteId}`,
          tone: "danger",
          category: "ISP",
          title: `${s.meta?.desc?.trim() || s.meta?.name?.trim() || s.siteId}: internet issue`,
          detail: s.statistics?.gateways?.[0]?.ispName ?? undefined,
          link: `/sites/${encodeURIComponent(s.siteId ?? "")}`,
        });
      }
      const offline = Number(s.statistics?.counts?.offlineDevice ?? 0);
      if (offline > 0) {
        out.push({
          id: `offline-${s.siteId}`,
          tone: offline >= 3 ? "danger" : "warn",
          category: "Device",
          title: `${s.meta?.desc?.trim() || s.meta?.name?.trim() || s.siteId}: ${offline} device${offline === 1 ? "" : "s"} offline`,
          link: `/sites/${encodeURIComponent(s.siteId ?? "")}`,
        });
      }
    }
    for (const d of devices) {
      if (String(d.status ?? "").toLowerCase() !== "online") {
        out.push({
          id: `dev-${d.id ?? d.mac ?? Math.random()}`,
          tone: "warn",
          category: "Device",
          title: d.name ?? d.mac ?? "Device offline",
          detail: `${d.model ?? d.shortname ?? "device"} · ${d.ip ?? "no IP"}`,
        });
      }
      if (d.updateAvailable || d.firmwareStatus === "upgradable") {
        out.push({
          id: `fw-${d.id ?? d.mac ?? Math.random()}`,
          tone: "warn",
          category: "Firmware",
          title: `${d.name ?? d.mac}: firmware update available`,
          detail: `${d.version ?? "—"} → ${d.updateAvailable ?? "newer"}`,
        });
      }
    }
    return out;
  }, [sites, devices]);

  const grouped = useMemo(() => {
    const buckets: Record<Alert["category"], Alert[]> = { ISP: [], Device: [], Firmware: [] };
    for (const a of alerts) buckets[a.category].push(a);
    return buckets;
  }, [alerts]);

  const loading = sitesQ.isLoading || devicesQ.isLoading;

  return (
    <div className="space-y-6">
      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : alerts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CircleCheck className="h-10 w-10 text-ok mx-auto mb-3" />
            <div className="text-lg font-semibold">All clear</div>
            <div className="text-sm text-muted mt-1">No active alerts across the fleet.</div>
          </CardContent>
        </Card>
      ) : (
        <>
          <Section
            icon={<Globe className="h-4 w-4" />}
            title="ISP"
            alerts={grouped.ISP}
            emptyText="All WAN links healthy."
          />
          <Section
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Devices"
            alerts={grouped.Device}
            emptyText="All devices online."
          />
          <Section
            icon={<Download className="h-4 w-4" />}
            title="Firmware"
            alerts={grouped.Firmware}
            emptyText="All firmware current."
          />
        </>
      )}
    </div>
  );
}

function Section({
  icon,
  title,
  alerts,
  emptyText,
}: {
  icon: React.ReactNode;
  title: string;
  alerts: Alert[];
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <Badge variant={alerts.length === 0 ? "ok" : alerts.some((a) => a.tone === "danger") ? "danger" : "warn"}>
          {alerts.length} active
        </Badge>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-sm text-muted py-2 flex items-center gap-2">
            <CircleCheck className="h-4 w-4 text-ok" /> {emptyText}
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {alerts.map((a) => (
              <li key={a.id} className="py-3 flex items-start gap-3">
                <span
                  className={
                    a.tone === "danger"
                      ? "rounded-md p-1.5 bg-danger-soft text-danger ring-1 ring-danger/30"
                      : "rounded-md p-1.5 bg-warn-soft text-warn ring-1 ring-warn/30"
                  }
                >
                  <AlertOctagon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{a.title}</div>
                  {a.detail ? <div className="text-xs text-muted truncate">{a.detail}</div> : null}
                </div>
                {a.link ? (
                  <Link
                    to={a.link}
                    className="text-xs text-accent hover:underline shrink-0"
                  >
                    View
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

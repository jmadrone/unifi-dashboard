import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusDot } from "@/components/ui/StatusDot";
import { useHosts } from "@/hooks/useUnifi";
import { relativeTime } from "@/lib/utils";
import { unwrap, type UnifiHost } from "@/lib/api";

export function Hosts() {
  const hostsQ = useHosts();
  const hosts = unwrap<UnifiHost[]>(hostsQ.data) ?? [];

  if (hostsQ.isLoading) {
    return (
      <div className="grid grid-fluid gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full" />
        ))}
      </div>
    );
  }

  if (!hosts.length) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-sm text-muted">
          No hosts visible to this API key.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-fluid gap-4">
      {hosts.map((h) => {
        const state = (h.reportedState?.state ?? "unknown").toLowerCase();
        const online = state === "connected" || state === "online";
        return (
          <Card key={h.id ?? h.hardwareId}>
            <CardHeader>
              <CardTitle>{h.reportedState?.name ?? h.reportedState?.hostname ?? h.id}</CardTitle>
              <Badge variant={online ? "ok" : "danger"}>
                <StatusDot tone={online ? "ok" : "danger"} pulse={!online} />
                {online ? "Online" : h.reportedState?.state ?? "Offline"}
              </Badge>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Row label="Model" value={h.reportedState?.hardware?.name ?? h.reportedState?.hardware?.shortname ?? "—"} />
                <Row label="Version" value={h.reportedState?.version ?? "—"} mono />
                <Row label="IP" value={h.reportedState?.ip ?? h.ipAddress ?? "—"} mono />
                <Row label="Type" value={h.type ?? "—"} />
                <Row
                  label="Owner"
                  value={h.userData?.fullName ?? h.userData?.email ?? "—"}
                />
                <Row
                  label={online ? "Online since" : "Offline since"}
                  value={relativeTime(h.lastConnectionStateChange)}
                />
                <Row label="Registered" value={relativeTime(h.registrationTime)} />
                <Row label="Backup" value={relativeTime(h.latestBackupTime)} />
              </dl>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function Row({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-muted">{label}</dt>
      <dd className={`mt-0.5 text-sm ${mono ? "font-mono" : ""} truncate`}>{value}</dd>
    </div>
  );
}

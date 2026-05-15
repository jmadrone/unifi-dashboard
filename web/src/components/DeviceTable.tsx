import { Badge } from "@/components/ui/Badge";
import { StatusDot } from "@/components/ui/StatusDot";
import { cn } from "@/lib/utils";
import type { UnifiDevice } from "@/lib/api";

export function DeviceTable({
  devices,
  emptyMessage = "No devices.",
  maxRows,
}: {
  devices: UnifiDevice[];
  emptyMessage?: string;
  maxRows?: number;
}) {
  const rows = maxRows ? devices.slice(0, maxRows) : devices;
  if (!rows.length) {
    return (
      <div className="px-5 py-12 text-center text-sm text-muted">{emptyMessage}</div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[10px] uppercase tracking-wider text-muted">
          <tr className="border-b border-border/60">
            <Th className="pl-5">Name</Th>
            <Th>Model</Th>
            <Th>IP</Th>
            <Th>Version</Th>
            <Th>Status</Th>
            <Th className="pr-5 text-right">Update</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((d, i) => {
            const isOnline = String(d.status ?? "").toLowerCase() === "online";
            return (
              <tr
                key={d.id ?? d.mac ?? i}
                className="border-b border-border/40 last:border-0 hover:bg-panel-2/40"
              >
                <Td className="pl-5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <StatusDot tone={isOnline ? "ok" : "danger"} pulse={!isOnline} />
                    <span className="font-medium truncate">{d.name ?? "—"}</span>
                  </div>
                </Td>
                <Td className="text-muted">{d.model ?? d.shortname ?? "—"}</Td>
                <Td className="font-mono text-xs text-muted">{d.ip ?? "—"}</Td>
                <Td className="font-mono text-xs text-muted">{d.version ?? "—"}</Td>
                <Td>
                  {isOnline ? (
                    <Badge variant="ok">Online</Badge>
                  ) : (
                    <Badge variant="danger">{d.status ?? "Offline"}</Badge>
                  )}
                </Td>
                <Td className="pr-5 text-right">
                  {d.updateAvailable || d.firmwareStatus === "upgradable" ? (
                    <Badge variant="warn">Update available</Badge>
                  ) : (
                    <span className="text-muted text-xs">Up to date</span>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={cn("text-left font-medium px-3 py-2.5", className)}>{children}</th>
  );
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2.5", className)}>{children}</td>;
}

import { useMemo, useState } from "react";
import { Filter, Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { DeviceTable } from "@/components/DeviceTable";
import { Badge } from "@/components/ui/Badge";
import { useDevices } from "@/hooks/useUnifi";
import { unwrap, type UnifiDevice } from "@/lib/api";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | "online" | "offline" | "updates";

export function Devices() {
  const devicesQ = useDevices();
  const groups = unwrap<any[]>(devicesQ.data) ?? [];
  const all = useMemo<UnifiDevice[]>(
    () => groups.flatMap((g) => (Array.isArray(g?.devices) ? g.devices : [])),
    [groups],
  );

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return all.filter((d) => {
      if (statusFilter === "online" && String(d.status).toLowerCase() !== "online") return false;
      if (statusFilter === "offline" && String(d.status).toLowerCase() === "online") return false;
      if (statusFilter === "updates" && !(d.updateAvailable || d.firmwareStatus === "upgradable")) return false;
      if (!query) return true;
      return [d.name, d.mac, d.ip, d.model, d.shortname, d.productLine]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(query));
    });
  }, [all, q, statusFilter]);

  const counts = useMemo(() => {
    let online = 0,
      offline = 0,
      updates = 0;
    for (const d of all) {
      if (String(d.status).toLowerCase() === "online") online++;
      else offline++;
      if (d.updateAvailable || d.firmwareStatus === "upgradable") updates++;
    }
    return { online, offline, updates, total: all.length };
  }, [all]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2.5 text-sm text-muted flex-1 min-w-[240px]">
            <Search className="h-4 w-4" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, IP, MAC, model…"
              className="bg-transparent outline-none w-full text-foreground placeholder:text-muted"
            />
          </label>
          <div className="flex items-center gap-1.5 text-xs">
            <Filter className="h-3.5 w-3.5 text-muted mr-1" />
            <FilterBtn current={statusFilter} value="all" onSelect={setStatusFilter}>
              All <span className="opacity-60 ml-1">{counts.total}</span>
            </FilterBtn>
            <FilterBtn current={statusFilter} value="online" onSelect={setStatusFilter} tone="ok">
              Online <span className="opacity-60 ml-1">{counts.online}</span>
            </FilterBtn>
            <FilterBtn current={statusFilter} value="offline" onSelect={setStatusFilter} tone="danger">
              Offline <span className="opacity-60 ml-1">{counts.offline}</span>
            </FilterBtn>
            <FilterBtn current={statusFilter} value="updates" onSelect={setStatusFilter} tone="warn">
              Updates <span className="opacity-60 ml-1">{counts.updates}</span>
            </FilterBtn>
          </div>
        </CardContent>
      </Card>

      <Card>
        {devicesQ.isLoading ? (
          <CardContent>
            <Skeleton className="h-72 w-full" />
          </CardContent>
        ) : (
          <>
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-muted">
                Showing {filtered.length} of {all.length}
              </div>
              <Badge variant="muted">
                {groups.length} host{groups.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <DeviceTable devices={filtered} />
          </>
        )}
      </Card>
    </div>
  );
}

function FilterBtn({
  current,
  value,
  onSelect,
  tone = "default",
  children,
}: {
  current: StatusFilter;
  value: StatusFilter;
  onSelect: (v: StatusFilter) => void;
  tone?: "default" | "ok" | "warn" | "danger";
  children: React.ReactNode;
}) {
  const active = current === value;
  const toneRing =
    tone === "ok"
      ? "ring-ok/40 text-ok"
      : tone === "warn"
      ? "ring-warn/40 text-warn"
      : tone === "danger"
      ? "ring-danger/40 text-danger"
      : "ring-border text-foreground";
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        "px-2.5 py-1 rounded-md ring-1 transition-colors text-xs",
        active ? `bg-panel-2 ${toneRing}` : "bg-transparent ring-border/60 text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

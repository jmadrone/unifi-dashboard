import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { SiteCard } from "@/components/SiteCard";
import { useSites } from "@/hooks/useUnifi";
import { unwrap, type UnifiSite } from "@/lib/api";

export function Sites() {
  const sitesQ = useSites();
  const sites = unwrap<UnifiSite[]>(sitesQ.data) ?? [];
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = !q
      ? sites
      : sites.filter((s) =>
          [s.meta?.desc, s.meta?.name, s.statistics?.gateways?.[0]?.ispName, s.siteId]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)),
        );
    return [...list].sort((a, b) => severity(b) - severity(a));
  }, [sites, filter]);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="py-3">
          <label className="flex items-center gap-3 text-sm text-muted">
            <Search className="h-4 w-4" />
            <input
              type="search"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter sites by name, ISP, ID…"
              className="bg-transparent outline-none w-full text-foreground placeholder:text-muted"
              autoFocus
            />
            <span className="text-xs tabular-nums">{filtered.length} / {sites.length}</span>
          </label>
        </CardContent>
      </Card>

      {sitesQ.isLoading ? (
        <div className="grid grid-fluid gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted">
            No sites match "{filter}".
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-fluid gap-4">
          {filtered.map((s) => (
            <SiteCard key={s.siteId} site={s} />
          ))}
        </div>
      )}
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

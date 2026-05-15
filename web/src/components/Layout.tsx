import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Activity, Boxes, LayoutDashboard, MapPinned, Network, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { StatusDot } from "@/components/ui/StatusDot";
import { cn } from "@/lib/utils";
import { useHealth, useOverview } from "@/hooks/useUnifi";

export function Layout() {
  return (
    <div className="min-h-screen w-full grid grid-cols-[260px_1fr]">
      <Sidebar />
      <div className="flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 min-w-0 p-6 lg:p-8 2xl:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Sidebar() {
  const items = [
    { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/sites", label: "Sites", icon: MapPinned },
    { to: "/devices", label: "Devices", icon: Boxes },
    { to: "/hosts", label: "Hosts", icon: Network },
    { to: "/alerts", label: "Alerts", icon: Activity },
  ];
  return (
    <aside className="border-r border-border/70 bg-panel/40 backdrop-blur-md flex flex-col">
      <div className="px-5 py-5 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-accent to-purple-500 grid place-items-center shadow-glow">
          <Wifi className="h-5 w-5 text-background" strokeWidth={2.6} />
        </div>
        <div className="leading-tight">
          <div className="text-base font-semibold tracking-tight">UniFi NOC</div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Fleet Operations</div>
        </div>
      </div>

      <nav className="px-3 mt-2 flex flex-col gap-0.5">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                "text-muted hover:text-foreground hover:bg-panel-2/70",
                isActive && "text-foreground bg-panel-2 ring-1 ring-border",
              )
            }
          >
            <Icon className="h-4 w-4 opacity-80 group-hover:opacity-100" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto p-4 border-t border-border/70">
        <FleetStatus />
      </div>
    </aside>
  );
}

function FleetStatus() {
  const overview = useOverview();
  const health = useHealth();
  const issues =
    (overview.data?.devices.offline ?? 0) + (overview.data?.sites.internetIssues ?? 0);
  const tone = issues === 0 ? "ok" : issues > 5 ? "danger" : "warn";
  return (
    <div className="rounded-lg bg-panel-2/70 ring-1 ring-border/60 p-3">
      <div className="flex items-center gap-2">
        <StatusDot tone={tone} pulse={tone !== "ok"} />
        <span className="text-xs font-medium">
          {tone === "ok" ? "All systems nominal" : `${issues} active issue${issues === 1 ? "" : "s"}`}
        </span>
      </div>
      <div className="mt-2 text-[11px] text-muted leading-relaxed">
        {health.data?.mock ? "Mock data (no API key)" : "Live · Site Manager API"}
      </div>
    </div>
  );
}

function Topbar() {
  const overview = useOverview();
  const location = useLocation();
  const title = pageTitle(location.pathname);
  const generatedAt = overview.data?.generatedAt;

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/70 border-b border-border/60">
      <div className="px-6 lg:px-8 2xl:px-10 py-4 flex items-center justify-between gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Operations</div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        </div>
        <div className="flex items-center gap-6">
          <Metric label="Sites" value={overview.data?.totals.sites ?? "—"} />
          <Metric label="Devices" value={overview.data?.totals.devices ?? "—"} />
          <Metric
            label="Clients"
            value={overview.data?.sites.totalClients ?? "—"}
            tone="accent"
          />
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Local time</div>
            <div className="font-mono text-base tabular-nums">
              {now.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </div>
            {generatedAt ? (
              <div className="text-[10px] text-muted">
                Refreshed {new Date(generatedAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function Metric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "accent";
}) {
  return (
    <div className="text-right">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">{label}</div>
      <div
        className={cn(
          "text-xl font-semibold tabular-nums",
          tone === "accent" && "text-accent",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function pageTitle(pathname: string): string {
  if (pathname === "/" || pathname === "") return "Fleet Overview";
  if (pathname.startsWith("/sites/")) return "Site Detail";
  if (pathname.startsWith("/sites")) return "Sites";
  if (pathname.startsWith("/devices")) return "Devices";
  if (pathname.startsWith("/hosts")) return "Consoles & Hosts";
  if (pathname.startsWith("/alerts")) return "Alerts";
  return "UniFi NOC";
}

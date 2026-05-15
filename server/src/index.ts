import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";

// Load .env from the server dir first, then fall back to the repo root.
const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../.env") });
loadEnv({ path: resolve(__dirname, "../../.env") });
import compression from "compression";
import cors from "cors";
import morgan from "morgan";
import { UnifiClient, UnifiApiError, unwrap } from "./unifiClient.js";
import { mockDevices, mockHosts, mockIspMetrics, mockSites } from "./mock.js";

const PORT = Number(process.env.PORT ?? 4000);
const API_KEY = process.env.UNIFI_API_KEY ?? "";
const API_BASE = process.env.UNIFI_API_BASE ?? "https://api.ui.com";
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS ?? 20);
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN ?? "";
const USE_MOCK = !API_KEY;

if (USE_MOCK) {
  console.warn(
    "[unifi-dashboard] UNIFI_API_KEY not set — serving MOCK data. Set it in .env to call the real Site Manager API.",
  );
}

const client = USE_MOCK
  ? null
  : new UnifiClient({ apiKey: API_KEY, baseUrl: API_BASE, cacheTtlSeconds: CACHE_TTL_SECONDS });

const app = express();
app.disable("x-powered-by");
app.use(compression());
app.use(cors());
app.use(morgan("tiny"));
app.use(express.json({ limit: "256kb" }));

app.use("/api", (req: Request, res: Response, next: NextFunction) => {
  if (!DASHBOARD_TOKEN) return next();
  const token = req.header("x-dashboard-token");
  if (token !== DASHBOARD_TOKEN) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    mock: USE_MOCK,
    uptime: process.uptime(),
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    timestamp: new Date().toISOString(),
  });
});

async function proxy<T>(
  res: Response,
  path: string,
  query?: Record<string, string | number | undefined>,
  opts?: { ttlSeconds?: number; mockFallback?: () => unknown; paginate?: boolean },
) {
  if (USE_MOCK) {
    if (opts?.mockFallback) {
      res.json(opts.mockFallback());
      return;
    }
    res.status(503).json({ error: "missing UNIFI_API_KEY" });
    return;
  }
  try {
    const body = opts?.paginate
      ? await client!.getAllPages<T>(path, query, { ttlSeconds: opts.ttlSeconds })
      : await client!.get<T>(path, query, opts);
    res.json(body);
  } catch (err) {
    if (err instanceof UnifiApiError) {
      res.status(err.status >= 400 && err.status < 600 ? err.status : 502).json({
        error: "unifi_api_error",
        status: err.status,
        body: err.body,
      });
      return;
    }
    console.error(err);
    res.status(502).json({ error: "upstream_error", message: (err as Error).message });
  }
}

app.get("/api/hosts", (req, res) => {
  void proxy(res, "/v1/hosts", { pageSize: req.query.pageSize as string | undefined }, {
    mockFallback: mockHosts,
    paginate: true,
  });
});

app.get("/api/sites", (req, res) => {
  void proxy(res, "/v1/sites", { pageSize: req.query.pageSize as string | undefined }, {
    mockFallback: mockSites,
    paginate: true,
  });
});

app.get("/api/devices", (req, res) => {
  void proxy(res, "/v1/devices", {
    hostIds: req.query.hostIds as string | undefined,
    time: req.query.time as string | undefined,
  }, {
    mockFallback: mockDevices,
    paginate: true,
  });
});

app.get("/api/isp-metrics/:interval", (req, res) => {
  const interval = req.params.interval === "5m" ? "5m" : "1h";
  const siteId = req.query.siteId as string | undefined;
  void proxy(
    res,
    `/ea/isp-metrics/${interval}`,
    {
      beginTimestamp: req.query.beginTimestamp as string | undefined,
      endTimestamp: req.query.endTimestamp as string | undefined,
      duration: req.query.duration as string | undefined,
      hostId: req.query.hostId as string | undefined,
      siteId,
    },
    {
      ttlSeconds: interval === "5m" ? 60 : 300,
      mockFallback: () => mockIspMetrics(interval, siteId),
    },
  );
});

app.get("/api/overview", async (_req, res) => {
  try {
    const [hostsRaw, sitesRaw, devicesRaw] = USE_MOCK
      ? [mockHosts(), mockSites(), mockDevices()]
      : await Promise.all([
          client!.getAllPages("/v1/hosts"),
          client!.getAllPages("/v1/sites"),
          client!.getAllPages("/v1/devices"),
        ]);

    const hosts = unwrap<any[]>(hostsRaw) ?? [];
    const sites = unwrap<any[]>(sitesRaw) ?? [];
    const devices = unwrap<any[]>(devicesRaw) ?? [];

    const aggregate = {
      totals: {
        hosts: hosts.length,
        sites: sites.length,
        devices: devices.reduce((acc, g) => acc + (Array.isArray(g?.devices) ? g.devices.length : 0), 0),
      },
      devices: summarizeDevices(devices),
      sites: summarizeSites(sites),
      hosts: summarizeHosts(hosts),
      generatedAt: new Date().toISOString(),
      mock: USE_MOCK || undefined,
    };

    res.json(aggregate);
  } catch (err) {
    if (err instanceof UnifiApiError) {
      res.status(502).json({ error: "unifi_api_error", status: err.status, body: err.body });
      return;
    }
    console.error(err);
    res.status(502).json({ error: "upstream_error", message: (err as Error).message });
  }
});

function summarizeDevices(devices: any[]) {
  let online = 0;
  let offline = 0;
  const byProductLine: Record<string, { total: number; online: number; offline: number }> = {};
  let updatesAvailable = 0;

  for (const list of devices) {
    const arr = Array.isArray(list?.devices) ? list.devices : Array.isArray(list) ? list : [];
    const items = Array.isArray(list?.devices) ? list.devices : Array.isArray(list) ? list : [list];
    const finalArr = arr.length ? arr : items;

    for (const d of finalArr) {
      if (!d || typeof d !== "object") continue;
      const pl = String(d.productLine ?? d.product_line ?? "unknown");
      const bucket = (byProductLine[pl] ??= { total: 0, online: 0, offline: 0 });
      bucket.total++;
      const isOnline = String(d.status ?? "").toLowerCase() === "online";
      if (isOnline) {
        online++;
        bucket.online++;
      } else {
        offline++;
        bucket.offline++;
      }
      if (d.updateAvailable || d.firmwareStatus === "upgradable") updatesAvailable++;
    }
  }

  return { total: online + offline, online, offline, updatesAvailable, byProductLine };
}

function summarizeSites(sites: any[]) {
  let totalDevices = 0;
  let offlineDevices = 0;
  let wifiClients = 0;
  let wiredClients = 0;
  let guestClients = 0;
  let internetIssues = 0;

  for (const s of sites) {
    const counts = s?.statistics?.counts ?? s?.siteStatistics?.counts ?? s?.meta?.counts ?? {};
    totalDevices += Number(counts.totalDevice ?? 0);
    offlineDevices += Number(counts.offlineDevice ?? 0);
    wifiClients += Number(counts.wifiClient ?? 0);
    wiredClients += Number(counts.wiredClient ?? 0);
    guestClients += Number(counts.guestClient ?? 0);

    const isp =
      s?.statistics?.ispStatus ??
      s?.siteStatistics?.ispStatus ??
      s?.meta?.ispStatus ??
      s?.ispStatus;
    if (isp && String(isp).toLowerCase() !== "ok") internetIssues++;
  }

  return {
    totalDevices,
    offlineDevices,
    wifiClients,
    wiredClients,
    guestClients,
    totalClients: wifiClients + wiredClients,
    internetIssues,
  };
}

function summarizeHosts(hosts: any[]) {
  let online = 0;
  let offline = 0;
  for (const h of hosts) {
    const reported = h?.reportedState?.state ?? h?.state ?? "unknown";
    if (String(reported).toLowerCase() === "connected" || String(reported).toLowerCase() === "online") {
      online++;
    } else {
      offline++;
    }
  }
  return { total: hosts.length, online, offline };
}

app.use((req, res) => {
  res.status(404).json({ error: "not_found", path: req.path });
});

app.listen(PORT, () => {
  console.log(`[unifi-dashboard] proxy listening on http://localhost:${PORT}`);
  console.log(`[unifi-dashboard] mode: ${USE_MOCK ? "MOCK (no API key)" : "LIVE (Site Manager API)"}`);
});

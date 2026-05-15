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
const API_BASE = process.env.UNIFI_API_BASE ?? "https://api.ui.com";
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS ?? 20);
const DASHBOARD_TOKEN = process.env.DASHBOARD_TOKEN ?? "";

// Collect API keys from env. Supports:
//   UNIFI_API_KEY=...                       (single)
//   UNIFI_API_KEYS=key1,key2,...            (comma/newline/whitespace separated)
//   UNIFI_API_KEY_<LABEL>=...               (one per UI account; LABEL is shown in logs)
function collectApiKeys(): Array<{ label: string; key: string }> {
  const out = new Map<string, { label: string; key: string }>();
  const add = (label: string, key: string) => {
    const trimmed = key.trim();
    if (!trimmed) return;
    if (!out.has(trimmed)) out.set(trimmed, { label, key: trimmed });
  };
  if (process.env.UNIFI_API_KEY) add("default", process.env.UNIFI_API_KEY);
  if (process.env.UNIFI_API_KEYS) {
    const parts = process.env.UNIFI_API_KEYS.split(/[\s,]+/).filter(Boolean);
    parts.forEach((k, i) => add(`keys[${i}]`, k));
  }
  for (const [name, val] of Object.entries(process.env)) {
    if (!val) continue;
    const m = name.match(/^UNIFI_API_KEY_(.+)$/);
    if (m) add(m[1]!.toLowerCase(), val);
  }
  return [...out.values()];
}

const API_KEYS = collectApiKeys();
const USE_MOCK = API_KEYS.length === 0;

if (USE_MOCK) {
  console.warn(
    "[unifi-dashboard] No UNIFI_API_KEY(s) set — serving MOCK data. Set UNIFI_API_KEY, UNIFI_API_KEYS, or UNIFI_API_KEY_<LABEL> in .env to call the real Site Manager API.",
  );
}

type LabeledClient = { label: string; client: UnifiClient };
const clients: LabeledClient[] = USE_MOCK
  ? []
  : API_KEYS.map(({ label, key }) => ({
      label,
      client: new UnifiClient({ apiKey: key, baseUrl: API_BASE, cacheTtlSeconds: CACHE_TTL_SECONDS }),
    }));

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
    accounts: clients.map((c) => c.label),
    uptime: process.uptime(),
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Fan out a paginated GET across every configured UniFi account and merge the
 * `data` arrays. Each result item is tagged with `_account: <label>` so we can
 * trace it back to the originating key. Errors from individual accounts are
 * captured into `errors` rather than failing the whole request.
 */
async function fanOutPaginated<T = any>(
  path: string,
  query?: Record<string, string | number | undefined>,
  opts?: { ttlSeconds?: number },
): Promise<{ data: T[]; errors: Array<{ account: string; status?: number; message: string }> }> {
  const data: T[] = [];
  const errors: Array<{ account: string; status?: number; message: string }> = [];
  const results = await Promise.allSettled(
    clients.map(({ client }) => client.getAllPages<T>(path, query, opts)),
  );
  results.forEach((r, i) => {
    const label = clients[i]!.label;
    if (r.status === "fulfilled") {
      for (const item of r.value.data) {
        if (item && typeof item === "object") (item as any)._account = label;
        data.push(item);
      }
    } else {
      const err = r.reason;
      if (err instanceof UnifiApiError) {
        errors.push({ account: label, status: err.status, message: String(err.message) });
      } else {
        errors.push({ account: label, message: (err as Error)?.message ?? String(err) });
      }
    }
  });
  return { data, errors };
}

// Dedupe by a stable key (e.g. id, siteId, hostId), keeping the first occurrence.
function dedupeBy<T>(items: T[], keyFn: (x: T) => string | undefined): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = keyFn(it);
    if (!k) {
      out.push(it);
      continue;
    }
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

/**
 * Cache mapping siteId → account label, learned from /v1/sites responses, so
 * we can route siteId-specific requests (e.g. ISP metrics) to the right key.
 */
const siteAccountMap = new Map<string, string>();
const hostAccountMap = new Map<string, string>();

function rememberOwnership(sites: any[], hosts: any[]) {
  for (const s of sites) {
    if (s?.siteId && s?._account) siteAccountMap.set(String(s.siteId), String(s._account));
  }
  for (const h of hosts) {
    if (h?.id && h?._account) hostAccountMap.set(String(h.id), String(h._account));
  }
}

function clientFor(label: string | undefined): UnifiClient | undefined {
  if (!label) return clients[0]?.client;
  return clients.find((c) => c.label === label)?.client;
}

app.get("/api/hosts", async (_req, res) => {
  if (USE_MOCK) {
    res.json(mockHosts());
    return;
  }
  const { data, errors } = await fanOutPaginated<any>("/v1/hosts");
  const deduped = dedupeBy(data, (h) => String(h?.id ?? ""));
  rememberOwnership([], deduped);
  res.json({ data: deduped, httpStatusCode: 200, accounts: clients.map((c) => c.label), errors });
});

app.get("/api/sites", async (_req, res) => {
  if (USE_MOCK) {
    res.json(mockSites());
    return;
  }
  const [sitesFan, hostsFan, devicesFan] = await Promise.all([
    fanOutPaginated<any>("/v1/sites"),
    fanOutPaginated<any>("/v1/hosts"),
    fanOutPaginated<any>("/v1/devices"),
  ]);
  const sites = dedupeBy(sitesFan.data, (s) => String(s?.siteId ?? ""));
  const hosts = dedupeBy(hostsFan.data, (h) => String(h?.id ?? ""));
  const devices = dedupeBy(devicesFan.data, (g) => String(g?.hostId ?? ""));
  rememberOwnership(sites, hosts);
  const merged = mergeSitesWithHosts(sites, hosts, devices);
  res.json({
    data: merged,
    httpStatusCode: 200,
    accounts: clients.map((c) => c.label),
    errors: [...sitesFan.errors, ...hostsFan.errors, ...devicesFan.errors],
  });
});

app.get("/api/devices", async (req, res) => {
  if (USE_MOCK) {
    res.json(mockDevices());
    return;
  }
  const { data, errors } = await fanOutPaginated<any>("/v1/devices", {
    hostIds: req.query.hostIds as string | undefined,
    time: req.query.time as string | undefined,
  });
  const deduped = dedupeBy(data, (g) => String(g?.hostId ?? ""));
  res.json({ data: deduped, httpStatusCode: 200, accounts: clients.map((c) => c.label), errors });
});

app.get("/api/isp-metrics/:interval", async (req, res) => {
  const interval = req.params.interval === "5m" ? "5m" : "1h";
  const siteId = req.query.siteId as string | undefined;
  const hostId = req.query.hostId as string | undefined;
  const ttl = interval === "5m" ? 60 : 300;
  const query = {
    beginTimestamp: req.query.beginTimestamp as string | undefined,
    endTimestamp: req.query.endTimestamp as string | undefined,
    duration: req.query.duration as string | undefined,
    hostId,
    siteId,
  };

  if (USE_MOCK) {
    res.json(mockIspMetrics(interval, siteId));
    return;
  }

  const accountLabel =
    (siteId && siteAccountMap.get(siteId)) ||
    (hostId && hostAccountMap.get(hostId)) ||
    undefined;
  const target = clientFor(accountLabel);

  // If we know which account owns this site/host, ask only that one. Otherwise
  // fan out and return the first non-empty result (or merge if siteId is unset).
  try {
    if (target) {
      const body = await target.get(`/ea/isp-metrics/${interval}`, query, { ttlSeconds: ttl });
      res.json(body);
      return;
    }
    const results = await Promise.allSettled(
      clients.map(({ client }) =>
        client.get<any>(`/ea/isp-metrics/${interval}`, query, { ttlSeconds: ttl }),
      ),
    );
    const merged: any[] = [];
    const errors: any[] = [];
    results.forEach((r, i) => {
      const label = clients[i]!.label;
      if (r.status === "fulfilled") {
        const arr = unwrap<any[]>(r.value) ?? [];
        for (const item of arr) {
          if (item && typeof item === "object") (item as any)._account = label;
          merged.push(item);
        }
      } else if (r.reason instanceof UnifiApiError) {
        errors.push({ account: label, status: r.reason.status, message: r.reason.message });
      } else {
        errors.push({ account: label, message: (r.reason as Error)?.message ?? String(r.reason) });
      }
    });
    res.json({ data: merged, httpStatusCode: 200, errors });
  } catch (err) {
    if (err instanceof UnifiApiError) {
      res.status(502).json({ error: "unifi_api_error", status: err.status, body: err.body });
      return;
    }
    console.error(err);
    res.status(502).json({ error: "upstream_error", message: (err as Error).message });
  }
});

app.get("/api/overview", async (_req, res) => {
  try {
    let hosts: any[];
    let sites: any[];
    let devices: any[];

    if (USE_MOCK) {
      hosts = unwrap<any[]>(mockHosts()) ?? [];
      sites = unwrap<any[]>(mockSites()) ?? [];
      devices = unwrap<any[]>(mockDevices()) ?? [];
    } else {
      const [hostsFan, sitesFan, devicesFan] = await Promise.all([
        fanOutPaginated<any>("/v1/hosts"),
        fanOutPaginated<any>("/v1/sites"),
        fanOutPaginated<any>("/v1/devices"),
      ]);
      hosts = dedupeBy(hostsFan.data, (h) => String(h?.id ?? ""));
      const rawSites = dedupeBy(sitesFan.data, (s) => String(s?.siteId ?? ""));
      devices = dedupeBy(devicesFan.data, (g) => String(g?.hostId ?? ""));
      rememberOwnership(rawSites, hosts);
      sites = mergeSitesWithHosts(rawSites, hosts, devices);
    }

    const aggregate = {
      totals: {
        hosts: hosts.length,
        sites: sites.length,
        devices: devices.reduce((acc, g) => acc + (Array.isArray(g?.devices) ? g.devices.length : 0), 0),
      },
      devices: summarizeDevices(devices),
      sites: summarizeSites(sites),
      hosts: summarizeHosts(hosts),
      accounts: clients.map((c) => c.label),
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

function summarizeHosts(hosts: any[]) {  let online = 0;
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

/**
 * The UniFi Site Manager `/v1/sites` endpoint only returns sites from hosts running
 * the UniFi Network application. Hosts that are Protect-only (e.g. UNVR) or that
 * the API otherwise omits never appear there. To give a complete view, we merge in
 * synthetic site entries for every host that isn't already represented as a site.
 */
function mergeSitesWithHosts(sites: any[], hosts: any[], devices: any[] = []): any[] {
  // Build a per-host device count map from /v1/devices groups (keyed by hostId).
  const deviceCountsByHost = new Map<string, { total: number; offline: number }>();
  for (const g of devices) {
    const hostId = String(g?.hostId ?? "");
    if (!hostId) continue;
    const arr = Array.isArray(g?.devices) ? g.devices : [];
    let total = 0;
    let offline = 0;
    for (const d of arr) {
      if (!d || typeof d !== "object") continue;
      total++;
      if (String(d.status ?? "").toLowerCase() !== "online") offline++;
    }
    const prev = deviceCountsByHost.get(hostId);
    if (prev) {
      prev.total += total;
      prev.offline += offline;
    } else {
      deviceCountsByHost.set(hostId, { total, offline });
    }
  }

  // Enrich existing sites whose totalDevice is 0 but we have devices for that host.
  const enrichedSites = sites.map((s) => {
    const counts = s?.statistics?.counts ?? {};
    const totalDevice = Number(counts.totalDevice ?? 0);
    const hostId = s?.hostId ? String(s.hostId) : "";
    if (totalDevice > 0 || !hostId) return s;
    const c = deviceCountsByHost.get(hostId);
    if (!c || c.total === 0) return s;
    return {
      ...s,
      statistics: {
        ...(s.statistics ?? {}),
        counts: {
          ...counts,
          totalDevice: c.total,
          offlineDevice: Number(counts.offlineDevice ?? 0) || c.offline,
        },
      },
    };
  });

  const seenHostIds = new Set<string>();
  for (const s of enrichedSites) {
    if (s?.hostId) seenHostIds.add(String(s.hostId));
  }

  const synthetic: any[] = [];
  for (const h of hosts) {
    const hostId = String(h?.id ?? h?.hardwareId ?? "");
    if (!hostId || seenHostIds.has(hostId)) continue;

    const reported = h?.reportedState ?? {};
    const hardware = reported.hardware ?? {};
    const name = reported.name ?? hardware.name ?? hardware.shortname ?? hostId;
    const stateRaw = String(reported.state ?? h?.state ?? "").toLowerCase();
    const isOnline = stateRaw === "connected" || stateRaw === "online";
    const counts = deviceCountsByHost.get(hostId) ?? { total: 0, offline: 0 };
    const totalDevice = counts.total || Number(reported.deviceCount ?? 0);

    synthetic.push({
      siteId: `host:${hostId}`,
      hostId,
      isOwner: Boolean(h?.isOwner),
      permission: h?.userData?.permissions ?? h?.permission ?? "viewer",
      meta: {
        name,
        desc: name,
        timezone: reported.timezone ?? reported.tz ?? undefined,
        gatewayMac: reported.mac ?? hardware.mac ?? undefined,
        hostType: hardware.shortname ?? hardware.name ?? undefined,
      },
      statistics: {
        counts: {
          totalDevice,
          offlineDevice: counts.offline,
          wifiClient: 0,
          wiredClient: 0,
          guestClient: 0,
        },
        gateways: [],
        ispStatus: isOnline ? "ok" : "down",
        percentages: {},
      },
      synthetic: true,
      source: "host",
      hostState: stateRaw || "unknown",
    });
  }

  return [...enrichedSites, ...synthetic];
}

app.use((req, res) => {
  res.status(404).json({ error: "not_found", path: req.path });
});

app.listen(PORT, () => {
  console.log(`[unifi-dashboard] proxy listening on http://localhost:${PORT}`);
  if (USE_MOCK) {
    console.log(`[unifi-dashboard] mode: MOCK (no API key)`);
  } else {
    console.log(
      `[unifi-dashboard] mode: LIVE (Site Manager API) — accounts: ${clients
        .map((c) => c.label)
        .join(", ")}`,
    );
  }
});

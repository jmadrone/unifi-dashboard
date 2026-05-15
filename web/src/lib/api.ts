const API_BASE = "/api";

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message?: string) {
    super(message ?? `API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const api = {
  health: () => request<{ status: string; mock: boolean; timestamp: string }>("/health"),
  overview: () => request<OverviewPayload>("/overview"),
  hosts: () => request<UnifiEnvelope<UnifiHost[]>>("/hosts"),
  sites: () => request<UnifiEnvelope<UnifiSite[]>>("/sites"),
  devices: () => request<UnifiEnvelope<UnifiDeviceGroup[]>>("/devices"),
  ispMetrics: (
    interval: "5m" | "1h",
    params: {
      beginTimestamp?: string;
      endTimestamp?: string;
      duration?: string;
      hostId?: string;
      siteId?: string;
    } = {},
  ) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][],
    ).toString();
    return request<UnifiEnvelope<UnifiIspMetricGroup[]>>(
      `/isp-metrics/${interval}${qs ? `?${qs}` : ""}`,
    );
  },
};

export type UnifiEnvelope<T> = {
  data?: T;
  httpStatusCode?: number;
  traceId?: string;
} & Record<string, unknown>;

export type OverviewPayload = {
  totals: { hosts: number; sites: number; devices: number };
  devices: {
    total: number;
    online: number;
    offline: number;
    updatesAvailable: number;
    byProductLine: Record<string, { total: number; online: number; offline: number }>;
  };
  sites: {
    totalDevices: number;
    offlineDevices: number;
    wifiClients: number;
    wiredClients: number;
    guestClients: number;
    totalClients: number;
    internetIssues: number;
  };
  hosts: { total: number; online: number; offline: number };
  generatedAt: string;
  mock?: boolean;
};

export type UnifiHost = {
  id: string;
  hardwareId?: string;
  reportedState?: {
    name?: string;
    hostname?: string;
    state?: string;
    version?: string;
    mgmt_port?: number;
    ip?: string;
    ipAddrs?: string[];
    hardware?: { name?: string; shortname?: string };
    anonid?: string;
  };
  userData?: { fullName?: string; email?: string };
  ipAddress?: string;
  type?: string;
  registrationTime?: string;
  lastConnectionStateChange?: string;
  latestBackupTime?: string;
};

export type UnifiSite = {
  siteId?: string;
  hostId?: string;
  meta?: {
    name?: string;
    desc?: string;
    timezone?: string;
    gatewayMac?: string;
  };
  statistics?: {
    counts?: {
      totalDevice?: number;
      offlineDevice?: number;
      wifiClient?: number;
      wiredClient?: number;
      guestClient?: number;
    };
    gateways?: Array<{ ispName?: string; ispAsn?: string; status?: string }>;
    ispStatus?: string;
    percentages?: { wanUptime?: number };
  };
  permission?: string;
  isOwner?: boolean;
};

export type UnifiDevice = {
  id?: string;
  name?: string;
  model?: string;
  shortname?: string;
  mac?: string;
  ip?: string;
  status?: string;
  version?: string;
  productLine?: string;
  updateAvailable?: string;
  firmwareStatus?: string;
  uptimeSec?: number;
  adoptionTime?: string;
  startupTime?: string;
};

export type UnifiDeviceGroup = {
  hostId?: string;
  hostName?: string;
  updatedAt?: string;
  devices?: UnifiDevice[];
};

export type UnifiIspMetricGroup = {
  hostId?: string;
  siteId?: string;
  metricType?: string;
  periods?: Array<{
    metricTime?: string;
    version?: string;
    data?: {
      wan?: {
        avgLatency?: number;
        maxLatency?: number;
        packetLoss?: number;
        download_kbps?: number;
        upload_kbps?: number;
        uptime?: number;
        downtime?: number;
        ispName?: string;
        ispAsn?: string;
      };
    };
  }>;
};

export function unwrap<T>(env: UnifiEnvelope<T> | T | undefined | null): T {
  if (env && typeof env === "object" && "data" in (env as Record<string, unknown>)) {
    return (env as UnifiEnvelope<T>).data as T;
  }
  return env as T;
}

// Mock data shaped like the UniFi Site Manager API so the SPA can render
// the full dashboard without a real UNIFI_API_KEY. Returned by the proxy
// whenever UNIFI_API_KEY is unset.

const HOSTS = [
  { id: "host-hq", name: "HQ Dream Machine Pro", model: "UDM-Pro", ip: "10.10.0.1" },
  { id: "host-warehouse", name: "Warehouse UDM-SE", model: "UDM-SE", ip: "10.20.0.1" },
  { id: "host-eastoffice", name: "East Office UCK G2+", model: "UCK-G2-Plus", ip: "10.30.0.1" },
  { id: "host-westoffice", name: "West Office Cloud Gateway", model: "UCG-Ultra", ip: "10.40.0.1" },
];

const SITES = [
  { id: "site-hq", host: "host-hq", name: "Acme HQ", tz: "America/Los_Angeles", isp: "Comcast Business", asn: "7922", state: "ok", devices: 32, offline: 0, wifi: 412, wired: 86, guest: 47 },
  { id: "site-warehouse", host: "host-warehouse", name: "Pacific Distribution Center", tz: "America/Los_Angeles", isp: "AT&T Fiber", asn: "7018", state: "ok", devices: 24, offline: 1, wifi: 88, wired: 31, guest: 9 },
  { id: "site-east", host: "host-eastoffice", name: "Northeast Sales Office", tz: "America/New_York", isp: "Verizon FiOS", asn: "701", state: "ok", devices: 18, offline: 0, wifi: 92, wired: 22, guest: 18 },
  { id: "site-west", host: "host-westoffice", name: "West Coast Studio", tz: "America/Los_Angeles", isp: "Sonic", asn: "46375", state: "warning", devices: 14, offline: 2, wifi: 64, wired: 19, guest: 5 },
  { id: "site-london", host: "host-hq", name: "London Branch", tz: "Europe/London", isp: "BT Business", asn: "2856", state: "ok", devices: 12, offline: 0, wifi: 71, wired: 14, guest: 12 },
  { id: "site-toronto", host: "host-hq", name: "Toronto Field Office", tz: "America/Toronto", isp: "Rogers Business", asn: "812", state: "ok", devices: 9, offline: 0, wifi: 38, wired: 7, guest: 4 },
  { id: "site-austin", host: "host-warehouse", name: "Austin Lab", tz: "America/Chicago", isp: "Spectrum Business", asn: "11427", state: "ok", devices: 16, offline: 1, wifi: 51, wired: 18, guest: 6 },
  { id: "site-singapore", host: "host-eastoffice", name: "Singapore Hub", tz: "Asia/Singapore", isp: "SingTel", asn: "7473", state: "down", devices: 11, offline: 4, wifi: 0, wired: 0, guest: 0 },
  { id: "site-sydney", host: "host-eastoffice", name: "Sydney Co-Work", tz: "Australia/Sydney", isp: "Telstra Business", asn: "1221", state: "ok", devices: 8, offline: 0, wifi: 28, wired: 6, guest: 11 },
  { id: "site-berlin", host: "host-westoffice", name: "Berlin Studio", tz: "Europe/Berlin", isp: "Deutsche Telekom", asn: "3320", state: "ok", devices: 13, offline: 0, wifi: 55, wired: 18, guest: 9 },
  { id: "site-tokyo", host: "host-westoffice", name: "Tokyo Satellite", tz: "Asia/Tokyo", isp: "NTT Communications", asn: "4713", state: "ok", devices: 10, offline: 1, wifi: 41, wired: 9, guest: 7 },
  { id: "site-sf", host: "host-hq", name: "SF Engineering", tz: "America/Los_Angeles", isp: "MonkeyBrains", asn: "32329", state: "ok", devices: 20, offline: 0, wifi: 165, wired: 42, guest: 19 },
];

const MODELS = [
  { model: "USW-Pro-24-PoE", productLine: "switch", version: "7.1.78" },
  { model: "USW-48-PoE", productLine: "switch", version: "7.1.78" },
  { model: "U6-Pro", productLine: "AP", version: "6.6.77" },
  { model: "U6-Enterprise", productLine: "AP", version: "6.6.77" },
  { model: "UAP-AC-Pro", productLine: "AP", version: "6.6.55" },
  { model: "G5-Bullet", productLine: "protect", version: "4.71.12" },
  { model: "G5-Dome", productLine: "protect", version: "4.71.12" },
  { model: "UDM-Pro", productLine: "UDM", version: "4.0.18" },
];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function mockHosts() {
  return {
    data: HOSTS.map((h, i) => ({
      id: h.id,
      hardwareId: `hw-${i}`,
      type: "console",
      ipAddress: h.ip,
      registrationTime: new Date(Date.now() - (180 + i * 7) * 86400_000).toISOString(),
      lastConnectionStateChange: new Date(Date.now() - (i * 1000 * 60 * 13 + 60_000)).toISOString(),
      latestBackupTime: new Date(Date.now() - 86400_000 * (i + 1)).toISOString(),
      userData: { fullName: "Acme MSP", email: "noc@acme-msp.example" },
      reportedState: {
        name: h.name,
        hostname: h.id,
        state: "connected",
        version: "4.0.18",
        ip: h.ip,
        hardware: { name: h.model, shortname: h.model },
      },
    })),
    httpStatusCode: 200,
    traceId: "mock",
  };
}

export function mockSites() {
  return {
    data: SITES.map((s) => ({
      siteId: s.id,
      hostId: s.host,
      isOwner: true,
      permission: "admin",
      meta: { name: s.name, desc: s.name, timezone: s.tz, gatewayMac: "00:00:00:00:00:00" },
      statistics: {
        counts: {
          totalDevice: s.devices,
          offlineDevice: s.offline,
          wifiClient: s.wifi,
          wiredClient: s.wired,
          guestClient: s.guest,
        },
        gateways: [{ ispName: s.isp, ispAsn: s.asn, status: s.state === "down" ? "down" : "ok" }],
        ispStatus: s.state === "down" ? "down" : s.state === "warning" ? "warning" : "ok",
        percentages: { wanUptime: s.state === "down" ? 87.5 : s.state === "warning" ? 99.42 : 99.98 },
      },
    })),
    httpStatusCode: 200,
    traceId: "mock",
  };
}

export function mockDevices() {
  const groups = HOSTS.map((h) => {
    const sitesForHost = SITES.filter((s) => s.host === h.id);
    const total = sitesForHost.reduce((acc, s) => acc + s.devices, 0);
    const offlineTotal = sitesForHost.reduce((acc, s) => acc + s.offline, 0);
    const rand = rng(h.id.length * 31 + total);
    const devices = Array.from({ length: total }, (_, i) => {
      const m = MODELS[Math.floor(rand() * MODELS.length)]!;
      const offline = i < offlineTotal;
      const update = rand() < 0.06;
      return {
        id: `${h.id}-d${i}`,
        name: `${m.productLine.toUpperCase()}-${h.id.slice(-3).toUpperCase()}-${String(i + 1).padStart(2, "0")}`,
        model: m.model,
        shortname: m.model,
        mac: `02:00:${(i % 256).toString(16).padStart(2, "0")}:${(h.id.length % 256).toString(16).padStart(2, "0")}:00:01`,
        ip: `10.${10 + HOSTS.indexOf(h) * 10}.${Math.floor(i / 254)}.${(i % 254) + 1}`,
        status: offline ? "offline" : "online",
        version: m.version,
        productLine: m.productLine,
        updateAvailable: update ? `${m.version.split(".")[0]}.${Number(m.version.split(".")[1] ?? 0) + 1}.0` : undefined,
        firmwareStatus: update ? "upgradable" : "current",
        uptimeSec: offline ? 0 : Math.floor(rand() * 3600 * 24 * 30),
        adoptionTime: new Date(Date.now() - rand() * 86400_000 * 200).toISOString(),
      };
    });
    return { hostId: h.id, hostName: h.name, updatedAt: new Date().toISOString(), devices };
  });
  return { data: groups, httpStatusCode: 200, traceId: "mock" };
}

export function mockIspMetrics(interval: "5m" | "1h", siteId?: string) {
  const target = siteId ? SITES.find((s) => s.id === siteId) : SITES[0];
  if (!target) return { data: [], httpStatusCode: 200, traceId: "mock" };
  const stepMs = interval === "5m" ? 5 * 60_000 : 60 * 60_000;
  const points = interval === "5m" ? 24 * 12 : 24;
  const now = Date.now();
  const rand = rng(target.id.length * 17);
  const periods = Array.from({ length: points }, (_, i) => {
    const t = now - (points - i) * stepMs;
    const baseDown = 850 + Math.sin(i / 6) * 80 + rand() * 60;
    const baseUp = 240 + Math.sin(i / 8 + 1) * 30 + rand() * 20;
    const spike = target.state === "warning" && i > points - 6 ? 80 : target.state === "down" && i > points - 12 ? 280 : 0;
    return {
      metricTime: new Date(t).toISOString(),
      version: "4.0.18",
      data: {
        wan: {
          avgLatency: Math.round(18 + Math.sin(i / 4) * 5 + rand() * 4 + spike),
          maxLatency: Math.round(28 + Math.sin(i / 4) * 8 + rand() * 6 + spike * 1.5),
          packetLoss: Math.max(0, Math.round((target.state === "down" ? 6 + rand() * 4 : target.state === "warning" ? 1.5 + rand() : rand() * 0.4) * 10) / 10),
          download_kbps: Math.round(baseDown * 1000 - spike * 5000),
          upload_kbps: Math.round(baseUp * 1000),
          uptime: target.state === "down" && i > points - 12 ? 70 : 100,
          downtime: target.state === "down" && i > points - 12 ? 30 : 0,
          ispName: target.isp,
          ispAsn: target.asn,
        },
      },
    };
  });
  return {
    data: [
      {
        hostId: target.host,
        siteId: target.id,
        metricType: "wan",
        periods,
      },
    ],
    httpStatusCode: 200,
    traceId: "mock",
  };
}

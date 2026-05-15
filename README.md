# UniFi NOC Dashboard

A modern, wall-display–ready Network Operations Center for monitoring multiple Ubiquiti UniFi sites via the official **UniFi Site Manager API**. Built for MSPs and IT teams who need a single-pane-of-glass view across every client site, all the time.

![stack](https://img.shields.io/badge/stack-React%2018%20%2B%20Vite%206%20%2B%20TypeScript%20%2B%20Tailwind%20%2B%20Express-22c2ff)
![node](https://img.shields.io/badge/node-%E2%89%A520-339933)
![license](https://img.shields.io/badge/license-MIT-lightgray)

---

## Table of contents

1. [Screenshots & features](#screenshots--features)
2. [Architecture](#architecture)
3. [Tech stack](#tech-stack)
4. [Prerequisites](#prerequisites)
5. [Getting a UniFi API key](#getting-a-unifi-api-key)
6. [Quick start](#quick-start)
7. [Configuration](#configuration)
8. [Usage guide](#usage-guide)
9. [Available scripts](#available-scripts)
10. [Proxy API reference](#proxy-api-reference)
11. [Project structure](#project-structure)
12. [Customization](#customization)
13. [Wall-display / kiosk mode](#wall-display--kiosk-mode)
14. [Production deployment](#production-deployment)
15. [Security](#security)
16. [Rate limits & caching](#rate-limits--caching)
17. [Troubleshooting](#troubleshooting)
18. [FAQ](#faq)
19. [Roadmap](#roadmap)
20. [Contributing](#contributing)
21. [License](#license)

---

## Screenshots & features

> Run `npm run dev` to see the dashboard locally. It boots with realistic mock data so you can see the full UI without an API key.

### What's included

| Area              | What it does                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| **Fleet Overview** | Top-line KPIs (sites, devices online/offline, active clients, firmware updates), device-mix bars, active alerts feed, severity-sorted site grid. |
| **Sites**         | Searchable card grid of every site with live ISP/device/client counts. Click into any site for detail.    |
| **Site Detail**   | Per-site KPIs (online %, clients, guests, 24h WAN uptime), WAN throughput area chart, latency & packet-loss dual-axis chart, full device table for the site's host. |
| **Devices**       | Full-fleet device table with search and filter chips (All / Online / Offline / Updates available).        |
| **Hosts**         | Inventory of every UniFi console / controller with model, firmware, IP, owner, last seen, last backup.    |
| **Alerts**        | Bucketed by category (ISP / Device / Firmware) with deep links into the affected site.                    |

### Design choices for a wall display

- **Dark theme** with subtle radial gradients and accent glow on hover; avoids burn-in and looks great in a dim NOC room.
- **`tabular-nums` everywhere** so numbers don't jiggle as they change.
- **Live clock + last-refresh timestamp** in the topbar.
- **Severity-sorted lists** so the worst-off site is always top-left without needing to scroll.
- **Auto-refresh** every 15–30s via TanStack Query (no full-page reloads, no flashing).
- **Pulsing status dots** only on degraded states — calm by default, attention-grabbing only when needed.
- **Responsive grid** that fills the viewport at any resolution from 1080p up to 4K.

---

## Architecture

```
┌────────────────────────┐    ┌──────────────────────────┐    ┌──────────────────────────┐
│  Vite + React SPA      │ ─► │  Express proxy           │ ─► │  api.ui.com              │
│  (web/, port 5173 dev) │    │  (server/, port 4000)    │    │  Site Manager API        │
│  TanStack Query polls  │ ◄─ │  X-API-KEY, TTL cache,   │ ◄─ │  v1 + EA endpoints       │
│  /api/* every 15-30s   │    │  /api/overview aggregate │    │  X-API-KEY auth          │
└────────────────────────┘    └──────────────────────────┘    └──────────────────────────┘
```

**Why a proxy?** The Site Manager API does not allow CORS, and putting your API key in browser code would expose it. The Express proxy keeps the key server-side, caches responses (so 30 dashboard clients ≠ 30× upstream calls), and shapes a small `/api/overview` aggregate so the SPA only makes one round-trip for the top-line numbers.

**Endpoints used (upstream):**

| Endpoint                          | Purpose                                                  |
| --------------------------------- | -------------------------------------------------------- |
| `GET /v1/hosts`                   | UniFi consoles / controllers in your account             |
| `GET /v1/sites`                   | Sites and their statistics                               |
| `GET /v1/devices`                 | Devices grouped by host                                  |
| `GET /ea/isp-metrics/{5m\|1h}`    | ISP / WAN performance (Early Access)                     |

Full upstream docs: <https://developer.ui.com/site-manager-api/>.

---

## Tech stack

**Frontend (`web/`)**

- [React 18](https://react.dev/) + [Vite 6](https://vitejs.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) with custom NOC theme
- [TanStack Query](https://tanstack.com/query) for fetching, caching, auto-refresh
- [React Router](https://reactrouter.com/) for navigation
- [Recharts](https://recharts.org/) for WAN throughput / latency charts
- [lucide-react](https://lucide.dev/) for icons
- [class-variance-authority](https://cva.style/) + [tailwind-merge](https://github.com/dcastil/tailwind-merge) for shadcn-style component variants

**Backend (`server/`)**

- Node.js 20+ with ESM
- [Express](https://expressjs.com/) (with `compression`, `cors`, `morgan`)
- [undici](https://github.com/nodejs/undici) for the upstream HTTP client
- [dotenv](https://github.com/motdotla/dotenv)
- Built-in in-memory TTL cache (no Redis dependency)

**Tooling**

- npm workspaces monorepo
- `tsx` for hot-reload server dev
- `concurrently` to run both dev servers from one terminal
- TypeScript strict mode on both sides

---

## Prerequisites

- **Node.js 20 or newer** (ESM, native fetch, undici).
  ```bash
  node --version   # should print v20.x or later
  ```
- **npm 10+** (ships with Node 20).
- A **UniFi Site Manager API key** for live data. The dashboard runs in mock mode without one (great for trying it out).

---

## Getting a UniFi API key

1. Go to <https://unifi.ui.com> and sign in with your Ubiquiti account.
2. In the left navigation, click **API**.
3. Click **Create API Key**.
4. Give it a name (e.g. `noc-dashboard`).
5. **Copy the key immediately** — it is shown only once.
6. Paste it into `.env` as `UNIFI_API_KEY=...` (see [Configuration](#configuration)).

> The key gives **read-only** access to every host and site visible to your UI account. Treat it like a password. It never leaves the server process.

---

## Quick start

```bash
# 1. Clone or open the project
cd ~/Developer/Projects/unifi-dashboard

# 2. Install dependencies (server + web workspaces)
npm install

# 3. Configure
cp .env.example .env
#    Edit .env and paste your UNIFI_API_KEY

# 4. Run both dev servers (proxy :4000 + Vite :5173)
npm run dev
```

Open <http://localhost:5173> in your browser. Live data should appear within ~10 seconds.

> Without `UNIFI_API_KEY` the proxy starts in **mock mode** with realistic data for 4 hosts, 12 sites, and ~187 devices — including a "down" site and a "warning" site so you can see how the UI handles incidents.

---

## Configuration

All configuration is done via environment variables, loaded from `.env` at the repo root.

| Variable             | Default                | Required? | Description                                                                                          |
| -------------------- | ---------------------- | --------- | ---------------------------------------------------------------------------------------------------- |
| `UNIFI_API_KEY`      | _(none → mock mode)_   | For live data | API key from <https://unifi.ui.com>. Without this the proxy serves mock data.                  |
| `UNIFI_API_BASE`     | `https://api.ui.com`   | No        | Override the upstream base URL (useful for staging or a regional endpoint).                          |
| `PORT`               | `4000`                 | No        | Port the Express proxy listens on. The Vite dev server proxies `/api/*` to this port.                |
| `CACHE_TTL_SECONDS`  | `20`                   | No        | Default TTL for cached upstream responses. ISP metrics use a longer TTL (60s for 5m, 300s for 1h).   |
| `DASHBOARD_TOKEN`    | _(empty)_              | No        | If set, requests to `/api/*` must include header `x-dashboard-token: <value>`. Use to gate the proxy on a LAN. |

### Example `.env`

```bash
# Live mode
UNIFI_API_KEY=ui_a1b2c3d4-...
UNIFI_API_BASE=https://api.ui.com
PORT=4000
CACHE_TTL_SECONDS=30
DASHBOARD_TOKEN=
```

---

## Usage guide

### Navigation

The sidebar has five top-level pages:

- **Overview** (`/`) — fleet KPIs + a severity-sorted site grid.
- **Sites** (`/sites`) — searchable grid of every site.
- **Devices** (`/devices`) — full-fleet device table with filters.
- **Hosts** (`/hosts`) — controller/console inventory.
- **Alerts** (`/alerts`) — bucketed alerts with deep links.

Click any site card on **Overview** or **Sites** to open its detail view at `/sites/:siteId`.

### Reading the Overview page

| Element                | Meaning                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| **SITES** KPI          | Total sites visible to the API key; tone goes warn if any site has internet issues.      |
| **DEVICES ONLINE** KPI | `<online> / <total>` with availability %. Turns warn if any offline, danger if >5%.       |
| **ACTIVE CLIENTS** KPI | Wi-Fi + wired clients across the fleet, with breakdown below.                            |
| **FIRMWARE UPDATES**   | Count of devices reporting an update available.                                          |
| **Sites** grid         | Cards sorted so the worst-off site is always top-left (internet issues first, then most offline devices). |
| **Device mix**         | One bar per product line (UDM / switch / AP / protect) showing online ratio.             |
| **Active alerts**      | Up to ~6 most recent issues; click through to the site.                                   |
| **Quick stats**        | Compact secondary stats (hosts online, guests, offline devices, updates pending).        |

### Reading a Site Detail page

- **Header** shows the site name, timezone, and ISP (with ASN). Status badges show internet health and any offline-device counts.
- **KPIs** for the site: devices online, total clients (Wi-Fi/wired), guest clients, 24h WAN uptime.
- **WAN throughput** — last 24h of 5-minute download/upload samples.
- **WAN latency & packet loss** — dual-axis chart, latency in ms (left) and packet loss in % (right).
- **Devices at this site** — full table of devices on the site's host, sortable by model/IP/status.

### Devices page

- Use the search box to filter by name, IP, MAC, model, or product line.
- Use the chips (All / Online / Offline / Updates) for quick status filters.
- The counter shows `Showing N of M` so you always know what the filter scope is.

### Alerts page

- Three sections: ISP, Devices, Firmware. Each shows a count badge (ok / warn / danger).
- Items with a `View` link are clickable and jump to the affected site.

### Auto-refresh

The UI polls automatically. No manual refresh is needed.

| Hook                | Refetch interval |
| ------------------- | ---------------- |
| `useOverview()`     | 15 s             |
| `useSites()`        | 30 s             |
| `useDevices()`      | 30 s             |
| `useHosts()`        | 30 s             |
| `useIspMetrics(5m)` | 30 s             |
| `useIspMetrics(1h)` | 60 s             |
| `useHealth()`       | 60 s             |

Tune these in `web/src/hooks/useUnifi.ts`.

---

## Available scripts

Run from the repo root.

| Script               | What it does                                                                 |
| -------------------- | ---------------------------------------------------------------------------- |
| `npm run dev`        | Starts the proxy (`:4000`) and Vite dev server (`:5173`) together, hot-reload. |
| `npm run build`      | Builds the server (`tsc → server/dist`) and web (`vite build → web/dist`).    |
| `npm run start`      | Runs the **built** server. Serve `web/dist` separately (see [Production](#production-deployment)). |
| `npm run typecheck`  | Strict TypeScript check across both workspaces.                              |
| `npm run lint`       | Reserved for ESLint (not configured by default).                             |

Workspace-scoped (also work):

```bash
npm run dev -w server      # just the proxy with watch
npm run dev -w web         # just Vite
npm run build -w web       # only build the SPA
```

---

## Proxy API reference

All endpoints are served by `server/src/index.ts`. Requests require `x-dashboard-token` header when `DASHBOARD_TOKEN` is set.

### `GET /api/health`

```json
{
  "status": "ok",
  "mock": false,
  "uptime": 123.4,
  "cacheTtlSeconds": 20,
  "timestamp": "2026-05-15T14:53:53.883Z"
}
```

### `GET /api/overview`

A pre-computed aggregate combining hosts, sites, and devices. This is what the **Overview** page hits every 15 seconds.

```json
{
  "totals": { "hosts": 4, "sites": 12, "devices": 187 },
  "devices": {
    "total": 187,
    "online": 173,
    "offline": 14,
    "updatesAvailable": 9,
    "byProductLine": {
      "switch": { "total": 51, "online": 48, "offline": 3 },
      "AP": { "total": 56, "online": 55, "offline": 1 },
      "UDM": { "total": 26, "online": 24, "offline": 2 },
      "protect": { "total": 54, "online": 51, "offline": 3 }
    }
  },
  "sites": {
    "totalDevices": 187,
    "offlineDevices": 14,
    "wifiClients": 1105,
    "wiredClients": 272,
    "guestClients": 154,
    "totalClients": 1377,
    "internetIssues": 2
  },
  "hosts": { "total": 4, "online": 4, "offline": 0 },
  "generatedAt": "2026-05-15T14:53:53.883Z"
}
```

### `GET /api/hosts`

Passes through `GET /v1/hosts`. Returns the standard UniFi envelope:

```json
{ "data": [ /* UnifiHost[] */ ], "httpStatusCode": 200, "traceId": "..." }
```

### `GET /api/sites`

Passes through `GET /v1/sites`. Each site includes `meta`, `statistics.counts`, `statistics.gateways`, etc.

### `GET /api/devices`

Passes through `GET /v1/devices`. Optional query params: `hostIds`, `time`.

### `GET /api/isp-metrics/:interval`

Passes through `GET /ea/isp-metrics/{5m|1h}`. Optional query params:

| Param            | Description                                       |
| ---------------- | ------------------------------------------------- |
| `beginTimestamp` | ISO timestamp; start of window.                   |
| `endTimestamp`   | ISO timestamp; end of window.                     |
| `duration`       | e.g. `24h` — alternative to begin/end.            |
| `hostId`         | Filter by host.                                   |
| `siteId`         | Filter by site.                                   |

`:interval` must be `5m` (Early Access, finer-grained) or `1h` (stable).

### Errors

| Status | Meaning                                                                 |
| ------ | ----------------------------------------------------------------------- |
| `401`  | `DASHBOARD_TOKEN` is set and the request did not include the right header. |
| `429`  | Forwarded from UniFi: you exceeded rate limits.                         |
| `502`  | Upstream UniFi error; body includes the upstream status/body for debugging. |
| `503`  | `UNIFI_API_KEY` not set and endpoint has no mock fallback.              |

---

## Project structure

```
unifi-dashboard/
├── .env.example                  Example environment file
├── .gitignore
├── README.md                     ← you are here
├── package.json                  npm workspaces + dev/build/typecheck scripts
├── package-lock.json
│
├── server/                       Express proxy (TypeScript, ESM)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              Routes, mock fallback, /api/overview aggregator
│       ├── unifiClient.ts        undici-based client with X-API-KEY + TTL cache
│       ├── cache.ts              In-memory TTL cache
│       └── mock.ts               4 hosts, 12 sites, ~187 devices, generated ISP metrics
│
└── web/                          Vite + React SPA (TypeScript)
    ├── index.html
    ├── package.json
    ├── postcss.config.js
    ├── tailwind.config.js        Custom NOC theme (colors, fonts, shadows, animations)
    ├── tsconfig.json + tsconfig.app.json + tsconfig.node.json
    ├── vite.config.ts            Sets /api → http://localhost:4000 proxy
    ├── public/
    │   └── favicon.svg
    └── src/
        ├── main.tsx              React entry, QueryClient + Router providers
        ├── App.tsx               Route definitions
        ├── index.css             Tailwind layers + global styles
        ├── components/
        │   ├── Layout.tsx        Sidebar + Topbar + Outlet
        │   ├── KpiCard.tsx       Big KPI tile (loading/empty states built in)
        │   ├── SiteCard.tsx      Per-site card used in grids
        │   ├── DeviceTable.tsx   Shared device table
        │   ├── IspMetricsChart.tsx  BandwidthChart + LatencyChart (Recharts)
        │   └── ui/               shadcn-style primitives
        │       ├── Card.tsx
        │       ├── Badge.tsx
        │       ├── StatusDot.tsx
        │       └── Skeleton.tsx
        ├── hooks/
        │   └── useUnifi.ts       TanStack Query hooks (per-endpoint refresh intervals)
        ├── lib/
        │   ├── api.ts            Typed fetch client + UniFi types (UnifiHost, UnifiSite, etc.)
        │   └── utils.ts          cn(), formatNumber, formatMbps, formatMs, relativeTime
        └── pages/
            ├── Overview.tsx
            ├── Sites.tsx
            ├── SiteDetail.tsx
            ├── Devices.tsx
            ├── Hosts.tsx
            └── Alerts.tsx
```

---

## Customization

### Theme colors

Edit `web/tailwind.config.js`. The palette is HSL-based for easy hue/saturation tweaks:

```js
colors: {
  background: "hsl(222 30% 5%)",
  panel:      "hsl(222 28% 8%)",
  "panel-2":  "hsl(222 24% 11%)",
  border:     "hsl(222 18% 18%)",
  muted:      "hsl(222 12% 60%)",
  foreground: "hsl(210 20% 96%)",
  accent: { DEFAULT: "hsl(196 95% 55%)", soft: "hsla(196,95%,55%,0.15)" },
  ok:     { DEFAULT: "hsl(150 70% 50%)", soft: "hsla(150,70%,50%,0.18)" },
  warn:   { DEFAULT: "hsl(38 95% 60%)",  soft: "hsla(38,95%,60%,0.18)" },
  danger: { DEFAULT: "hsl(0 80% 62%)",   soft: "hsla(0,80%,62%,0.18)" },
},
```

Want it brighter for daylight viewing? Bump the `background` lightness from `5%` to `12%` and the `foreground` to `98%`. Want a different accent? Replace the `196 95% 55%` hue.

### Refresh intervals

Edit `web/src/hooks/useUnifi.ts`:

```ts
const REFRESH_FAST = 15_000;   // Overview KPIs
const REFRESH_MEDIUM = 30_000; // Sites/Devices/Hosts
const REFRESH_SLOW = 60_000;   // Health, hourly ISP metrics
```

### Branding

- Logo & title live in `web/src/components/Layout.tsx` (sidebar header).
- Page `<title>` lives in `web/index.html`.
- Favicon at `web/public/favicon.svg` — replace with your own SVG.

### Mock data

`server/src/mock.ts` defines the demo dataset. Edit `HOSTS`, `SITES`, `MODELS` to model your fleet for screenshots, demos, or onboarding training without burning API quota.

### Adding a new page

1. Create `web/src/pages/Foo.tsx`.
2. Add a route in `web/src/App.tsx`.
3. Add a `NavLink` entry in the `items` array in `web/src/components/Layout.tsx`.

### Adding a new upstream endpoint

1. Add a route in `server/src/index.ts` (use the existing `proxy()` helper).
2. Add a typed fetcher in `web/src/lib/api.ts`.
3. Add a TanStack Query hook in `web/src/hooks/useUnifi.ts`.

---

## Wall-display / kiosk mode

For a TV mounted in the office, run the dashboard fullscreen on a small PC, Mac mini, or Raspberry Pi.

### macOS (Mac mini)

```bash
# Disable display sleep
sudo pmset -a displaysleep 0 sleep 0

# Launch Chrome in kiosk mode
open -na "Google Chrome" --args --kiosk --app=http://dashboard.local --noerrdialogs --disable-infobars
```

Add this to a Launch Agent in `~/Library/LaunchAgents/com.local.unifi-noc.plist` to start on login.

### Linux (Raspberry Pi 4 / 5)

```bash
# /etc/xdg/lxsession/LXDE-pi/autostart  (Raspberry Pi OS)
@xset s off
@xset -dpms
@xset s noblank
@chromium-browser --kiosk --noerrdialogs --disable-translate --no-first-run http://dashboard.local
```

For Ubuntu / generic X11 servers, drop the same chromium command into your desktop's autostart.

### Windows

1. Open Edge in InPrivate, point at the dashboard URL.
2. Press **F11** for fullscreen.
3. Optionally use **Edge Kiosk mode** via Settings → Family & other users → Set up a kiosk.

### Tips for a great wall display

- Pick a resolution that fills the TV (typically 1920×1080 or 3840×2160).
- Set the browser zoom to 110–125% on 1080p TVs viewed from across a room — the topbar metrics become legible from any desk.
- Hide the mouse cursor: install `unclutter` (`sudo apt install unclutter` on Linux) or use a CSS rule that hides it when idle.
- Disable screensaver and power-saving on both the OS and the TV's input.

---

## Production deployment

The simplest production topology: one Node process for the proxy, any static host for the SPA, both behind a reverse proxy that terminates TLS.

### 1. Build

```bash
npm run build
# server/dist/index.js   ← Node entry
# web/dist/              ← static files (index.html + assets)
```

### 2. Run the proxy

```bash
# Same directory; .env is read automatically
node server/dist/index.js
```

#### systemd unit (`/etc/systemd/system/unifi-noc.service`)

```ini
[Unit]
Description=UniFi NOC Dashboard proxy
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/unifi-dashboard
EnvironmentFile=/opt/unifi-dashboard/.env
ExecStart=/usr/bin/node server/dist/index.js
Restart=on-failure
RestartSec=5
User=unifi-noc

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now unifi-noc
sudo journalctl -u unifi-noc -f
```

### 3. Serve the SPA

#### nginx

```nginx
server {
    listen 80;
    server_name dashboard.local;

    root /opt/unifi-dashboard/web/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri /index.html;
    }

    # Proxy /api/* to the Node process
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Caddy (`Caddyfile`)

```
dashboard.local {
    root * /opt/unifi-dashboard/web/dist
    try_files {path} /index.html
    file_server
    reverse_proxy /api/* 127.0.0.1:4000
}
```

#### Docker

Create `Dockerfile` at the repo root:

```dockerfile
# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN npm install && npm run build

# ---- runtime ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/web/dist ./web/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
EXPOSE 4000
CMD ["node", "server/dist/index.js"]
```

Build & run:

```bash
docker build -t unifi-noc .
docker run -d --name unifi-noc -p 4000:4000 \
  -e UNIFI_API_KEY=ui_xxx \
  -e DASHBOARD_TOKEN=$(openssl rand -hex 16) \
  unifi-noc
```

Then point your existing nginx/Caddy at `:4000` for `/api/*` and serve `web/dist` separately, **or** add an `express.static` line to the server to bundle them together.

#### docker-compose example

```yaml
services:
  unifi-noc:
    build: .
    restart: unless-stopped
    environment:
      UNIFI_API_KEY: ${UNIFI_API_KEY}
      CACHE_TTL_SECONDS: "30"
    ports:
      - "4000:4000"
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - ./web/dist:/srv
      - caddy_data:/data
volumes:
  caddy_data:
```

---

## Security

- **The API key never reaches the browser.** It only exists in the server process's environment.
- **Use `DASHBOARD_TOKEN`** on any deployment that is reachable beyond `localhost`. Add it to `.env` and configure your kiosk browsers / reverse proxy to inject the `x-dashboard-token` header.
- **TLS** — always serve the dashboard over HTTPS in production. Caddy gets you a free certificate automatically; nginx + certbot is the classic alternative.
- **Keep the proxy on a private network** if you can. There is no reason to expose `:4000` to the public internet — the SPA is enough.
- **Rotate keys periodically** via <https://unifi.ui.com> → API.
- **Server logs** include request paths and statuses via `morgan tiny`. No request bodies or API keys are logged.

---

## Rate limits & caching

The Site Manager API enforces:

| Endpoint surface             | Limit                      |
| ---------------------------- | -------------------------- |
| `v1/*` (hosts, sites, devices) | **10,000 requests / min** |
| `ea/*` (ISP metrics)           | **100 requests / min**    |

The proxy's TTL cache (default 20s, with longer TTL on ISP metrics) absorbs the polling load. With the default refresh intervals, you can serve dozens of dashboard clients from one proxy and stay under both limits comfortably.

If you have **hundreds of sites** or many dashboard instances:

- Increase `CACHE_TTL_SECONDS` to `60` or `120`.
- Bump the `useIspMetrics` interval to `1h` (already the default for slow refresh).
- Run a single proxy and point all dashboards at it (cache is shared).

---

## Troubleshooting

### The Overview KPIs show `—` and never load

- Check the proxy logs: `npm run dev` console, or `journalctl -u unifi-noc` in production.
- `GET /api/overview` returning `502`? Your API key is invalid or the upstream is unreachable. The response body contains the upstream error.
- Returning `503`? `UNIFI_API_KEY` isn't set. Confirm `.env` is in the repo root and the server process restarted after you edited it.

### "Mock data" banner won't go away

The sidebar fleet-status footer reads "Mock data (no API key)" when `UNIFI_API_KEY` is unset. Set the key in `.env` and restart the server.

### CORS errors in the browser console

You shouldn't see any — the SPA always talks to the same origin via `/api/*`. If you do, you may have bypassed the Vite dev proxy (e.g. by setting a fully-qualified API URL in `web/src/lib/api.ts`). The proxy must remain same-origin.

### 401 unauthorized

You set `DASHBOARD_TOKEN` but the browser isn't sending the header. Either remove the token, or set it on every client that talks to `/api/*` (e.g. via reverse-proxy header injection).

### Site Detail shows "Site not found"

The URL slug must match `siteId` exactly. If you bookmarked a site that has since been deleted in UniFi, that URL won't resolve. Click into the site from `/sites` to get the current ID.

### The WAN throughput chart is empty

ISP metrics live in the **EA** (early access) endpoint and require a UniFi OS / controller version that reports them. Older devices may not yield WAN telemetry. Try the `1h` interval (`web/src/pages/SiteDetail.tsx`, change `useIspMetrics("5m", …)` to `"1h"`).

### `EADDRINUSE :::4000`

Another process is already listening on port 4000. Stop it, or change `PORT` in `.env`. If you change the port, also update `vite.config.ts` (`server.proxy["/api"].target`) so the dev proxy still points to the right place.

### Numbers look slightly off

The proxy serves cached data for up to `CACHE_TTL_SECONDS`. Reduce the TTL during testing, or set it to `0` to disable caching entirely (not recommended for production).

---

## FAQ

**Q: Does this use the Network API or the Site Manager API?**
The Site Manager API only (cloud-hosted, multi-site, MSP-friendly). Adding the Network API for per-controller deep dives is on the roadmap.

**Q: Can I self-host without the cloud API?**
Not yet — the Site Manager API is currently the only way to get a single multi-site view across multiple UniFi consoles. If you only manage one controller, you could swap the proxy to talk to a local Network controller, but that's a fork rather than a config change.

**Q: How many sites does it scale to?**
Tested with the mock dataset (12 sites, ~187 devices). The Site Manager API itself is designed for thousands of sites, and the proxy's cache means client count doesn't matter much. For >200 sites, tune `CACHE_TTL_SECONDS` upward and consider paginating the Sites grid.

**Q: Does it work on mobile?**
The layout is responsive down to a small tablet, but mobile is not the primary target. The wall display & desk-monitor experience are the priority.

**Q: Can I add SSO / authentication?**
Use a reverse proxy in front (Caddy + `forward_auth`, nginx + oauth2-proxy, Cloudflare Access, Tailscale Funnel). The dashboard itself is intentionally simple and unauthenticated; `DASHBOARD_TOKEN` is a static shared-secret backup.

**Q: How do I add a per-site map?**
Drop in Leaflet or Mapbox in a new `web/src/components/SiteMap.tsx`, derive lat/long from `site.meta` (you may need to map site names → coordinates yourself; UniFi doesn't return them today).

**Q: Why no WebSockets?**
Simplicity. TanStack Query polling is reliable, debuggable, and well under rate limits. A WebSocket bridge is on the roadmap for sub-second updates.

---

## Roadmap

- [ ] **Kiosk rotation mode** — auto-cycle Overview → Alerts → Site of the Day on a timer.
- [ ] **Map view** with site markers + status pulses (Leaflet / Mapbox).
- [ ] **Sparklines on site cards** — last hour of download/latency at a glance.
- [ ] **Pin / favourite sites** so VIPs stay at the top of the grid.
- [ ] **WebSocket bridge** on the proxy for push-based updates.
- [ ] **UniFi Network API integration** (optional) for live client lists, topology, and per-AP heatmaps.
- [ ] **Slack / webhook notifications** for ISP outages or sustained packet loss.
- [ ] **Per-tenant filtering** for MSPs with role-scoped views.
- [ ] **Historical retention** via Postgres/SQLite so you can scrub past incidents.

---

## Contributing

This is a single-purpose internal tool template — fork it, change it, make it yours. If you build something useful (a new chart, a kiosk feature, a Network API page), PRs welcome.

Local dev loop:

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck  # before committing
npm run build      # sanity-check production build
```

---

## License

MIT.

Add a `LICENSE` file at the repo root with the MIT text if you intend to distribute the code. The UniFi name and logo are trademarks of Ubiquiti Inc. — this project is not affiliated with or endorsed by Ubiquiti.

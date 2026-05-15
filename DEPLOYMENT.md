# Deployment Guide

End-to-end instructions for running the **UniFi NOC Dashboard** on another machine — macOS or Ubuntu Linux. The app has two parts:

| Part               | Path      | Runtime                       | Default Port                                    |
| ------------------ | --------- | ----------------------------- | ----------------------------------------------- |
| Proxy / API server | `server/` | Node.js (Express, TypeScript) | `4000`                                          |
| Web UI             | `web/`    | Static SPA (Vite + React)     | `5173` (dev) / served by any web server in prod |

The server holds the UniFi API keys and proxies all calls to `https://api.ui.com`. The web UI is a static bundle that talks to the server at `/api/*`.

---

## 1. Prerequisites

| Requirement                  | Version              | Notes                                                 |
| ---------------------------- | -------------------- | ----------------------------------------------------- |
| Node.js                      | **20.x or 22.x LTS** | enforced by root `package.json` (`engines.node >=20`) |
| npm                          | 10+                  | ships with Node 20/22                                 |
| Git                          | any                  | for cloning                                           |
| A UniFi Site Manager API key | —                    | one per UI account / fabric you want to surface       |

### Install Node.js

**macOS** (Homebrew):
```bash
brew install node@22
brew link --overwrite --force node@22
node -v   # should be v22.x
```

**Ubuntu 22.04 / 24.04** (NodeSource):
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential
node -v   # should be v22.x
```

> If you prefer `nvm`, run `nvm install 22 && nvm use 22` on either OS.

---

## 2. Get the code

```bash
git clone https://github.com/jmadrone/unifi-dashboard.git
cd unifi-dashboard
```

If you're deploying without git (e.g. copying from another machine), make sure you copy:

- `package.json`, `package-lock.json`
- `server/` and `web/` directories (full contents)
- `logo.png` (if you want the Emerald Security branding)
- **NOT** `node_modules/` — these will be reinstalled

---

## 3. Install dependencies

From the repo root:

```bash
npm install
```

This installs both workspaces (`server` and `web`) thanks to npm workspaces.

---

## 4. Get a UniFi API key

For **each** UI account / fabric you want visible in the dashboard:

1. Sign in to <https://unifi.ui.com> as the account that owns the consoles.
2. Click your profile (top right) → **API**.
3. Click **Create API Key**, give it a name (e.g. *NOC dashboard*), copy the value (shown **once**).
4. If you have consoles split across multiple "fabrics" in Site Manager, generate one key per fabric — each fabric exposes only its own consoles.

> **Important:** Site Manager API keys are scoped to the **fabric of the account that creates them**. Consoles that are merely *shared* with you do not appear via the API. You must generate a key from the account/fabric that primarily owns each console.

---

## 5. Configure environment variables

Create `.env` in the **repo root** (or in `server/`; both are loaded). The server reads:

```bash
# Required: one or more API keys. Use one of the three forms below.
# Any number of UNIFI_API_KEY_<LABEL>= entries is supported; the label appears in /api/health.
UNIFI_API_KEY_JOSH=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
UNIFI_API_KEY_EMSEC=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
UNIFI_API_KEY_EMSEC_FABRIC=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Optional alternatives (any combination works; the server dedupes):
# UNIFI_API_KEY=singlekey
# UNIFI_API_KEYS=key1,key2,key3

# Optional knobs (defaults shown):
# PORT=4000
# UNIFI_API_BASE=https://api.ui.com
# CACHE_TTL_SECONDS=20
# DASHBOARD_TOKEN=                  # if set, web requests must send X-Dashboard-Token
```

Lock down the file:

```bash
chmod 600 .env
```

If `.env` is missing or contains no keys, the server starts in **MOCK mode** and serves fake data — useful for UI development without credentials.

---

## 6. Run in development (both machines)

From the repo root:

```bash
npm run dev
```

This starts:
- `server` on <http://localhost:4000> (tsx watch, hot reload)
- `web` on <http://localhost:5173> (Vite, HMR; proxies `/api/*` to `:4000`)

Open <http://localhost:5173>. Check the server log line — it should read:

```
[unifi-dashboard] mode: LIVE (Site Manager API) — accounts: josh, emsec, emsec_fabric
```

If it says `mode: MOCK`, your `.env` isn't being picked up.

---

## 7. Production deployment

You have two reasonable patterns. **Pattern A** is simpler. **Pattern B** is the typical "real" prod setup.

### Pattern A — single-process (server serves the web bundle)

> Note: the server today does **not** serve static files. This pattern requires adding two lines. Skip to Pattern B if you don't want to touch code.

### Pattern B — server + reverse proxy (recommended)

#### 7.1 Build both packages

```bash
npm run build
```

Output:
- `server/dist/` — compiled JS (entry: `server/dist/index.js`)
- `web/dist/`    — static SPA assets (entry: `web/dist/index.html`)

#### 7.2 Run the server as a long-lived process

**macOS** (launchd) and **Ubuntu** (systemd) both work; pick one.

##### Option 1: systemd (Ubuntu)

Create `/etc/systemd/system/unifi-dashboard.service`:

```ini
[Unit]
Description=UniFi NOC Dashboard proxy
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=unifi
WorkingDirectory=/opt/unifi-dashboard
EnvironmentFile=/opt/unifi-dashboard/.env
ExecStart=/usr/bin/node server/dist/index.js
Restart=on-failure
RestartSec=5
# Hardening (optional but recommended):
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/opt/unifi-dashboard

[Install]
WantedBy=multi-user.target
```

Then:

```bash
sudo useradd --system --home /opt/unifi-dashboard --shell /usr/sbin/nologin unifi
sudo mkdir -p /opt/unifi-dashboard
sudo rsync -a --exclude node_modules ./ /opt/unifi-dashboard/
sudo chown -R unifi:unifi /opt/unifi-dashboard
sudo -u unifi bash -c 'cd /opt/unifi-dashboard && npm ci --omit=dev -w server'
sudo -u unifi bash -c 'cd /opt/unifi-dashboard && npm run build'
sudo chmod 600 /opt/unifi-dashboard/.env
sudo systemctl daemon-reload
sudo systemctl enable --now unifi-dashboard
sudo systemctl status unifi-dashboard
journalctl -u unifi-dashboard -f
```

##### Option 2: launchd (macOS)

Create `~/Library/LaunchAgents/com.emeraldsecurity.unifi-dashboard.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>           <string>com.emeraldsecurity.unifi-dashboard</string>
  <key>WorkingDirectory</key><string>/Users/Shared/unifi-dashboard</string>
  <key>ProgramArguments</key>
  <array>
    <string>/opt/homebrew/bin/node</string>
    <string>server/dist/index.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_ENV</key><string>production</string>
  </dict>
  <key>RunAtLoad</key>       <true/>
  <key>KeepAlive</key>       <true/>
  <key>StandardOutPath</key> <string>/Users/Shared/unifi-dashboard/logs/out.log</string>
  <key>StandardErrorPath</key><string>/Users/Shared/unifi-dashboard/logs/err.log</string>
</dict>
</plist>
```

Note: launchd does not auto-load `.env`. Either inline the env vars in the plist, or wrap the start command in a shell script that `source`s `.env`:

```bash
# /Users/Shared/unifi-dashboard/start.sh
#!/bin/bash
set -a; source /Users/Shared/unifi-dashboard/.env; set +a
exec /opt/homebrew/bin/node /Users/Shared/unifi-dashboard/server/dist/index.js
```

```bash
chmod +x /Users/Shared/unifi-dashboard/start.sh
launchctl load -w ~/Library/LaunchAgents/com.emeraldsecurity.unifi-dashboard.plist
```

#### 7.3 Serve the web bundle + reverse-proxy `/api/*`

Use **nginx** (Ubuntu) or **Caddy** (works on both). Caddy is shorter.

##### Caddy example (`/etc/caddy/Caddyfile`):

```Caddyfile
noc.example.com {
    encode zstd gzip
    root * /opt/unifi-dashboard/web/dist
    file_server

    # SPA fallback: any non-asset GET serves index.html
    @notfile not path /api/*
    handle @notfile {
        try_files {path} /index.html
        file_server
    }

    handle_path /api/* {
        reverse_proxy localhost:4000
    }
}
```

##### nginx example (`/etc/nginx/sites-available/unifi-dashboard`):

```nginx
server {
    listen 80;
    server_name noc.example.com;

    root /opt/unifi-dashboard/web/dist;
    index index.html;
    gzip on;
    gzip_types application/javascript application/json text/css image/svg+xml;

    location /api/ {
        proxy_pass http://127.0.0.1:4000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri /index.html;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/unifi-dashboard /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

For HTTPS, use **Certbot** (`sudo certbot --nginx`) or let Caddy auto-provision.

---

## 8. Firewall

The Node process only needs to listen on `127.0.0.1:4000` (the reverse proxy on the same host talks to it). Optionally bind explicitly by editing `server/src/index.ts`:

```ts
app.listen(PORT, "127.0.0.1", () => { ... })
```

Open only `80/tcp` and `443/tcp` to the world:

```bash
# Ubuntu
sudo ufw allow 80,443/tcp
sudo ufw enable

# macOS — use System Settings → Network → Firewall, or:
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
```

---

## 9. Wall-mounted 4K kiosk mode (optional)

The layout caps at 3840 px wide, designed for a 4K display. On the kiosk machine:

**Ubuntu** with Chromium:
```bash
chromium --kiosk --noerrdialogs --disable-infobars --incognito \
  --check-for-update-interval=31536000 \
  http://noc.example.com/
```

**macOS** with Chrome (set as a Login Item):
```bash
open -na "Google Chrome" --args --kiosk --incognito http://noc.example.com/
```

Disable display sleep:
- Ubuntu: `gsettings set org.gnome.desktop.session idle-delay 0`
- macOS: System Settings → Lock Screen → "Turn display off when inactive: Never"

---

## 10. Upgrades

```bash
cd /opt/unifi-dashboard
sudo -u unifi git pull
sudo -u unifi npm ci
sudo -u unifi npm run build
sudo systemctl restart unifi-dashboard
```

(Adjust paths and user for macOS.)

---

## 11. Troubleshooting

| Symptom                                           | Likely cause                                        | Fix                                                                                                                                |
| ------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Server logs `mode: MOCK`                          | No `.env` keys loaded                               | Confirm `.env` is in repo root or `server/`, contains `UNIFI_API_KEY*=…`, and the process can read it (`chmod 600`, correct owner) |
| `GET /api/sites 502 unifi_api_error`              | Invalid / revoked API key                           | Regenerate at unifi.ui.com → API                                                                                                   |
| Some consoles missing                             | Consoles belong to a different UI account or fabric | Add another `UNIFI_API_KEY_<LABEL>=` from that account/fabric                                                                      |
| Web shows blank page after reload at `/sites/abc` | Reverse proxy missing SPA fallback                  | Ensure `try_files` (nginx) or `try_files {path} /index.html` (Caddy) is in place                                                   |
| `npm install` fails with `EBADENGINE`             | Node < 20                                           | Install Node 22 LTS                                                                                                                |
| `node-gyp` errors on Ubuntu                       | Missing build tools                                 | `sudo apt-get install -y build-essential python3`                                                                                  |
| `EADDRINUSE :4000`                                | Stale server process                                | `sudo lsof -i :4000` then kill, or change `PORT` in `.env`                                                                         |

### Health check

```bash
curl -s http://localhost:4000/api/health | jq .
```

You should see `"mock": false` and an `"accounts"` array listing every configured key label.

---

## 12. Security checklist

- [ ] `.env` mode `600`, owned by the service account
- [ ] Server bound to `127.0.0.1` (not `0.0.0.0`) — reverse proxy is the only public surface
- [ ] HTTPS terminated at the reverse proxy with a valid certificate
- [ ] Optional: set `DASHBOARD_TOKEN=…` in `.env` and send `X-Dashboard-Token: …` from a small auth shim or basic-auth in front of the proxy
- [ ] API keys rotated periodically via unifi.ui.com → API
- [ ] System user (`unifi`) has no shell and no sudo

# Master Feature Catalog — Parity Checklist

The single source of truth for the rework. **Every row must have a home in the new UI.** The "New IA home" column is a proposal (see [../03-ux-design/information-architecture.md](../03-ux-design/information-architecture.md)).

Tiers: 🟢 Basic (default-visible) · 🔵 Advanced (one disclosure away) · 🔴 Expert (clearly badged, out of everyday flow)

---

## A. Devices (nodes)

| # | Feature | Tier | New IA home |
|---|---|---|---|
| A1 | Node list with search | 🟢 | Devices |
| A2 | Card / compact / table views | 🟢 | Devices (view switch) |
| A3 | Columns: power, mfr, product, name, location, security, beaming, ZW+, protocol, FW, status, interview, last active/awake | 🟢/🔵 | Device card + detail |
| A4 | Column show/hide/reorder, per-column filters, group-by, multiselect | 🔵 | Devices (table mode) |
| A5 | Status indicators: power/battery, security, alive/asleep/awake/dead, interview stage | 🟢 | Device card |
| A6 | Re-interview & firmware-update badges | 🔵 | Device card |
| A7 | Node detail: editable name & location | 🟢 | Device detail |
| A8 | Node detail: mfr/product/FW/protocol/node ID, config-DB link | 🟢 | Device detail |
| A9 | Help tab: manual/inclusion/exclusion/reset/wakeup | 🟢 | Device detail › Help |
| A10 | Events log (searchable, live) | 🔵 | Device detail › Activity |
| A11 | Debug Info (raw JSON + copy) | 🔴 | Device detail › Advanced |
| A12 | Home Assistant tab (entities/discovery) | 🔵 | Device detail › Integrations |

## B. Values & control

| # | Feature | Tier | New IA home |
|---|---|---|---|
| B1 | Values grouped by command class | 🔵 | Device detail › Controls/Advanced |
| B2 | Primary control surfaced (switch/dimmer/etc.) | 🟢 | Device card + detail |
| B3 | Editors: text, number(min/max), object, duration, color, select, boolean | 🟢/🔵 | Device detail |
| B4 | Write-only action buttons; Notification Idle | 🔵 | Device detail |
| B5 | Per-value & per-group refresh / polling (battery warning) | 🔵 | Device detail |
| B6 | Default-value chip; "set in progress" feedback | 🟢 | Device detail |
| B7 | Config params (dropdown/numeric/bitmask) | 🔵 | Device detail › Configuration |
| B8 | Reset value / reset-all config | 🔵 | Device detail › Configuration |
| B9 | Custom Configuration (param/size/value/format GET/SET/Reset) | 🔴 | Device detail › Advanced |

## C. Add / remove / replace devices

| # | Feature | Tier | New IA home |
|---|---|---|---|
| C1 | **Smart Start QR scan/import** (camera, image, text) | 🟢 | Add device (hero) |
| C2 | Smart Start provisioning entries table + activate | 🟢 | Add device › Provisioning |
| C3 | Classic inclusion (default/secure modes) | 🟢 | Add device › Manual |
| C4 | Security class selection (S2 AC/Auth/Unauth, S0) | 🔵 | Add device flow |
| C5 | DSK validation + PIN | 🔵 | Add device flow |
| C6 | Exclusion | 🟢 | Add device / device detail |
| C7 | Replace failed node | 🔴 | Device detail › Advanced |
| C8 | Remove failed node / remove all failed | 🔴 | Device detail / Network |
| C9 | Protocol toggle ZW ↔ Long Range | 🔵 | Add device flow |

## D. Associations

| # | Feature | Tier | New IA home |
|---|---|---|---|
| D1 | View association groups (endpoint/group/target) | 🔵 | Device detail › Associations |
| D2 | Add / remove / remove-all associations | 🔵 | Device detail › Associations |
| D3 | Multi-channel target endpoint | 🔵 | Device detail › Associations |
| D4 | Association check + bypass override | 🔴 | Device detail › Associations |

## E. Firmware

| # | Feature | Tier | New IA home |
|---|---|---|---|
| E1 | OTA per-node updates (check/update/downgrade/prerelease/dismiss) | 🔵 | Device detail › Firmware |
| E2 | OTW controller firmware | 🔴 | Network › Controller |
| E3 | Update progress + reminders | 🔵 | Device detail / global toast |

## F. Maintenance & node actions

| # | Feature | Tier | New IA home |
|---|---|---|---|
| F1 | Ping | 🟢 | Device detail |
| F2 | Refresh values / info | 🟢 | Device detail |
| F3 | Re-interview | 🔵 | Device detail › Advanced |
| F4 | Health check | 🔵 | Device detail › Diagnose (+ Network) |
| F5 | Link reliability / statistics | 🔵 | Device detail › Diagnose |
| F6 | Rebuild routes (node) | 🔵 | Device detail › Advanced |
| F7 | Set date & time | 🔵 | Device detail › Advanced |
| F8 | Keep awake / statistics toggle | 🔵 | Device detail |

## G. Controller / network

| # | Feature | Tier | New IA home |
|---|---|---|---|
| G1 | Mesh/network graph (routes, hops, RSSI, legend, filters) | 🔵 | Network › Map |
| G2 | Rebuild routes (whole network) | 🔵 | Network |
| G3 | Background RSSI chart | 🔵 | Network › Health |
| G4 | Controller statistics | 🔵 | Network › Health |
| G5 | Soft reset | 🔵 | Network › Controller |
| G6 | Hard reset | 🔴 | Network › Controller (guarded) |
| G7 | NVM backup / restore | 🔴 | Backup & Restore |
| G8 | Learn mode | 🔴 | Network › Controller |
| G9 | Driver function (arbitrary JS) | 🔴 | Network › Controller (guarded) |
| G10 | Shutdown Z-Wave API | 🔴 | Network › Controller |
| G11 | nodes.json dump / backup-restore | 🔴 | Backup & Restore |

## H. Diagnostics (expert)

| # | Feature | Tier | New IA home |
|---|---|---|---|
| H1 | Zniffer capture (start/stop/clear/save/load, filters, frame detail) | 🔴 | Diagnostics › Zniffer |
| H2 | Live debug logs (stream/filter/popout) | 🔴 | Diagnostics › Logs |

## I. Automation & provisioning

| # | Feature | Tier | New IA home |
|---|---|---|---|
| I1 | Scenes (create/edit/delete/activate, per-value timeout, import/export) | 🔵 | Automation › Scenes |
| I2 | Configuration templates (wizard, apply, auto-apply, import/export) | 🔵 | Automation › Templates |

## J. Integrations & gateway

| # | Feature | Tier | New IA home |
|---|---|---|---|
| J1 | MQTT gateway config (broker, TLS, auth, topics, payload) | 🔵 | Settings › Integrations › MQTT |
| J2 | Gateway value overrides (per-value topic/QoS/poll/JS hooks) | 🔴 | Settings › Integrations › MQTT |
| J3 | Home Assistant WS server + MQTT discovery | 🔵 | Settings › Integrations › Home Assistant |
| J4 | Z-Wave JS WS server | 🔵 | Settings › Integrations |

## K. Settings & system

| # | Feature | Tier | New IA home |
|---|---|---|---|
| K1 | **Guided first-run**: serial port, RF region, security keys | ⭐🟢 | Onboarding wizard |
| K2 | Z-Wave radio/power-level tuning | 🔴 | Settings › Z-Wave › Advanced |
| K3 | Driver/app logging config | 🔵 | Settings › System › Logs |
| K4 | Startup/recovery (soft reset, watchdog, timeouts) | 🔴 | Settings › Z-Wave › Advanced |
| K5 | Scheduled jobs (cron + JS) | 🔴 | Settings › System › Jobs |
| K6 | Store & NVM scheduled backups | 🔵 | Backup & Restore |
| K7 | UI prefs (theme/dark, compact, tabs, browser title, streamer mode) | 🟢 | Settings › Appearance |
| K8 | HTTPS / certificates | 🔵 | Settings › System › Security |
| K9 | Plugins | 🔵 | Settings › System |
| K10 | Statistics / telemetry opt-in | 🟢 | Settings › System |
| K11 | Changelog/version notifications | 🟢 | Settings › System |
| K12 | Zniffer config (port, keys, frequency, logs) | 🔴 | Settings › Diagnostics |

## L. Auth & files

| # | Feature | Tier | New IA home |
|---|---|---|---|
| L1 | Login (user/pass, remember me) | 🟢 | Auth |
| L2 | Password change | 🟢 | Settings › Account |
| L3 | Store file browser/editor | 🔴 | Settings › System › Files |
| L4 | Settings import/export | 🔵 | Settings › System |

---

## Counts
- 🟢 Basic: ~22 · 🔵 Advanced: ~38 · 🔴 Expert: ~22 → **~82 discrete capabilities**.
- Roughly **27% are everyday**, **46% advanced**, **27% expert** — which validates the thesis: *most of the surface area is power-user, so the default view must aggressively hide it while keeping it one tap away.*

## Parity rule
A rework screen is "done" only when each related catalog row is either (a) implemented, or (b) explicitly deferred with a tracked reason. No silent drops.

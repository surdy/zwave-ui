# Information Architecture

## From 12 flat routes → 5 task-based areas

The current app is a flat list of 12 technical routes (Control Panel, Settings, Mesh, Zniffer, Store, Scenes, Debug, Smart Start, Controller Chart, Configuration Templates…). The rework reorganizes these into **5 task-based areas** matching what users are trying to *do*, with depth nested inside.

```
┌──────────────────────────────────────────────────────────────┐
│  Top bar:  ⌂ Home  | search |  [Advanced ▢]  ☾ theme  ⚙ user │
└──────────────────────────────────────────────────────────────┘

PRIMARY NAV (bottom bar on mobile · side rail on desktop)

  🏠 Dashboard      🔌 Devices       ➕ Add          🕸 Network       ⚙ Settings
  (Favorites +      (all nodes,      (Smart Start    (map, controller (onboarding,
   rooms, alerts)    grouped)         QR + classic)   health, backup)  integrations,
                                                                        system)

  ⚡ Automations  ← appears between Network and Settings only when Advanced is on
  (Scenes · Configuration templates)
```

Automations (Scenes, Templates) is an **Advanced-tier** area: it has its own
top-level nav entry, but that entry only appears once the **Advanced** switch is
on, keeping the default nav minimal. Diagnostics (Zniffer, Logs) stays nested
under Network and is likewise revealed by the Advanced switch — neither is
top-level for everyone.

---

## Area 1 — 🏠 Dashboard (Tier 1)
The landing surface. Calm, glanceable.
- **Favorites** lane — user-pinned devices with one-tap controls.
- **Rooms** — each room (Z-Wave `location`) as a section of device cards, or collapsed room tiles showing summary ("Living Room · 4 on").
- **Needs attention** — cards for dead nodes, failed interviews, low battery, firmware available, backup overdue. Each links to the contextual fix.
- Empty state for new users → "Add your first device".

## Area 2 — 🔌 Devices (Tier 1 → 2 → 3 on drill-in)
The reworked Control Panel.
- **Views**: Cards (default, mobile), Compact, **Table** (Advanced — full columns, filters, group-by, multiselect, column config).
- **Group by**: Room (default) · Type · Status. Search always present.
- **Device detail** (tap a device) — tabbed:
  | Tab | Tier | Contents |
  |---|---|---|
  | **Overview** | 1 | Primary controls, key sensors, status, battery, name/location edit, Favorite ☆ |
  | **Controls** | 1/2 | All values by command class, capability-rendered |
  | **Configuration** | 2 | Device params: friendly names, tooltips, typed inputs, default/reset; Custom Config (3) |
  | **Associations** | 2 | Groups, add/remove, multi-channel, bypass (3) |
  | **Firmware** | 2 | OTA check/update/downgrade/prerelease |
  | **Activity** | 2 | Event log, history/insights charts |
  | **Advanced** | 3 | Re-interview, rebuild routes, set time, debug JSON, remove/replace failed, raw command CC |
- Per-device quick actions: Ping, Refresh, Diagnose, Locate on map.

## Area 3 — ➕ Add (Tier 1)
A focused, guided flow (not buried in a dialog).
- **Hero: Scan QR (Smart Start)** — camera / image / paste. Leads to provisioning entry; device joins securely when powered.
- **Classic inclusion** — fallback; choose secure/insecure, S2 classes, DSK/PIN under Advanced.
- **Exclusion / Replace failed** — secondary actions.
- **Provisioning entries** list (Smart Start table) — Advanced.

## Area 4 — 🕸 Network (Tier 2 → 3)
Everything about the mesh & controller, consolidated.
- **Health summary** (Tier 2, mobile-friendly): node-status counts, weak-link list, background-RSSI/controller stats — a readable alternative to the graph.
- **Map** (Tier 2, desktop): the Vis.js mesh graph with route/hop/RSSI legend & filters.
- **Controller** (Tier 3): firmware OTW, soft/hard reset, learn mode, driver function, shutdown — guarded.
- **Diagnostics** (Tier 3): **Zniffer**, **Debug logs** — badged Expert.
- Network-wide actions: Rebuild routes, Remove all failed.

## Area 5 — ⚙ Settings (Tier 1 entry → 2/3 inside)
The 3,104-line monolith, decomposed and searchable.
- **Setup** (Tier 1, also the onboarding wizard): Serial port, RF region, Security keys. The minimal path to a working network.
- **Appearance** (1): theme/dark, compact default, tabs, browser title, streamer mode.
- **Integrations** (2): **MQTT** (broker, TLS, auth, topics, payload, value overrides), **Home Assistant** (WS server, MQTT discovery), Z-Wave JS WS server.
- **Z-Wave Advanced** (3): power-level/radio calibration, startup/recovery (soft reset, watchdog, timeouts), misc tuning.
- **Backup & Restore** (2): NVM + store scheduled backups, manual backup/restore, nodes.json — *one consolidated home* for what's scattered today.
- **System** (2/3): logs, plugins, HTTPS/certs, scheduled jobs, statistics opt-in, version notifications, **Files** (store browser, Expert), settings import/export.
- **Account** (1): password change, logout.
- A **settings search** box (since there are ~80 options) is essential.

---

## Navigation patterns
- **Mobile**: bottom tab bar (Dashboard · Devices · Add · Network · Settings); detail screens push full-screen; back gesture.
- **Desktop**: left side rail (icons + labels) + content; device detail can be a right-side drawer or full page; tables enabled.
- **Global**: top bar with universal **search** (devices, settings, actions), **Advanced** toggle, theme, account.
- **Command palette** (Advanced, ⌘K): jump to any device/setting/action — a power-user accelerator that keeps the default UI clean.

## Mapping: old route → new home
| Old route | New home |
|---|---|
| Control Panel | Dashboard + Devices |
| Settings (monolith) | Settings (Setup/Appearance/Integrations/Z-Wave Advanced/Backup/System/Account) |
| Smart Start | Add › Scan / Provisioning |
| Mesh | Network › Map |
| Controller Chart | Network › Health |
| Zniffer | Network › Diagnostics (Expert) |
| Debug | Network › Diagnostics (Expert) |
| Scenes | Automations › Scenes (Advanced) |
| Configuration Templates | Automations › Configuration templates (Advanced) |
| Store | Settings › System › Files (Expert) |
| Login | Auth |

Every old route is preserved as a destination — just relocated to a task-based, tiered structure.

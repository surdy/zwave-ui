# Hubitat Elevation

**Category:** Prosumer **local** hub with a browser-based admin UI. Closest in spirit to Z-Wave JS UI's audience (local-first, power users, honest about the protocol).

## What the UX does (and the lessons)

### Honest, deep device pages
- Device list is a **sortable/filterable table**: Name, Type, Status, Network (Zigbee/Z-Wave), Room.
- Click a device → **detail page** with:
  - **Command buttons** (On, Off, Dim, Refresh, Configure) rendered directly from the device's capabilities.
  - **Current States** panel (live attribute values).
  - **Preferences** (device config parameters) as labeled inputs.
  - **Device data** (firmware, deviceId, inClusters).
- Lesson: power users *expect* to see and press raw commands. Our "Advanced" mode should expose a similar capability/command surface.

### Z-Wave Details page (the gold standard for network tooling)
- Dedicated page listing every Z-Wave node with **Node ID, security (S2/S0), route, hop count, RSSI/latency, neighbors**.
- Network actions in one place: **Inclusion / Exclusion / Repair / Update Routes**, plus controller firmware & Z-Wave SDK version, mesh health.
- **Ghost-node / failed-node handling** is prominent — a real, common pain point Hubitat surfaces well (Remove, Repair, Refresh per node).
- Lesson: keep a single authoritative "Network / Z-Wave Details" surface for diagnostics, but make it readable (color status, not just numbers).

### UX recommendations Hubitat itself follows (and we should too)
- Persistent **search/filter bar** on device lists.
- **Color/status indicators**: green = connected, yellow = battery low, red = failed.
- **Friendly tooltips** on technical Z-Wave terms (associations, route, hop).
- Helpful error messages and **success confirmations**.
- **Logs tab with per-device filtering** for troubleshooting.

## What to avoid (Hubitat's UX weaknesses)
- The web UI is **dense, dated, and table-heavy** — lots of raw tables, little visual hierarchy.
- **Poor mobile experience** — the admin UI is desktop-oriented; phones get a cramped table.
- Technical jargon is shown **without progressive disclosure** — beginners are overwhelmed.
- Dashboards (the end-user view) and admin UI are separate, inconsistent worlds.

## Relevance to Z-Wave JS UI rework
- Z-Wave JS UI already matches Hubitat's *depth*; the opportunity is to deliver that depth with **modern hierarchy, color, tooltips, and a real mobile layout**.
- Adopt Hubitat's **single Z-Wave Details surface** idea but render it as cards + a readable table that collapses gracefully on mobile.
- Keep raw command/capability buttons, but behind an **Advanced** toggle so beginners see friendly controls first.

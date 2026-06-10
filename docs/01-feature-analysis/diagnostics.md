# Diagnostics & Network Tooling

Sources: `Mesh.vue`, `Zniffer.vue`, `ControllerChart.vue`, `Debug.vue`, and dialogs `DialogHealthCheck`, `DialogHealthCheckInfo`, `DialogLinkReliability`, `DialogLoader`.

> Almost everything here is 🔵 Advanced or 🔴 Expert. In the rework these belong behind a dedicated **"Network / Diagnostics"** area, off the everyday path — but still first-class and discoverable when a device misbehaves.

---

## 1. Mesh / network graph (🔵)
`src/views/Mesh.vue`, `src/components/custom/ZwaveGraph.vue` (Vis.js)

- **Canvas**: zoom, pan, navigation buttons, keyboard, multiselect; drag toggles physics (`ZwaveGraph.vue:787-866`). Click node → details panel; click empty → overview.
- **Node hover popup**: ID, Product, Power, Neighbors (`:170-221`).
- **Node shapes**: controller = star, listening = hexagon, others = square; special `FAILED:` / `DEAD:` labels & colors (`:1195-1240`).
- **Node legend**: Controller, 1–4 hops, Failed Node, Unknown (`:334-415`).
- **Edge legend**: Priority route, Last Working Route (LWR), Next-to-Last Working Route (NLWR), data rates (9.6 / 40 / 100 kbps / LR 100 kbps), Unknown.
- **Routes/links**: built from route stats; LWR = thick solid, NLWR = dashed thin, Application = thick + star arrow, return routes (PRIORITY/CUSTOM) dashed/arrowed; `Failed ❌` dashed when broken; edge labels show RSSI; color = data rate (`:1013-1180`).
- **Controls**: Locations filter, Nodes filter, **Show return routes**, **Show priority routes**; selecting a node hides unrelated nodes but keeps repeaters (`:3-132`).
- **Route fetching**: priority route, custom + priority SUC return routes per node; auto-adds routes for new nodes (`Mesh.vue:185-193`).

---

## 2. Zniffer — Z-Wave traffic sniffer (🔴)
`src/views/Zniffer.vue` (1,192 lines), `FrameDetails.vue`, `CCTreeView`

- **Capture controls**: Start / Stop / Clear / Load capture from file / Save capture (`.zlf`) (`:419-463, 1042-1158`).
- **Config**: Zniffer frequency, LR channel configuration (`:301-362`).
- **Frame table** columns: `#`, Timestamp, Delta [ms], Protocol Data Rate, RSSI, Ch, Home Id, Type, Route, Payload (`:618-679`).
- **Search/filter**: JS expression over `frame, homeId, ch, src, dest, protocolDataRate, hop, dir, repeaters` (e.g. `frame.corrupted`, `src===1 && dest===2`) (`:36-115`).
- **Frame details**: Type, Protocol, Channel, Region, RSSI, Data Rate, Sequence #, Payload, Home ID, Route, Ack Requested, Routed Ack, Routed Error; decoded payload tree + raw hex (`FrameDetails.vue:1-98`).
- **Row coloring**: selected / corrupted / routed-ACK / frame type (singlecast, multicast, explorer, beam, broadcast, LR variants) (`:825-898`).
- **Performance**: virtual scroll (only visible slice), auto-scroll toggle; states `initial/recording/stopped/loaded` (`:465-494`).

---

## 3. Controller chart — Background RSSI (🔵)
`ControllerChart.vue` → `BgRssiChart.vue`

- Plot "Background RSSI" with **Channel 0–3** series, each current + average; values in dBm; RSSI errors render as gaps (`BgRssiChart.vue:167-209, 340-406`).
- Pinch-zoom, responsive resize, tooltip `x.xx dBm` / `---`.

---

## 4. Debug logs (🔴)
`src/views/Debug.vue`

- Live ANSI-colored log stream (buffer 500 lines) over the `debug` socket channel (`:176-206`).
- Controls: Start / Stop / Clear / Open (pop-out) / Scroll (re-enable auto-scroll) (`:81-128`).
- Case-sensitive substring filter (`:22-33`); monospace window via ANSI→HTML.

---

## 5. Health Check (🔵)
`DialogHealthCheck.vue`, `DialogHealthCheckInfo.vue`

- Title `Node X - Health check`; inputs **Target Node**, **Rounds**; buttons Check/Stop, Info, Close (`:1-57`).
- **Lifeline mode** summary: No. Neighbors + overall Rating; table: Max latency, Failed pings, Route Changes, SNR margin, Min power level w/o errors, Rating (progress bar).
- **Route mode** table: Failed pings, Min power level, Rating.
- Per-row metrics: Latency [ms], Round-Trip Time [ms], ACK RSSI [dBm], Response RSSI [dBm], Failed Pings (node/controller), Min Power Level.
- **Color thresholds** (`:371-429`): neighbors >2 good / 0 bad; latency ≤100 good, ≤500 warn; SNR ≥17 good; failed pings 0 good, 1 warn; rating ≥6 good, ≥4 warn.
- Info dialog explains every metric + a 0–10 rating scale (`DialogHealthCheckInfo.vue:16-100`).

---

## 6. Link reliability (🔵)
`DialogLinkReliability.vue`

- Title `Node X - Link Statistics`; controls: Mode, Infinite vs Iterations, Interval, Run, Stop (`:1-227`).
- Live stats: Commands Sent, Failed Commands, Missing Responses; table Latency / RTT / ACK RSSI / Response RSSI; progress bar. Uses `checkLinkReliability` / `abortLinkReliabilityCheck`.

---

## Rework implications
- These are **troubleshooting tools**, surfaced when something is wrong. Tie them to **contextual entry points**: a node showing "Dead" should offer **Health Check / Link Stats / Rebuild Routes / Locate on graph** right there, instead of forcing users to know which separate page to visit.
- The mesh graph is genuinely useful but Vis.js-heavy and not mobile-friendly — the rework should provide a **simplified, readable network health summary** for phones and keep the full graph for desktop.
- Zniffer/Debug are expert tools — keep them, but clearly badge them as expert and out of the everyday flow.

# Feature Analysis — Existing Z-Wave JS UI

This section is the **feature-parity source of truth**. The rework must preserve every capability cataloged here; it may *reorganize, rename, progressively disclose, or visually redesign* them, but nothing should be lost.

## How the existing app is organized

Z-Wave JS UI is a **Vue 2 + Vuetify** SPA talking to a NodeJS/Express + socket.io backend that wraps `zwave-js`. Navigation is a flat set of 12 routes:

| Route | View file | Purpose | Audience |
|---|---|---|---|
| `/` | `Login.vue` | Authentication | All |
| `/control-panel` | `ControlPanel.vue` (+ `nodes-table/`) | **Main** — node list & management | All |
| `/settings` | `Settings.vue` (3,104 lines) | All configuration | Installer |
| `/scenes` | `Scenes.vue` | Value snapshots / scenes | Power |
| `/smart-start` | `SmartStart.vue` | QR/DSK provisioning | All |
| `/mesh` | `Mesh.vue` | Network graph | Power |
| `/zniffer` | `Zniffer.vue` (1,192 lines) | Z-Wave traffic sniffer | Expert |
| `/controller-chart` | `ControllerChart.vue` | Background RSSI chart | Expert |
| `/configuration-templates` | `ConfigurationTemplates.vue` | Reusable config profiles | Power |
| `/debug` | `Debug.vue` | Live driver logs | Expert |
| `/store` | `Store.vue` | Persistent file browser/editor | Expert |
| `/error` | `ErrorPage.vue` | Error fallback | — |

Plus **53 components** and **12 dialogs** (DialogNodesManager, DialogAssociation, DialogFirmwareUpdate, DialogHealthCheck, DialogLinkReliability, DialogApplyTemplate, DialogGatewayValue, DialogSceneValue, DialogAdvanced, DialogLoader, Password, DialogHealthCheckInfo).

## Detailed catalogs

1. [Control Panel & Node Management](./control-panel-nodes.md) — the heart of the app: node table, inclusion/exclusion, node detail, values & command classes, config params, associations, firmware, maintenance, controller actions.
2. [Settings & Authentication](./settings-auth.md) — every configuration option across Z-Wave, MQTT, Gateway, Home Assistant, Backup, Zniffer, UI, and auth/login.
3. [Diagnostics & Network Tooling](./diagnostics.md) — mesh graph, Zniffer, controller chart, debug logs, health check, link reliability.
4. [Automation, Provisioning & Store](./automation-provisioning-store.md) — scenes, Smart Start, configuration templates, store/file manager.

## The complete catalog

→ **[feature-catalog.md](./feature-catalog.md)** — a single consolidated checklist of every feature with a **Basic / Advanced** classification and a target home in the new IA. This is what the rework is measured against.

## Key insight: a basic/advanced split already exists implicitly

The codebase already separates everyday actions from power-user ones — but inconsistently and without a unifying model:
- An **"Advanced" menu** hangs off each node (`ExpandedNode.vue:478-649`).
- An **"Advanced actions" dialog** hangs off the controller (`ControlPanel.vue:182-341`).
- A **"Compact view"** toggle exists (`SmartView.vue`).
- Many settings are clearly onboarding-critical (serial port, RF region, keys) vs. rarely touched (power levels, timeouts, watchdog).

The rework's core opportunity is to make this **simple-by-default / powerful-when-needed** split *explicit, consistent, and central* to the experience.

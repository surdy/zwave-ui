# Settings & Authentication

Source: `src/views/Settings.vue` (3,104 lines — the largest view), `Login.vue`, `Password.vue`.

> Tier legend: 🟢 Basic · 🔵 Advanced · 🔴 Expert · ⭐ **Onboarding-critical**

Settings is a single long page of collapsible panels. This is the **biggest UX liability** in the current app: critical first-run settings (serial port, RF region, keys) are buried in the same flat wall as obscure tuning (watchdog, power-level calibration). The rework should split a short **guided onboarding** from a deep **advanced settings** area.

---

## UI / appearance
| Setting | Type | Tier | Cite |
|---|---|---|---|
| Use tabs for navigation | switch | 🟢 | `:39-44` |
| Show labels on all tabs | switch | 🟢 | `:47-53` |
| Streamer mode (hide sensitive info) | switch | 🔵 | `:56-61` |
| Compact view by default | switch | 🟢 | `:64-69` |
| Browser title | text | 🟢 | `:71-77` |

## General / app
Auth toggle (default `admin`/`zwave`) ⭐🟢 `:105-110` · HTTPS 🔵 `:112-123` · Plugins 🔵 `:125-138` · Log enabled/level/to-file 🔵 `:140-171` · Disable changelogs 🟢 `:174-182` · Notify new versions 🟢 `:184-192`.

---

## Z-Wave (the core)
| Setting | Type | Tier | Cite |
|---|---|---|---|
| Enabled | checkbox | 🟢 | `:510-521` |
| **Serial Port** | combobox | ⭐🟢 | `:543-567` |
| **RF Region** | select | ⭐🟢 | `:858-867` |
| **Security Keys** S2 Unauth / S2 Auth / S2 Access Control / S0 Legacy (+ random generate, 32-hex validation) | text | ⭐🔵 | `:588-745` |
| Security Keys (Long Range): S2 Auth / S2 Access Control | text | 🔵 | `:746-835` |
| Config priority directory | text | 🔵 | `:569-585` |
| **Radio**: Auto power level, Normal power level, Measured output @0dBm, Max LR power level | switch/number/select | 🔴 | `:869-944` |
| **Driver logs**: enable, level, to-file, max files, log nodes | mixed | 🔵 | `:972-1051` |
| **Startup/recovery**: Soft Reset, Bootloader only, Controller recovery, Watchdog, Response timeout (10000ms), Increase node report timeout | mixed | 🔴 | `:1075-1138` |
| **Misc**: Disable optimistic updates, Enable statistics, Disable auto FW checks, Preferred scales, Inclusion/exclusion timeout, Send-to-sleep timeout, Node events queue size | mixed | 🔵/🔴 | `:1153-1262` |

---

## MQTT gateway
- **Enable** MQTT Gateway 🟢 `:1673-1679`.
- **MQTT**: Name⭐, Host url⭐, Port⭐, Reconnect period, Prefix⭐, QoS (0/1/2)⭐, Retain, Clean, Store, Allow self-signed, Key/Cert/CA .pem uploads (TLS), Auth + Username/Password 🔵 `:1710-1873`.
- **Gateway**: Topic type (ValueID / Named / Manual), Payload type, Use node names, Ignore location, Send Z-Wave events, Ignore status updates, Include node info, Publish node details 🔵 `:1904-1973`.
- **Gateway value table** ("Devices values configuration"): per-value Device / Value / Topic / Post Operation / Poll / interval overrides 🔴 `:195-273` (editor = `DialogGatewayValue`).

---

## Home Assistant
WS Server toggle + Server Port (3000) + Host + DNS Discovery 🔵 `:2012-2074` · MQTT Discovery + Discovery prefix + Retained discovery + Use node location as area + Manual discovery + Entity name template (`%ln_%o`) 🔵 `:2079-2166`.

## Backup
- **Store backup**: enable, cron (`0 0 * * *`), max files 🔵 `:387-431`.
- **Controller (NVM) backup**: backup-on-event, enable, cron, max files; 700-series soft-reset warning 🔵 `:442-497`.

## Scheduled jobs
New job: Name, Enabled, Run-on-init, Cron, Snippets, Code (JS) 🔴 `:2780-2849`.

## Zniffer config
Enabled, Serial Port (required), Security keys (+ **Copy from Driver**), LR keys, Convert RSSI, Default frequency, log enable/level/to-file/max-files/log-nodes 🔵/🔴 `:1284-1664`.

## Save / lifecycle
Reset · Import · Export · Save buttons `:2193-2231` · unsaved-changes guard on route leave `:3067-3082` · restart-required confirm after save `:2937-2977`.

---

## Authentication
### Login (`Login.vue`)
Username (req), Password (req, visibility toggle), Remember Me, color-scheme picker, Login button, error alert `:28-76`. Auto-login from `localStorage` if remembered `:135-205`.

### Password change (`Password.vue`)
Dialog "Password Change": Current / New / Confirm (match-validated) password fields; Close / Save `:9-83`.

---

## Onboarding-critical minimum (⭐)
To get a working network a user only needs: **Serial Port → RF Region → Security Keys** (the ones they intend to use). If integrating: MQTT Name/Host/Port/Prefix/QoS or HA WS Server + Port. Everything else has sane defaults. **This ~5-field minimum should become a guided setup wizard** in the rework, with the remaining ~80 settings tucked into a searchable advanced area.

# Control Panel & Node Management

The Control Panel (`/control-panel`) is the primary surface of Z-Wave JS UI. Source: `src/views/ControlPanel.vue`, `src/components/nodes-table/`, and node dialogs.

> Legend: 🟢 **Basic** (everyday) · 🔵 **Advanced** (power user) · 🔴 **Expert** (rare / risky)

---

## 1. Node list / table
`src/components/nodes-table/index.vue`, `nodes-table.js`

### Table controls
| Feature | Type | Tier | Cite |
|---|---|---|---|
| Search nodes | Text field | 🟢 | `index.vue:27-36` |
| Show/hide & reorder columns | Menu + drag | 🔵 | `index.vue:37-93` |
| Filter to selected only | Toggle | 🔵 | `index.vue:94-103` |
| Reset table settings | Button | 🔵 | `index.vue:104-112` |
| Multi-select, expand-on-click, group-by, sort | Table behaviors | 🟢/🔵 | `index.vue:2-20` |
| Per-column header filter popup | Popover | 🔵 | `index.vue:119-139`, `ColumnFilter.vue` |
| **SmartView** compact card view (search/sort by ID/Name/Location/Status/Ready) | Card grid | 🟢 | `SmartView.vue:14-70` |

### Columns (`nodes-table.js:78-243`)
ID, Power/battery, Manufacturer, Product, Product code, Name, Location, Security (S0/S2/insecure), Beaming, Z-Wave+ version, Protocol (ZW / Long Range), Firmware, Status (Asleep/Awake/Dead/Alive), Rebuild-routes progress, Interview stage, Last Active, Last Awake.

### Status indicators
- **Power**: mains plug / battery % bands / unknown (`nodes-table.js:305-346`).
- **Security**: secure / insecure / unknown; S0 legacy flagged with warning color (`98-122`).
- **Status**: Asleep / Awake / Dead / Alive with icons (`197-227`).
- **Interview**: None → ProtocolInfo → NodeInfo → CommandClasses → OverwriteConfig → Complete (`294-304`).
- ID-cell badges: `ReinterviewBadge` (config changed → re-interview), `FirmwareUpdateBadge`.

---

## 2. Inclusion / Exclusion / Replace
`src/components/dialogs/DialogNodesManager.vue`

| Step / Option | Tier | Cite |
|---|---|---|
| Action: **Inclusion / Replace / Exclusion** | 🟢 | `:747-754` |
| Name & Location pre-fill | 🟢 | `:755-761` |
| Inclusion Mode (default / secure / Smart Start) | 🟢/🔵 | `:763-776` |
| Security classes: S2 Access Control / S2 Authenticated / S2 Unauthenticated / S0 Legacy / clientAuth | 🔵 | `:778-788` |
| **DSK validation** + 5-digit PIN | 🔵 | `:789-796, 982-984` |
| **Smart Start** QR scan/import → provisions entry | 🟢 | `:1177-1205` |
| Replace failed node (`replaceFailedNode`) | 🔴 | `:1049-1054` |
| Force security / DSK on classic inclusion | 🔵 | `:1227-1234` |
| Live countdown, auto-detect running inclusion, error strings (wrong PIN, missing keys, timeout) | — | `:870-906, 1365-1387` |

---

## 3. Node detail / expanded view
`src/components/nodes-table/ExpandedNode.vue`

- **Header**: device hex ID + config-DB link, manufacturer/product; quick actions **Statistics**, **Ping**, **Advanced** (`:9-66`).
- **Tabs** (`:98-167`): Node · Help · Home Assistant · Groups · Users · OTA Updates · Firmware Updates (controller) · Events · Debug Info.
  - **Node**: `NodeDetails` (editable name/location, product, firmware, protocol, node ID).
  - **Help**: manual / inclusion / exclusion / reset / wakeup instructions from device DB.
  - **Events**: searchable live event log, auto-scroll, inverse sort (`:262-333`).
  - **Debug Info**: raw JSON + copy (`:335-353`).

---

## 4. Values & command classes
`src/components/ValueId.vue`, `ExpandedNode.vue:321-479`

- Values grouped by **command class**, each group with **Refresh** and (for Configuration CC) **Reset**.
- **Editors by type**: text/buffer, number (min/max/allowed), object/any (manual payload), duration (value+unit), color picker, select/combobox, boolean on/off button group, write-only → single action button (`ValueId.vue:76-367`).
- Read-only values show parsed value + unit; Notification CC gets an **Idle** button.
- **Polling**: per-value refresh; `PollValueButton`; warns about battery impact (`ValueId.vue:139-155`).
- **Default-value chip** when current == default; "Set value in progress…" spinner; warns when waking sleeping device.
- **Custom Configuration** block (Configuration CC): manually address any parameter, set Size (1–4), Value, Format (Signed/Unsigned), with GET / SET / Reset (`ExpandedNode.vue:393-470`). 🔴

---

## 5. Configuration parameters
- Standard config params editable as normal values (dropdown / numeric / bitmask).
- **Reset all config** for the group; per-value Reset when CC=112 v>3 (`ValueId.vue:500-508`).
- **Configuration Templates** (separate view) apply curated param sets — see [automation doc](./automation-provisioning-store.md).

---

## 6. Associations / groups
`src/components/nodes-table/AssociationGroups.vue`, `DialogAssociation.vue`

- Table: Endpoint / Group / Node / Target Endpoint / Actions; buttons **Add**, **Remove All**, **Refresh** (`AssociationGroups.vue:17-46`).
- Add dialog: Node Endpoint → Group (endpoint-aware) → shows Max/Actual associations → Target Node → Target Endpoint (multi-channel) (`DialogAssociation.vue:13-90`).
- Validation via `checkAssociation` with **"I know what I'm doing — bypass this check"** override (`:92-109, 262-333`). 🔵
- Long Range: only lifeline associations supported (warning).

---

## 7. Firmware updates
`DialogFirmwareUpdate.vue`, `FirmwareUpdates.vue`, `OTAUpdates.vue`, `OTWUpdates.vue`

- Node = **OTA**, controller = **OTW** (`ExpandedNode.vue:140-153`).
- Update list: **Check updates**, **Include pre-releases**, **Show downgrades**, RF-region hint; each card shows version/channel, changelog, files, download links, **Update/Downgrade** + **Dismiss** (`FirmwareUpdates.vue:4-166`). 🔵
- Running: progress spinner, sent/total fragments + %, "wake sleeping devices" reminder; OTA confirm warns about wrong firmware.

---

## 8. Per-node maintenance
Node **Advanced** menu (`ExpandedNode.vue:478-649`) + node panel buttons (`NodePanel.vue:287-384`):

| Action | Tier |
|---|---|
| Ping | 🟢 |
| Refresh Values / Refresh Info | 🟢 |
| Re-interview Node | 🔵 |
| Diagnose / Health Check | 🔵 |
| Link Statistics / Link Reliability | 🔵 |
| Rebuild Routes (not LR) | 🔵 |
| Failed Nodes: Remove / Replace | 🔴 |
| Associations: Clear / Remove from all | 🔵 |
| Set Date & Time (if supported) | 🔵 |
| Firmware update: Begin / Abort | 🔵 |

---

## 9. Controller-level actions
`ControlPanel.vue:182-341` (Advanced actions dialog):

Backup/restore `nodes.json` · Dump all nodes JSON · Re-interview all (broadcast) · Rebuild Routes begin/stop · **Hard Reset** 🔴 · **Soft Reset** · Remove all failed nodes · **Driver function** (run arbitrary JS) 🔴 · **NVM backup/restore** 🔴 · OTW firmware update · Shutdown Z-Wave API · **Learn mode** start/stop.

Top-of-panel: controller statistics toggle, compact-mode switch (`ControlPanel.vue:4-45`).

---

## 10. Gateway value mapping (per-value MQTT/HA)
`DialogGatewayValue.vue:13-223` — device, value, device class, icon, topic, QoS, retain, post-operation, polling, config discovery, and **parse send/receive JS hooks**. 🔴

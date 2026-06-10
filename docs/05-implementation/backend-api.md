# Backend API cheat-sheet

The new frontend talks to the **unchanged** zwave-js-ui backend. This is the
authoritative contract, extracted from the backend source
(`api/lib/SocketEvents.ts`, `api/lib/ZwaveClient.ts`, `api/app.ts`). Treat it as
the single source of truth for the API layer (`frontend/src/api/`).

Default backend port: **8091** (dev) / **8092** (the upstream prod default).
Socket.io path: **`/socket.io`**.

## 1. Authentication (REST)

Auth may or may not be enabled.

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/auth-enabled` | `{ success, enabled }` — is login required? |
| `POST` | `/api/authenticate` | body `{ username, password }` → `{ success, token }` (JWT) |
| `GET` | `/api/logout` | invalidate session |

When auth is enabled, pass the JWT to socket.io on connect:

```ts
const socket = io(BASE_URL, {
  path: '/socket.io',
  auth: { token },          // JWT from /api/authenticate
})
```

## 2. Socket.io — client → server (inbound events)

| Event | Payload | Purpose |
|-------|---------|---------|
| `INITED` | `(true, cb)` | get full initial snapshot; `cb(state)` where `state.nodes` is a map |
| `ZWAVE_API` | `({ api, args }, cb)` | call a Z-Wave API method (see §4); `cb({ success, message, result, args, origin })` |
| `HASS_API` | `({ apiName, ... }, cb)` | Home Assistant gateway actions |
| `MQTT_API` | `(...)` | MQTT actions |
| `ZNIFFER_API` | `({ api, args }, cb)` | Zniffer actions |
| `SUBSCRIBE` | `({ channels: [...] })` | join realtime channels (additive; `'all'` = everything) |
| `UNSUBSCRIBE` | `({ channels: [...] })` | leave channels |

Example API call:

```ts
socket.emit('ZWAVE_API', { api: 'setNodeName', args: [2, 'Kitchen Light'] },
  (res) => { /* res = { success, message, result } */ })
```

## 3. Socket.io — server → client (outbound events) and channels

Subscribe to only the channels a screen needs. Channel → events:

| Channel | Events |
|---------|--------|
| `controller` | `CONTROLLER_CMD`, `CONNECTED`, `INFO` |
| `nodes` | `NODE_FOUND`, `NODE_ADDED`, `NODE_REMOVED`, `NODE_UPDATED`, `NODE_EVENT`, `GRANT_SECURITY_CLASSES`, `VALIDATE_DSK`, `INCLUSION_ABORTED` |
| `values` | `VALUE_UPDATED`, `VALUE_REMOVED`, `METADATA_UPDATED` |
| `statistics` | `STATISTICS` |
| `firmware` | `OTW_FIRMWARE_UPDATE` |
| `debug` | `DEBUG` |
| `znifferFrames` | `ZNIFFER_FRAME` |
| `znifferState` | `ZNIFFER_STATE` |
| `rebuild` | `REBUILD_ROUTES_PROGRESS` |
| `diagnostics` | `HEALTH_CHECK_PROGRESS`, `LINK_RELIABILITY` |

Always-on (not channel-gated): `INIT` (on connect), `API_RETURN` (`API_RETURN`
is also delivered for fire-and-forget API calls).

Typical store wiring:
- `NODE_ADDED` / `NODE_UPDATED` / `NODE_REMOVED` → upsert/remove node in the nodes store.
- `VALUE_UPDATED` / `VALUE_REMOVED` / `METADATA_UPDATED` → update a node's `values`/`valueId` map (this is how live device state arrives).
- `CONTROLLER_CMD` → inclusion/exclusion progress + controller status.
- `GRANT_SECURITY_CLASSES` / `VALIDATE_DSK` → secure inclusion (S2) interactive flow.

## 4. `ZWAVE_API` methods (allow-list)

The backend only permits these method names (from `allowedApis` in
`ZwaveClient.ts`). Grouped by purpose:

**Node identity & values**
`setNodeName`, `setNodeLocation`, `setNodeDefaultSetValueOptions`,
`refreshValues`, `refreshCCValues`, `pollValue`, `writeValue`, `sendCommand`,
`writeBroadcast`, `writeMulticast`, `getNodes`, `getInfo`, `dumpNode`,
`manuallyIdleNotificationValue`, `syncNodeDateAndTime`, `getDeviceConfigurationParams`

**Inclusion / exclusion / provisioning**
`startInclusion`, `stopInclusion`, `startExclusion`, `stopExclusion`,
`replaceFailedNode`, `abortInclusion`, `grantSecurityClasses`, `validateDSK`,
`startLearnMode`, `stopLearnMode`, `parseQRCodeString`,
`provisionSmartStartNode`, `unprovisionSmartStartNode`,
`getProvisioningEntries`, `getProvisioningEntry`

**Associations**
`getAssociations`, `checkAssociation`, `addAssociations`, `removeAssociations`,
`removeAllAssociations`, `removeNodeFromAllAssociations`

**Network health, routes, neighbors**
`refreshNeighbors`, `getNodeNeighbors`, `discoverNodeNeighbors`,
`rebuildNodeRoutes`, `beginRebuildingRoutes`, `stopRebuildingRoutes`,
`getPriorityRoute`/`setPriorityRoute`/`removePriorityRoute`,
`assignReturnRoutes`, `deleteReturnRoutes`, `deleteSUCReturnRoutes`,
`assign*ReturnRoute(s)`, `get*ReturnRoute`, `checkLifelineHealth`,
`checkRouteHealth`, `abortHealthCheck`, `checkLinkReliability`,
`abortLinkReliabilityCheck`

**Failed/health node ops**
`isFailedNode`, `removeFailedNode`, `pingNode`, `refreshInfo`

**Firmware**
`updateFirmware`, `firmwareUpdateOTA`, `firmwareUpdateOTW`,
`abortFirmwareUpdate`, `getAvailableFirmwareUpdates`,
`getAllAvailableFirmwareUpdates`, `checkAllNodesFirmwareUpdates`,
`getNodeFirmwareUpdates`, `dismissFirmwareUpdate`

**Controller / driver**
`hardReset`, `softReset`, `restart`, `shutdownZwaveAPI`, `setPowerlevel`,
`setRFRegion`, `setMaxLRPowerLevel`, `updateControllerNodeProps`,
`backupNVMRaw`, `restoreNVM`, `driverFunction`, `checkForConfigUpdates`,
`installConfigUpdate`

**Scenes** (UI-managed)
`_getScenes`, `_createScene`, `_removeScene`, `_setScenes`, `_sceneGetValues`,
`_addSceneValue`, `_removeSceneValue`, `_activateScene`

**Configuration templates**
`getConfigurationTemplates`, `createConfigurationTemplate`,
`updateConfigurationTemplate`, `deleteConfigurationTemplate`,
`applyConfigurationTemplate`, `importConfigurationTemplates`

**Schedules**
`getSchedules`, `cancelGetSchedule`, `setSchedule`, `setEnabledSchedule`

> For exact argument shapes, consult the corresponding method in
> `zwave-js-ui/api/lib/ZwaveClient.ts` (the reference clone) or the zwave-js API
> docs. The `args` array maps positionally to the method signature.

## 5. Key REST endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `GET` | `/api/settings` | full settings object |
| `POST` | `/api/settings` (and related) | update settings |
| `GET`/`PUT`/`DELETE` | `/api/store` | store file browser (backups, configs) |
| `GET` | `/api/exportConfig` | export configuration |
| `GET` | `/health`, `/health/:client` | health/status |
| `GET` | `/version` | backend version |
| `GET` | `/api/snippet` | driver-function snippets |
| `GET`/`POST` | `/api/debug/*` | debug log status/control |

## 6. Data shapes (frontend types)

Model these in `frontend/src/api/types.ts`. The richest references:
- **`ZUINode`** — the node object (id, name, location, status, ready,
  manufacturer, productLabel, batteryLevels, values map, etc.)
- **`ZUIValueId`** — a value (commandClass, endpoint, property, propertyKey,
  metadata, value). Device controls are built by interpreting these.

Both are defined in `zwave-js-ui/api/lib/ZwaveClient.ts`. Port the fields the UI
actually uses; don't blindly copy everything.

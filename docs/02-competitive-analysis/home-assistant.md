# Home Assistant — Z-Wave JS integration

**Category:** Open-source prosumer platform. Its **Z-Wave JS** integration is the closest functional sibling to Z-Wave JS UI and a key interoperability target (they often run together).

## What the UX does well

### Device page with progressive depth
- A Z-Wave device page shows, top-to-bottom: **device info** (name, node ID, manufacturer, model, firmware), **entities/controls** (toggles, sensor readouts), then **configuration parameters** in a collapsible section.
- **Config parameters** render with **friendly names, current values, dropdowns/inputs, and tooltips** explaining each one, with reset-to-default. This is the model to beat for our config-param UX.
- Device-level actions exposed cleanly: **re-interview, heal/rebuild, remove failed, replace, ping**.

### Area (room) model
- Devices and entities are assigned to **Areas**; dashboards and automations are organized around them. Maps directly onto Z-Wave `location`.
- "Use node location as suggested area" already exists in Z-Wave JS UI's HA discovery settings — reinforcing location as the central grouping concept.

### Capability-driven UI
- The page adapts to device capabilities — a battery sensor shows no switch; a thermostat shows climate controls. Our rework should likewise **render controls from the node's command classes** rather than a fixed template.

### Diagnostics surfaced contextually
- Z-Wave JS diagnostics (node status, last seen, routing/RSSI, statistics) appear on the device page and a dedicated config panel, not a far-off separate app section.

## What to avoid
- **Settings sprawl** and a steep first-run: HA + Z-Wave JS setup is notoriously intimidating for newcomers.
- Two layers of config (HA entity settings vs. Z-Wave device config) can confuse users about "where" a setting lives.

## Relevance to Z-Wave JS UI rework
| Borrow | Mapping |
|---|---|
| Config params with friendly names + tooltips + reset | Direct upgrade of our Configuration tab |
| Capability-driven controls | Render from command classes; hide irrelevant controls |
| Area/room model | `location` as primary grouping |
| Contextual diagnostics on device page | "Diagnose" actions on the device detail, not only the Network page |
| Re-interview/heal/replace as device actions | Keep, but tier them (Basic vs Advanced) |

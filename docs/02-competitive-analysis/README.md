# Competitive & Inspirational UX Analysis

This section studies how leading smart-home platforms present device control, configuration, and network management. The goal is **not** to copy any one of them, but to extract UX patterns that make a technically deep system (Z-Wave) feel approachable — *simple by default, powerful when needed*.

Z-Wave JS UI sits at the **"installer / power tool"** end of the spectrum: it exposes the full Z-Wave protocol (associations, config params, routes, RSSI, NVM, Zniffer). Consumer apps (SmartThings, Apple/Google Home, Homey) sit at the **"appliance"** end: they hide almost everything. Our rework should borrow the *approachability* of the consumer apps while keeping the *depth* of the installer tools (Hubitat, Home Assistant Z-Wave JS) one tap away.

## Products studied

| Product | Category | What we steal | What we avoid |
|---|---|---|---|
| [SmartThings](./smartthings.md) | Consumer hub app | Card dashboard, room tabs, favorites, quick vs. detail controls, device health dots | Over-simplification that hides Z-Wave depth entirely |
| [Hubitat](./hubitat.md) | Prosumer local hub | Honest device detail pages, Z-Wave Details table, command buttons, logs | Dated, dense, table-heavy web UI; poor mobile |
| [Homey](./homey.md) | Premium consumer hub | Beautiful device tiles, plain-language automation, insights/charts, progressive disclosure | Closed ecosystem; heavy animation |
| [Home Assistant (Z-Wave JS)](./home-assistant.md) | Open prosumer | Device page with entities + collapsible config params w/ tooltips, area model, reconfigure/heal actions | Settings sprawl; steep first-run |
| [Apple Home / Google Home](./apple-google-home.md) | Consumer | Room-based tiles, favorites, status-color tiles, plain-language scenes, large touch targets | Almost zero diagnostics |

## The spectrum

```
  APPLIANCE  ◄─────────────────────────────────────────►  INSTALLER TOOL
  Apple Home   Google Home   SmartThings   Homey   Hubitat   HA Z-Wave JS   Z-Wave JS UI
  (hide all)                                                                 (show all)

                          ┌───────────────────────────┐
                          │   TARGET FOR THE REWORK    │
                          │  approachable like Homey,  │
                          │  deep like Z-Wave JS UI    │
                          └───────────────────────────┘
```

See [takeaways.md](./takeaways.md) for the consolidated design principles distilled from all of these.

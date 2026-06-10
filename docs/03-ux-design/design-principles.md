# Design Principles

## 1. Three explicit disclosure tiers
The current app hides power features ad-hoc (a node "Advanced" menu, a controller "Advanced actions" dialog, a "Compact view" toggle). We replace that with **one consistent model** used everywhere.

| Tier | Name | Visibility | Examples |
|---|---|---|---|
| **1** | **Basic** | Always visible, default | Device cards, on/off/dim, sensor readings, Favorites, rooms, Scan-to-add, rename/relocate, ping/refresh |
| **2** | **Advanced** | One disclosure away (a tab, a "Show advanced" toggle, or the global Advanced switch) | Config parameters, associations, firmware, health check, mesh map, MQTT/HA integration, scenes, templates |
| **3** | **Expert** | Clearly badged `EXPERT`, confirmation-guarded, never on the everyday path | Zniffer, debug logs, driver function, NVM/store files, hard reset, custom config CC, gateway JS hooks |

**Global "Advanced mode" switch** in the top bar (persisted per user). Off = a resident's appliance. On = an installer's workbench. Individual screens can also have a local **"Show advanced"** reveal so you don't have to flip the global switch for a one-off.

> Design rule: **A first-time user should accomplish the 5 core jobs (see a device, control it, add a device, name/group it, know if something's wrong) without ever encountering Tier 2/3.**

## 2. Glance → drill-down
Every object has a **glance surface** (card/tile/row showing identity, status, primary action) and a **detail surface** (full controls + tabs). Never force the user into detail to do the common thing; never cram detail onto the glance.

## 3. Status is color + one line
Adopt the consumer-app pattern: a device's state is legible at a glance via a **status color** (online/asleep/dead) and **one line** of primary state ("On · 60%", "72°F", "Locked", "Battery 15%"). Color is never the *only* signal (accessibility) — pair with icon/text.

## 4. Room/location first
Primary grouping is the Z-Wave **location** field (already in the data model). Secondary: a user-curated **Favorites** lane. Tertiary: filter by type/status. Avoid node-ID-centric organization in the default view (IDs are an Advanced detail).

## 5. Capability-driven, not template-driven
Render controls from the node's **command classes**. A door sensor shows battery + open/closed; a dimmer shows a slider; a thermostat shows setpoints. Don't show empty/irrelevant controls.

## 6. Plain language, with tooltips on jargon
Default copy is human ("Signal", "Add device", "Battery"). Protocol terms (DSK, association, LWR, SNR margin, command class) appear only in Advanced/Expert contexts and **always carry a tooltip/`?`** with a one-line explanation (the HA pattern; Hubitat recommends this too).

## 7. Contextual actions over scattered pages
Troubleshooting tools attach to the thing being troubleshot. A device card flagged "Dead" exposes **Diagnose · Rebuild routes · Locate on map** inline, instead of making the user know to visit a separate Health/ Mesh page.

## 8. Mobile-first & responsive
Design the phone layout first, enhance for tablet/desktop. Cards reflow (1→2→4 columns); tables **collapse into cards** on narrow screens; bottom navigation on phones, side rail on desktop; touch targets ≥ 44px. No horizontal-scrolling data tables on mobile.

## 9. Safe by default
Destructive/irreversible actions (Hard Reset, Exclude, NVM Restore, Remove failed, Driver Function) require explicit confirmation, are visually distinct (danger color), and are Expert-tiered. Surface a single, friendly **Backup & Restore** so users have a safety net before risky operations.

## 10. Fast & local
The UI must feel instant on hub-class hardware (Raspberry Pi browser). Favor lightweight rendering, virtualized long lists, optimistic UI with realtime socket.io confirmation, and avoid heavy continuous animation.

## 11. Accessible & themeable
WCAG-minded: semantic HTML, keyboard navigation, visible focus, 4.5:1 contrast, screen-reader labels. Full **light/dark** support via design tokens; respect `prefers-color-scheme` and `prefers-reduced-motion`.

## 12. Parity is non-negotiable
Reorganize and progressively disclose freely — but every capability in the [master catalog](../01-feature-analysis/feature-catalog.md) must remain reachable. "Simpler" means *better-organized*, not *less capable*.

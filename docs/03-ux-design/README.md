# UX Design — The Reworked Z-Wave JS UI

This section turns the [feature analysis](../01-feature-analysis/) and [competitive takeaways](../02-competitive-analysis/takeaways.md) into a concrete design direction. The HTML mockups in [../04-mockups/](../04-mockups/) realize it.

## Design goals (from the brief)
1. **Modern, clean** look.
2. **Responsive** — genuinely usable on a phone.
3. **Simple by default, powerful when needed.**
4. **Full feature parity** with Z-Wave JS UI.
5. Same backend (`@zwave-js/server` / zwave-js), reachable via the existing socket.io + REST APIs.

## Documents
1. [Design Principles](./design-principles.md) — the 3-tier disclosure model and the rules that flow from it.
2. [Information Architecture](./information-architecture.md) — new navigation, sitemap, and where every feature lives.
3. [Design System](./design-system.md) — color, type, spacing, components, tokens, dark mode, responsiveness.
4. [User Flows](./user-flows.md) — onboarding, add-a-device, control, configure, troubleshoot.

## One-paragraph vision
A **room-first, card-based** control panel that opens to a calm dashboard of status-colored device cards with one-tap controls. Depth is always **one disclosure away**: tap a device for full control/config/associations/firmware/diagnostics; switch to **Network** for the mesh and controller; flip the global **Advanced** toggle (or per-screen "Show advanced") to reveal power-user surface area. Adding a device leads with **QR Smart Start**. The whole thing is mobile-first, themeable (light/dark), accessible, and fast on a Raspberry Pi.

# Z-Wave JS UI — UI/UX Rework

A research-and-design project to rework the [Z-Wave JS UI](https://github.com/zwave-js/zwave-js-ui) frontend into a **modern, clean, mobile-friendly** control panel that is **simple by default and powerful when needed**, while keeping **full feature parity** and the same [zwave-js](https://github.com/zwave-js/zwave-js) / `@zwave-js/server` backend.

> Goal, in one line: borrow the *approachability* of consumer apps (Homey, Apple/Google Home, SmartThings) without losing the *depth* of installer tools (Hubitat, Home Assistant Z-Wave JS).

## 📁 What's here

```
docs/
├── 01-feature-analysis/        What the existing app does (parity source of truth)
│   ├── README.md
│   ├── control-panel-nodes.md
│   ├── settings-auth.md
│   ├── diagnostics.md
│   ├── automation-provisioning-store.md
│   └── feature-catalog.md      ← consolidated ~82-feature checklist
├── 02-competitive-analysis/    How other smart-home UIs solve UX
│   ├── README.md  smartthings  hubitat  homey  home-assistant  apple-google-home
│   └── takeaways.md            ← 10 design directives
├── 03-ux-design/               The proposed design
│   ├── README.md
│   ├── design-principles.md    ← the 3-tier disclosure model
│   ├── information-architecture.md  ← 12 routes → 5 task areas
│   ├── design-system.md        ← tokens, color, type, components
│   └── user-flows.md           ← 5 key flows
├── 04-mockups/                 Interactive responsive HTML mockups
│   ├── index.html              ← start here
│   └── dashboard / devices / device-detail / add-device / network / settings / onboarding
└── 05-implementation/          How the real app is built (for contributors)
    ├── architecture.md         ← reuse-backend / replace-frontend, tech stack, container
    ├── backend-api.md          ← authoritative socket.io + REST + ZWAVE_API contract
    └── agent-guide.md          ← dev/test loop, conventions, definition of done
```

(The cloned upstream repo lives alongside in `../zwave-js-ui/` as the analysis reference.)

## 🚀 Quick start
- **See the vision:** open `docs/04-mockups/index.html` in a browser (or `python3 -m http.server` inside that folder). Toggle **Advanced** and the **theme**, and resize to mobile.
- **Read the argument:** [feature-catalog](docs/01-feature-analysis/feature-catalog.md) → [takeaways](docs/02-competitive-analysis/takeaways.md) → [design-principles](docs/03-ux-design/design-principles.md) → [information-architecture](docs/03-ux-design/information-architecture.md).

## 🎯 The core idea: three disclosure tiers
The existing app exposes ~82 capabilities, of which **only ~27% are everyday** — the rest are advanced/expert. So the rework defaults to the resident and lets the installer opt into depth.

| Tier | Visibility | Examples |
|---|---|---|
| 🟢 **Basic** | Always visible | Device cards, on/off/dim, sensors, add-by-QR, rooms, favorites |
| 🔵 **Advanced** | One disclosure away (global **Advanced** switch / per-screen reveal / extra tab) | Config params, associations, firmware, mesh map, MQTT/HA, scenes, templates |
| 🔴 **Expert** | Badged + confirmation-guarded, off the everyday path | Zniffer, debug logs, driver function, NVM/store, hard reset |

## 🧭 Information architecture at a glance
12 flat technical routes → **5 task-based areas**: **Dashboard · Devices · Add · Network · Settings** (with Automation & Diagnostics nested as Advanced). Every old route is preserved — just relocated. See [information-architecture.md](docs/03-ux-design/information-architecture.md).

## ✅ Design goals → how they're met
| Goal | Approach |
|---|---|
| Modern, clean | Card-based, token-driven design system; generous spacing; light/dark |
| Responsive / mobile | Mobile-first CSS; bottom nav; tables collapse to cards; the mockups prove it |
| Simple by default, powerful if needed | Explicit 3-tier disclosure + global Advanced switch |
| Full feature parity | [feature-catalog.md](docs/01-feature-analysis/feature-catalog.md) maps every capability to a new home |
| Same backend | Pure frontend rework against existing socket.io/REST APIs of `@zwave-js/server` |

## 📌 Status & next steps
Research + design + mockups are **complete**. The project is now in
**implementation**: a new Vue 3 + Vite + TypeScript frontend built against the
existing zwave-js-ui backend, shipped as a drop-in container image.

- **How it's built:** [05-implementation/architecture.md](docs/05-implementation/architecture.md)
- **Backend API contract:** [05-implementation/backend-api.md](docs/05-implementation/backend-api.md)
- **Contributor guide (dev/test loop, conventions):** [05-implementation/agent-guide.md](docs/05-implementation/agent-guide.md)
- **Live progress:** [GitHub Issues](https://github.com/surdy/zwave-ui/issues) (grouped by milestones M1–M6)


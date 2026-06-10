# HTML Mockups

Interactive, dependency-free mockups of the reworked Z-Wave UI. Pure HTML/CSS/JS — **no build step**.

## How to view
Open **`index.html`** in a browser for the gallery, or open any screen directly. For correct relative paths and iframe previews, serve the folder:

```bash
cd docs/04-mockups
python3 -m http.server 8080
# visit http://localhost:8080/index.html
```

## Screens
| File | Screen | Demonstrates |
|---|---|---|
| `index.html` | Gallery | Entry point; desktop + phone previews |
| `onboarding.html` | First-run wizard | 4-step setup (controller → region → keys) |
| `dashboard.html` | Dashboard | Room-first status cards, Favorites, Needs-attention |
| `devices.html` | Devices | Cards ↔ Advanced table; group-by |
| `device-detail.html` | Device detail | Tabs + 3-tier disclosure; tooltipped config params; associations; firmware; expert tools |
| `add-device.html` | Add device | QR Smart Start hero + classic reveal + provisioning table |
| `network.html` | Network | Health summary + weak links + schematic mesh map + controller/diagnostics |
| `settings.html` | Settings | Decomposed monolith: Setup on top, searchable sections, progressive disclosure |

## Interactions to try
- **Advanced switch** (sidebar / nav) — reveals Tier-2 surface across every screen (table view, extra params, MQTT, mesh map, controller tools). State persists via `localStorage`.
- **Theme toggle** (☾/☀ in the top bar) — light/dark; also respects `prefers-color-scheme`.
- **Resize the window** (or open on a phone) — sidebar → bottom nav, card grid reflows, data tables collapse into cards.
- **Tabs** on the device detail page; **reveal** links ("Show all parameters", "Add manually", "View/edit keys").
- Click a **device card** → device detail.

## Assets
- `assets/tokens.css` — design tokens (mirrors [design-system.md](../03-ux-design/design-system.md)).
- `assets/app.css` — components + responsive layout.
- `assets/app.js` — theme, advanced mode, tabs, reveals (vanilla JS).

## Scope note
These are **fidelity mockups of the design direction**, not the production app. They use emoji as stand-in icons (production would use an outline icon set per the design system) and static demo data. They exist to make the [UX design](../03-ux-design/) tangible and to validate the *simple-by-default / powerful-when-needed* model against the [feature catalog](../01-feature-analysis/feature-catalog.md).

# SmartThings (Samsung)

**Category:** Consumer cloud hub app (iOS/Android, also web). One of the most-used smart-home apps.

## What the UX does well

### Card-based dashboard
- Every device is a **card** showing icon, name, and key status (on/off, temperature, lock state). Cards are tappable for detail and expose a **quick action** (toggle) directly on the card.
- Devices are grouped by **room / custom zone**, navigated via a horizontal room selector / tab bar.
- **Favorites** let users pin the handful of devices/scenes they touch daily to the top, decoupled from room organization.

### Two-tier control model (the key pattern for us)
- **Quick action** on the card = the 80% case (toggle, set level).
- **Tap to expand** = detailed controls (sliders, color, scheduling, sensor history). 
- This "glanceable surface + drill-down" split is exactly the *simple-by-default / powerful-if-needed* model we want.

### Device health & status language
- Visual health dots: **green = online**, **red exclamation = problem**, plus battery and connectivity indicators.
- A central **notification center** aggregates alerts (low battery, door left open).

### Other notable patterns
- Persistent bottom tab bar: **Home / Devices / Routines (Scenes) / Settings** — flat, predictable navigation.
- **Scenes & Routines** are first-class and prominent ("Good Morning", "Away").
- Adaptive layout for phone/tablet/foldable; dark & light modes; Material You dynamic theming on Android.
- Strong onboarding: contextual walkthroughs for new users.
- Accessibility: high-contrast modes, large touch targets, screen-reader labels.

## Relevance to Z-Wave JS UI rework
| Borrow | How it maps to Z-Wave |
|---|---|
| Card dashboard + quick toggle | Node tiles with primary value control (switch/dimmer) on the tile |
| Favorites | Pin frequently used nodes; default landing surface |
| Room grouping | Map to Z-Wave node **location** field (already exists) |
| Health dots | Map to node status: ready / asleep / dead / interviewing; battery; last-seen |
| Drill-down detail | Tap node → full detail (values, config, associations, diagnostics) |
| Notification center | Surface dead nodes, failed interviews, firmware-update availability, low battery |

## What to avoid
- SmartThings **hides Z-Wave entirely** — no associations, no config parameters, no routes. For our installer audience that's a non-starter. We keep depth, just tucked behind an "Advanced" disclosure.
- Cloud dependency / account lock-in — irrelevant to our local-first tool, but a reminder to keep everything local and fast.

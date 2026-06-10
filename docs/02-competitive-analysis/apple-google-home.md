# Apple Home & Google Home

**Category:** Mainstream consumer apps. They define users' baseline expectations for "what a smart-home app feels like." Even our power users live in these apps daily.

## Apple Home — clarity & calm
- **Room metaphor** is the primary structure; devices are tiles within rooms, rearrangeable, with status text (On, 72°, Locked).
- **Favorites** float the most-used devices/scenes above rooms — a fast default surface.
- **Scenes** use plain-language summaries ("When anyone arrives home, turn on the porch light").
- Generous spacing, rounded tiles, strong accessibility, light/dark — a calm, uncluttered aesthetic.
- Widgets on lock screen / watch for one-tap access to top controls.

## Google Home — expressive & flexible
- **Favorites tab** is the centerpiece; users pin a mix of devices, rooms, routines, and camera feeds, drag-and-drop to arrange.
- **Material You**: tiles use dynamic color tied to state — *orange thermostat = heating, yellow tile = lights on*. Color encodes status at a glance.
- Info-dense but legible tiles with inline controls (toggle, slider, preview).
- Broad device compatibility; deep routines/automation with suggestions.

## Shared patterns worth adopting
1. **Room/zone as primary organization** + a **Favorites** fast-lane.
2. **Status-encoded tiles** — color and a single line of text communicate state instantly.
3. **Plain-language scenes/automations**.
4. **Large touch targets**, generous spacing, light/dark, accessible contrast.
5. **One-tap primary action** on the tile; details on tap-through.

## What to avoid
- Near-zero diagnostics or protocol visibility — fine for appliances, fatal for a Z-Wave control panel. We adopt their *surface calm* but keep an explicit path to depth.
- Cloud/account dependence — irrelevant to our local tool.

## Relevance to Z-Wave JS UI rework
The consumer apps teach us the **default (Tier 1) experience**: room-grouped, status-colored device tiles with a Favorites lane and one-tap control. Z-Wave's depth then lives *beneath* this calm surface, reached by tapping into a device or switching to the Network/Diagnostics areas — never crowding the first screen.

# Homey (Athom)

**Category:** Premium consumer hub with a polished mobile-first app and web app. Widely praised for design.

## What the UX does well

### Beautiful, status-rich device tiles
- Devices are **tiles** grouped by zone/room. Tiles aren't just on/off — they reflect live state (brightness, color, temperature) and offer the **primary control inline** (tap to toggle, drag/long-press for brightness).
- Strong visual hierarchy: bold icon, device name, current status, generous spacing, rounded corners — minimal but informative.

### Plain-language automation ("Flows")
- Automations are built as **When → And → Then** "Flows" with human-readable cards: *"When motion is detected, And it's after sunset, Then turn on Hallway light."*
- This natural-language, card-based model makes complex logic approachable. Even though Z-Wave JS UI delegates automation to MQTT/HA, **scenes** and **associations** can borrow this plain-language framing (e.g., "When this switch is pressed, control these lights" for associations).

### Insights & charts
- **Insights** give per-device historical charts (temperature, power, battery) — turning raw data into trends. A great model for surfacing Z-Wave sensor history and link/RSSI trends in a friendly way.

### Progressive disclosure done right
- Tile = glance + primary action. Tap = full device screen with secondary controls, settings, insights, and advanced info in clearly separated sections. Beginners never see advanced settings unless they go looking.

## What to avoid
- **Closed ecosystem** and heavy reliance on app-store apps per device — not relevant to our open, local tool.
- Animation-heavy interactions can feel slow on low-power hardware; our hub UI must stay snappy on a Raspberry Pi browser.

## Relevance to Z-Wave JS UI rework
| Borrow | Mapping |
|---|---|
| Status-rich tiles with inline primary control | Device cards showing the main value + a real control |
| Plain-language framing | Friendly labels for associations & scenes ("When pressed → control…") |
| Insights/charts | Sensor history, battery trend, link-quality trend on device detail |
| Clean visual hierarchy & spacing | Foundation of our design system |
| Zone/room grouping | Z-Wave `location` as the primary grouping dimension |

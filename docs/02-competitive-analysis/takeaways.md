# Consolidated Takeaways

Distilled from SmartThings, Hubitat, Homey, Home Assistant, and Apple/Google Home — translated into directives for the Z-Wave JS UI rework.

## The central tension
Z-Wave JS UI must serve **two users in one app**:
- **The resident** who just wants to see devices, toggle them, and add a new one (consumer-app expectations).
- **The installer/tinkerer** who needs associations, config params, routes, RSSI, Zniffer, NVM (Hubitat/HA expectations).

The catalog shows ~73% of features are Advanced/Expert. So the design must **default to the resident** and let the installer **opt into depth** — never the reverse.

## 10 directives

1. **Three explicit tiers.** Tier 1 Basic (always visible), Tier 2 Advanced (one disclosure away), Tier 3 Expert (clearly badged, off the everyday path). Replace today's ad-hoc "Advanced menu" / "Compact view" with one consistent model. → see [design-principles](../03-ux-design/design-principles.md).

2. **Room/location-first organization** (Apple/Google/Homey/HA all agree). Use the existing Z-Wave `location` field as the primary grouping; add a **Favorites** fast-lane.

3. **Status-encoded device cards** (Google Material You, SmartThings dots). Color + one line of text communicates online/asleep/dead, battery, and primary state at a glance. One-tap primary control on the card.

4. **Glance → drill-down** everywhere (all consumer apps). Card = primary action; tap = full detail with tabs (Controls / Configuration / Associations / Firmware / Activity / Advanced).

5. **Capability-driven rendering** (HA). Build controls from the node's command classes; never show a thermostat UI on a door sensor.

6. **Config params done like HA, not Hubitat.** Friendly names, tooltips, typed inputs, current-vs-default, reset. This is the single biggest "approachability" upgrade for power features.

7. **QR Smart Start is the front door** for adding devices (modern, secure, no timing dance). Classic inclusion is the fallback. Make "Scan to add" a hero action.

8. **Contextual troubleshooting** (HA). A "Dead" device should offer Health Check / Link Stats / Rebuild Routes / Locate-on-map right there — not require knowing which separate page to open.

9. **Real mobile layout** (Hubitat's biggest failure). Mobile-first, responsive: cards reflow, tables collapse to cards, big touch targets, bottom nav on phones. The current Vis.js graph and 3,100-line settings page are desktop-bound — provide mobile-friendly alternatives.

10. **Friendly safety net.** Consolidate the scattered backups (NVM + store + nodes.json) into one clearly labeled **Backup & Restore**, and guard destructive actions (Hard Reset, Driver Function, NVM restore) with explicit confirmation + Expert badging.

## Anti-patterns to avoid
- ❌ A flat wall of 80+ settings (today's Settings.vue).
- ❌ Raw tables with no hierarchy/color (Hubitat).
- ❌ Hiding Z-Wave depth entirely (SmartThings) — keep it, just tuck it away.
- ❌ Jargon without tooltips (associations, LWR, SNR margin, DSK).
- ❌ Desktop-only layouts.

## What "good" looks like
> A resident opens the app on their phone, sees their rooms with status-colored device cards, taps a lamp to dim it, and taps **＋ Scan to add** to onboard a new switch by QR — never seeing the word "command class." An installer flips to **Advanced**, opens the same lamp's **Configuration** tab with tooltipped parameters, checks the **Network** map for a weak route, and runs a **Health Check** — all in the same coherent, modern, responsive UI.

→ Continue to [UX Design](../03-ux-design/README.md).

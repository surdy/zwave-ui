# Key User Flows

Five flows that prove the *simple-by-default, powerful-when-needed* model. Each notes the tier and maps to catalog features.

---

## Flow 1 — First-run onboarding (Tier 1)
**Goal:** from zero to a working network in minutes.

```
Welcome → Connect controller → Set region → Security keys → Done → Dashboard
```
1. **Welcome** — short intro, "Get started".
2. **Connect controller** — auto-detect serial ports; pick from a friendly list (shows port + detected adapter). [K1, Settings serial port]
3. **Region** — choose RF region (geolocation-suggested default). [K1, RF region]
4. **Security keys** — "Generate secure keys" one-click (creates S2 + S0); Advanced reveal to paste existing keys. [K1, security keys] — explained in plain language: "These let your devices talk to the hub securely."
5. **Done** — "You're ready. Add your first device." → routes to **Add**.

Everything else (MQTT, HA, backups, power levels) is *not* in onboarding — defaults apply, configurable later. This replaces hunting through a 3,104-line settings page.

---

## Flow 2 — Add a device via QR (Tier 1, hero)
**Goal:** add a device the modern, secure way. [C1, C2]

```
Add → Scan QR → (provisioned) → power on device → joins automatically → name & assign room → appears on Dashboard
```
1. Tap **➕ Add** → big **"Scan QR code"** button.
2. Camera scans the device's Smart Start QR (or upload image / paste code). [QrReader: Scan/Import/Text]
3. UI confirms "Device provisioned — power it on near the hub." Creates the provisioning entry. [Smart Start table]
4. When powered, it joins securely (S2) on its own; a toast + "Needs attention → name it" prompt appears.
5. **Name & room** sheet (plain language). Device card lands in its room. [A7]

**Fallback (Advanced reveal):** "Add manually" → classic inclusion → choose secure/insecure, S2 classes, enter DSK/PIN if prompted. [C3–C5]

---

## Flow 3 — Everyday control (Tier 1)
**Goal:** see and operate a device. [B2, B3, A5]

```
Dashboard → tap card toggle (done)         ← 80% case
Dashboard → tap card → Overview → slider/setpoint/lock
```
- **Glance:** card shows icon, name, room, status dot, one-line state, and a primary control. A light toggles right on the card; a dimmer long-press reveals a slider.
- **Drill-down:** tap opens **Overview** — primary controls + key sensors, big and touch-friendly. Capability-driven: a lock shows lock/unlock + jam status; a thermostat shows setpoints + mode. [Capability rendering]
- No command-class jargon at this tier; "Show all values" reveals the raw Controls tab (Tier 2). [B1]

---

## Flow 4 — Configure a device (Tier 2)
**Goal:** change a device parameter (e.g., motion sensitivity) and set up an association. [B7, D1–D3]

```
Device → Configuration tab → param (friendly name + tooltip) → change → Save
Device → Associations tab → Add → pick group + target → Save
```
- **Configuration**: parameters listed with **friendly names, current value, tooltip `?`, and reset-to-default** (HA-style). Typed inputs (dropdown/number/bitmask). "Show advanced parameters" reveals the long tail; **Custom Configuration** (raw param/size/format GET/SET) is Tier 3 behind an Expert reveal. [B8, B9]
- **Associations**: "When this device acts, control…" framing. Pick group (endpoint-aware), target node/endpoint; shows max/actual; the security-mismatch **bypass** is Expert. [D4]
- **Apply to similar devices**: offer to save these params as a **Configuration Template** (Tier 2). [I2]

---

## Flow 5 — Troubleshoot an offline device (Tier 2, contextual)
**Goal:** a device shows "Dead" — fix it without knowing Z-Wave internals. [F4, F5, F6, G1]

```
Dashboard "Needs attention" → device → Diagnose
  → Health check (plain verdict + details)
  → Suggested fixes: Rebuild routes · Ping · Locate on map · Re-interview
```
1. **Needs attention** card surfaces the dead device. Tap it.
2. Device detail shows a **banner**: "This device isn't responding." with contextual buttons: **Diagnose**, **Rebuild routes**, **Locate on map**. [Contextual actions principle]
3. **Diagnose** runs a **Health Check** and shows a **plain verdict** ("Weak link — likely too far from a repeater") with an expandable Advanced panel containing the raw metrics (latency, SNR margin, failed pings, rating, power level). [F4, DialogHealthCheck]
4. **Locate on map** opens the **Network** map filtered to that node and its routes (desktop) or the **Health summary** weak-link entry (mobile). [G1, G3]
5. Expert path: **Diagnostics → Zniffer/Logs** for deep capture. [H1, H2]

---

## Cross-cutting: the Advanced switch
At any point, the global **Advanced** toggle (top bar) expands Tier 2 surface inline across screens (table view, all value classes, extra tabs, Network map, integration settings). Expert items still require their own per-section reveal + confirmation. This single control is how one app serves both the resident and the installer.

## Flow-to-catalog coverage
These five flows exercise Tiers 1–2 and touch Devices, Add, Network, Settings, Automation. Expert flows (Zniffer capture, driver function, NVM restore, store editing) are intentionally *not* primary flows — they're reachable, badged, and guarded per the [IA](./information-architecture.md).

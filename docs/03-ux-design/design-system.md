# Design System

A lightweight, token-driven system. Values here are mirrored as CSS custom properties in the mockups (`../04-mockups/assets/tokens.css`) so docs and prototypes stay in sync.

## Brand & color

Z-Wave's identity leans **teal/cyan**. We pair a calm teal primary with a near-neutral slate canvas and semantic status colors.

### Core palette (light)
| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#0ea5a4` (teal-500) | primary actions, active nav, accents |
| `--color-primary-strong` | `#0f766e` | hover/pressed |
| `--color-bg` | `#f6f8fa` | app canvas |
| `--color-surface` | `#ffffff` | cards, sheets |
| `--color-surface-2` | `#f1f5f9` | insets, table headers |
| `--color-border` | `#e2e8f0` | hairlines |
| `--color-text` | `#0f172a` | primary text |
| `--color-text-muted` | `#64748b` | secondary text |

### Status / semantic
| Token | Value | Meaning |
|---|---|---|
| `--ok` | `#16a34a` | online / alive / healthy |
| `--ok-soft` | `#dcfce7` | online tile tint |
| `--warn` | `#f59e0b` | asleep / low battery / degraded |
| `--warn-soft` | `#fef3c7` | warning tint |
| `--danger` | `#dc2626` | dead / failed / destructive |
| `--danger-soft` | `#fee2e2` | danger tint |
| `--info` | `#2563eb` | informational |
| `--accent-on` | `#fde68a` | "lights on" warm glow (à la Material You) |

### Dark theme
| Token | Value |
|---|---|
| `--color-bg` | `#0b1220` |
| `--color-surface` | `#111a2b` |
| `--color-surface-2` | `#1a2538` |
| `--color-border` | `#243049` |
| `--color-text` | `#e6edf6` |
| `--color-text-muted` | `#93a4bd` |

Primary/status hues stay the same (slightly brightened). Theme switches by toggling `data-theme="dark"` on `<html>`; respect `prefers-color-scheme`.

## Typography
- **Font**: system stack — `-apple-system, "Segoe UI", Roboto, Inter, sans-serif`. (Optionally bundle **Inter**.) Monospace for logs/JSON: `ui-monospace, "JetBrains Mono", Menlo`.
- **Scale** (rem, 1rem=16px): display `1.75` / h1 `1.5` / h2 `1.25` / h3 `1.125` / body `1` / small `0.875` / caption `0.75`.
- Responsive headings: `clamp()` (e.g. `font-size: clamp(1.25rem, 2.5vw, 1.5rem)`).
- Weights: 600 headings, 500 labels, 400 body. Line-height 1.5 body / 1.25 headings.

## Spacing & layout
- **4px base scale**: `--s-1:4 · --s-2:8 · --s-3:12 · --s-4:16 · --s-5:24 · --s-6:32 · --s-7:48`.
- **Radii**: `--r-sm:8 · --r-md:12 · --r-lg:16 · --r-pill:999`. Cards use `--r-lg`.
- **Shadows**: `--shadow-1: 0 1px 3px rgba(2,6,23,.06)` (cards) · `--shadow-2: 0 8px 24px rgba(2,6,23,.12)` (sheets/menus). Dark theme uses subtle borders instead of heavy shadows.
- **Container**: max-width 1200px desktop; full-bleed on mobile with `--s-4` gutters.

## Responsive breakpoints
| Name | Min width | Layout |
|---|---|---|
| `sm` (phone) | 0 | 1-col card grid, bottom nav, tables→cards |
| `md` (tablet) | 640px | 2-col grid, side rail appears |
| `lg` (desktop) | 1024px | 3–4-col grid, tables, detail as drawer |
| `xl` | 1280px | 4-col grid, persistent rail + detail |

Grid: `grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))` for device cards.

## Core components

### Device card (the workhorse)
- Surface, `--r-lg`, `--shadow-1`, padding `--s-4`.
- **Top**: type icon (left), Favorite ☆ (right). Icon background tints by state (warm glow when "on").
- **Middle**: device name (600), room (muted small).
- **Status row**: status dot (color) + one line ("On · 60%", "72°F", "Battery 15%", "Asleep").
- **Primary control**: inline — switch toggle, or tap-and-hold/slider for dimmers. Whole card tappable → detail.
- **States**: online (default), asleep (muted + moon), dead (danger border + alert), interviewing (progress shimmer).

### Status pill / dot
Small color dot + label. Always pairs color with icon/text (never color alone).

### Tier reveal
`Show advanced ⌄` text-button that expands an inline section; and the global **Advanced** switch. Expert sections show a small `EXPERT` badge + danger styling for destructive items.

### Tabs (device detail)
Scrollable, underline-style; first tab (Overview) is Tier 1; later tabs lazy-load.

### Data table → card list
Desktop: dense table with sort/filter/column controls. Mobile: each row becomes a mini-card (label/value pairs). One component, two renderings.

### Sheets & dialogs
Bottom sheet on mobile, centered modal on desktop. Used for Add-device steps, confirmations, value editors. Destructive confirms use danger color + require an explicit press.

### Buttons
Primary (filled teal), Secondary (outline), Ghost (text), Danger (filled red). Min height 40px (44px touch). Icon buttons 40×40.

### Nav
Bottom bar (mobile, 5 items, active = teal) / side rail (desktop, icon+label). Top app bar with search, Advanced toggle, theme, account.

### Empty / loading / error states
Friendly empty states with a primary CTA; skeleton loaders for cards/tables; inline error banners with a retry and a plain-language message.

## Iconography
Outline icon set (e.g. Material Symbols / Lucide). Device-type icons: light, switch, dimmer, lock, sensor (motion/contact/temp/humidity), thermostat, cover/shade, plug, controller, button/remote, siren. Status icons: check, moon (asleep), alert (dead), shield (secure), battery levels, signal bars.

## Motion
Subtle, fast (120–200ms), `prefers-reduced-motion` respected. Toggle/slider feedback, card press, sheet slide-up, tab underline. No looping animations on hub hardware.

## Accessibility checklist
- Semantic HTML (`<button>`, `<nav>`, `<table>`, headings in order).
- Keyboard: all controls reachable, visible focus ring (`--color-primary` 2px).
- Contrast ≥ 4.5:1 text / 3:1 large & UI.
- Touch targets ≥ 44px; hit-slop on icon buttons.
- ARIA labels on icon-only controls; live regions for status changes/toasts.
- Color never the sole signal; tooltips on all jargon.

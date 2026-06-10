# Agent / contributor guide

This guide tells an independent contributor (human or AI agent) how to pick up a
Z-Wave UI issue and implement it correctly. **Read this and the issue's linked
docs before writing code.**

## 1. Before you start

For any issue, read in this order:

1. The issue body (scope + acceptance criteria).
2. [`architecture.md`](./architecture.md) — how the app is structured.
3. [`backend-api.md`](./backend-api.md) — the socket.io / REST contract.
4. The relevant design docs:
   - [`../03-ux-design/design-principles.md`](../03-ux-design/design-principles.md) — the 3-tier disclosure model.
   - [`../03-ux-design/information-architecture.md`](../03-ux-design/information-architecture.md) — where each screen lives.
   - [`../03-ux-design/design-system.md`](../03-ux-design/design-system.md) — tokens, components, breakpoints.
   - The matching mockup in [`../04-mockups/`](../04-mockups/).
   - The feature rows in [`../01-feature-analysis/feature-catalog.md`](../01-feature-analysis/feature-catalog.md).

## 2. The 3-tier disclosure model (the core thesis)

Every feature is tagged with a tier. Respect it in the UI:

- 🟢 **Basic** — always visible. Everyday tasks.
- 🔵 **Advanced** — hidden behind the global **Advanced mode** toggle
  (persisted in `localStorage`, exposed in the UI store).
- 🔴 **Expert** — visible in Advanced mode, **badged**, and guarded by a
  confirmation step before any destructive/irreversible action.

Issues are labelled `tier:basic` / `tier:advanced` / `tier:expert`.

## 3. Local development & testing loop

You do **not** need real Z-Wave hardware, and you must **never** test against the
live instance (`zwave.clusterfault.com` is read-only). Instead, run the real
backend locally with a **mock controller**.

### 3a. Run the backend with a mock stick

The upstream reference clone lives next to this repo (or clone it fresh from
`https://github.com/zwave-js/zwave-js-ui`):

```bash
cd zwave-js-ui
npm ci                       # ~60s

# terminal 1 — mock Z-Wave controller on tcp://localhost:5555
npm run fake-stick

# create store/settings.json pointing at the mock stick
mkdir -p store
cat > store/settings.json <<'JSON'
{
  "zwave": { "port": "tcp://127.0.0.1:5555", "enabled": true,
             "logLevel": "debug", "serverEnabled": true }
}
JSON

# terminal 2 — backend on http://localhost:8091
npm run dev:server
```

This gives you a fully working backend (socket.io + REST + ZWAVE_API) with
simulated nodes — identical API surface to production.

### 3b. Run the new frontend against it

```bash
cd frontend
npm install
npm run dev        # Vite dev server; proxies /socket.io and /api to :8091
```

The Vite dev proxy target is configurable via env (e.g.
`VITE_BACKEND=http://localhost:8091`). You may also point it at the live instance
**for read-only visual comparison only** — never trigger mutations there.

## 4. Conventions

- **Commits & PR titles** use **Conventional Commits**:
  `feat(devices): add capability-driven control rows`, `fix(api): …`,
  `chore: …`, `docs: …`, `ci: …`, `test: …`.
- **Vue 3** with `<script setup lang="ts">` and the Composition API.
- **Pinia** for state. No Vuex, no event bus.
- **TypeScript** everywhere; type the API layer and stores.
- **Styling** uses the design-system tokens/classes — no inline magic numbers,
  no second component framework. Port tokens from
  `docs/04-mockups/assets/tokens.css`.
- **Mobile-first & responsive**: every screen must work at 360px width and scale
  up. Tables collapse to cards on mobile; bottom nav on mobile, side rail on
  desktop.
- **Accessibility**: semantic HTML, labelled controls, keyboard-operable,
  visible focus, adequate contrast in both themes.
- Keep components small and focused; extract shared logic (DRY).

## 5. Definition of done (every feature issue)

- [ ] Meets all acceptance criteria in the issue.
- [ ] Works in light **and** dark themes.
- [ ] Responsive (verified at ~360px and desktop widths).
- [ ] Correct tier behavior (Basic visible; Advanced gated; Expert guarded).
- [ ] Talks to the backend via the shared API layer (no ad-hoc socket code).
- [ ] Lint passes (`npm run lint`) and type-check passes (`vue-tsc`/`tsc`).
- [ ] Unit tests for non-trivial logic (API mappers, stores, formatters) pass.
- [ ] Manually validated against the local mock-stick backend.
- [ ] Issue updated: check off acceptance criteria, link the PR, close when done.

## 6. Keeping issues updated (for monitoring)

So progress is visible on GitHub:
- Comment on the issue when you start (what you're doing).
- Tick acceptance-criteria checkboxes as you complete them.
- Reference the issue from commits/PRs (`Fixes #N`).
- Close the issue only when every acceptance criterion is met.

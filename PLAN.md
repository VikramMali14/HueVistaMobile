# HueVista Mobile — Implementation Plan (Handoff Document)

> **Who this is for:** any AI agent or developer picking up the mobile app build.
> Read this file top to bottom before writing any code. It contains everything
> you need: context, locked decisions, design reference, API map, architecture,
> and phase-by-phase task checklists.
>
> **How to use it:** work through the phases in order. As you complete a task,
> flip its `- [ ]` to `- [x]` and commit the edit together with the work.
> Append one line to the **Progress log** (bottom of this file) per work
> session. This file is the single source of truth for what is done and what
> is pending — keep it honest.

---

## 1. Context — what HueVista is

HueVista is an AI-powered paint shade visualizer for the Indian paint retail
market. Users photograph a room and preview real catalogue shades (Asian
Paints, Berger, Nerolac, Dulux, Nippon — ~8,000 shades) applied
photorealistically before painting.

Distribution follows the paint trade hierarchy:

```
Distributor → Retailer (paying subscriber) → Painter → End Customer
```

**User roles** (backend enum `UserRole`): `ADMIN`, `DISTRIBUTOR`, `RETAILER`,
`PAINTER`, `CUSTOMER`. Organizations (`OrgType`) are `DISTRIBUTOR` or
`RETAILER`; painters link to retailer orgs; customers enter via time-limited
access codes issued by retailers.

**The repos:**

| Repo | Stack | Role |
|---|---|---|
| `VikramMali14/HueVistaMobile` | React Native + Expo (TypeScript) | **This repo — the app this plan builds.** Created empty; scaffolding it is Phase 0. |
| `VikramMali14/HueVista` | Spring Boot 4, Java 17, PostgreSQL, Flyway | Backend REST API — serves web AND mobile. **Do not modify** except for the explicitly listed additions in §9. |
| `VikramMali14/HueVistaFrontEnd` | Next.js 15, React 19, TypeScript | Website. Source for design tokens, API client patterns, Zod schemas — **copy from it, never modify it** as part of mobile work. |

The backend README (`HueVista/README.md`) documents the platform, subscription
tiers, and core endpoints. Swagger is available at
`http://localhost:8080/swagger-ui.html` when the backend runs locally.

---

## 2. Locked decisions — do not relitigate

These were agreed with the owner. Change them only if the owner says so.

1. **Separate repository** (this one) — not a folder in either existing
   repo, not a monorepo.
2. **React Native + Expo, TypeScript, Expo Router.** Not Flutter, not native
   Swift/Kotlin, not a WebView wrapper.
3. **One app for all roles.** After login the app reads the account's role and
   renders that role's tab navigator. No separate per-role apps.
4. **Admin stays on the web.** No admin screens in the mobile app.
5. **Backend is consumed as-is.** Same JWT auth, same endpoints the website
   uses. The only backend additions allowed are listed in §9.
6. **Visual identity: "Midnight Spectrum"** carried over from the website
   (tokens in §4). The app is dark-themed by design — one theme, no
   light mode at launch.
7. **Recolor engine runs on-device** (GPU, luminance-preserving — same
   technique as the website's WebGL engine) so color changes stay instant and
   free. AI segmentation stays server-side (it is quota-billed).

---

## 3. Design reference

The full visual design — 12 phone-screen mockups, app map, navigation tables,
rationale — lives next to this file: **`design.html`** (repo root — open it
in any browser). Summary:

### Entry flow (all users)

```
Open app ─► Welcome screen
              ├─► Sign in (email / Google)          — existing accounts
              ├─► Create account                    — new customers
              ├─► "My paint shop gave me a code"    — access-code redeem (customer)
              └─► Painter invite link (deep link)   — painter onboarding
                        │
                        ▼
        Server returns role ─► app mounts that role's tab navigator
```

### Tabs per role

| Role | Bottom tabs | Notes |
|---|---|---|
| CUSTOMER | Home · Shades · **Visualize (raised center)** · Projects · Account | Core loop: photo → try shades → save → share → order |
| RETAILER | Counter · Codes · Orders · Painters · Account | Counter dashboard: AI quota meter, walk-ins, quick actions |
| PAINTER | Jobs · Visualize · Earnings · Account | Jobs carry approved shades + litres + site address |
| DISTRIBUTOR | Network · Codes · Reports · Account | Retailer health, renewals due, invites |

### Screens designed (see design.html for exact layouts)

1. **Welcome** — brand moment, "Sign in" / "My paint shop gave me a code"
2. **Shop code redeem** — code field `HV-XXXXXX`, shows linked shop card
3. **Sign in** — email+password, Google, forgot password
4. **Customer home** — big "Visualize a room" CTA, recent projects, AI picks
5. **Camera capture** — full-screen camera, wall-detection overlay, gallery pick
6. **Visualizer editor (hero screen)** — before/after compare slider, region
   chips (Main wall / Left wall / Ceiling / + tap to add), quick shade row
   (recently used first) with "All colours" into the full picker, "AI suggest"
   + "Share" actions, auto-save indicator
7. **Shade library** — company first, then that company's colours: search,
   Light/Medium/Dark depth filter, family chips, swatch grid, shade detail
   sheet with "Try on wall" and hold-to-wall
8. **Share sheet** — WhatsApp, copy link, "Send to shop for a quote", save image
9. **Retailer counter dashboard** — quota meter (e.g. 43/60), stat tiles
   (walk-ins / active codes / pending orders / week's order value), "New
   walk-in visualization" button, today's activity feed
10. **Access codes** — list with status pills (ACTIVE / EXPIRING / EXPIRED),
    bottom sheet: 3/7/14-day selector → "Create & send on WhatsApp"
11. **Painter jobs list + job detail** — status pills (NEW / IN PROGRESS /
    DONE·PAID), approved shades with codes and litres, site address +
    navigate, "Add site photo", "Mark complete"
12. **Distributor network** — territory stats, retailer rows with health dot,
    renewal follow-ups, "Invite a new retailer"
13. **Support chat** (all roles) — existing AI-assisted support module

---

## 4. Design tokens — Midnight Spectrum

Copy these exactly (source: `HueVistaFrontEnd/src/app/globals.css`).

```ts
export const colors = {
  bg:          '#0a090f',   // app background
  bgDeep:      '#050409',
  surface:     '#14131c',   // cards  (web uses #121119; mobile mockups use #14131c — pick one, stay consistent)
  surface2:    '#1b1a26',   // sheets, elevated surfaces
  fg:          '#eae8e3',   // primary text
  fgSoft:      '#a7a4bb',   // secondary text
  fgMute:      '#6d6a84',   // tertiary / disabled
  accent:      '#7c5cff',   // electric purple — primary actions
  accentSoft:  '#a080ff',
  accentDeep:  '#5a3fcc',
  rule:        'rgba(234,232,227,0.09)',  // hairline borders
  success:     '#7fae84',   // sage
  danger:      '#d0654c',   // terracotta
  warning:     '#d9b45c',
};
```

**Type:** Space Grotesk (headings / display, weights 500–700, via
`expo-font` + Google Fonts package), system default for body, JetBrains Mono
(or platform mono) for shade codes, access codes, prices. Instrument Serif
italic is the accent face, used for one or two emphasised words inside a sans
headline (`<Serif>` in `src/components/Text.tsx`) — never for a whole line.

**Shape language:** content cards radius 20 (14 for dense rows and thumbnails),
buttons 16, inputs 14, sheets 30, pills fully rounded. Status pills are
UPPERCASE mono 8–10pt. Status colors: NEW=accent,
IN PROGRESS/EXPIRING=warning, DONE/ACTIVE=success, EXPIRED/OVERDUE=danger.

### 4.1 The aurora layer (mobile only)

The tokens above mirror `globals.css` and must not drift from it. Everything
below is mobile surface treatment with no web counterpart, and lives in
`src/theme/{layout,motion}.ts` plus the "Aurora layer" block in `colors.ts`.

- **Aurora background.** Every screen sits on `<Aurora>` (via `Screen`): a
  vertical wash blooming violet at the top over three drifting colour clouds,
  rendered in Skia. `tint` biases it toward a colour — the Studio passes the
  shade currently on the wall.
- **Depth over borders.** Cards are translucent (`colors.glass`) with a
  top-lit edge and a real shadow (`elevation.low|mid|high`), not opaque blocks
  separated by hairlines. `glow(color)` lights an element in its own colour;
  shade swatches use it so a wall of them reads as paint under light.
- **The orb.** `<AuraOrb>` is the one hero figure — a glowing disc with a
  progress ring, for the single number a screen is about (projects left, AI
  quota).
- **Floating tab bar.** `<FloatingTabBar>` is a dark capsule inset from all
  three edges, drawn over the scene. It reports its height through
  `BottomTabBarHeightContext`, and `Screen` reserves that space automatically —
  screens never hardcode a tab-bar inset.
- **Motion.** RN `Animated` with `useNativeDriver` only (transform/opacity), so
  it survives a busy JS thread; durations and curves come from
  `src/theme/motion.ts`. `<Reveal>` staggers sections in on mount;
  `<PressableScale>` dips a control under the finger. Use `useAnimatedValue()`,
  not `useRef(new Animated.Value())` — the latter trips `react-hooks/refs`.

**Haptics.** Every control gives touch feedback through `src/haptics` — call
the semantic intent (`haptics.select/tap/press/success/warning/error`), never
`expo-haptics` directly. The module no-ops on web, swallows failures on devices
with no haptic engine, and honours the user's opt-out toggle in Account
(persisted; restored in the root layout by `loadHapticsPreference()`).

---

## 5. Backend API map

Base URL from env (`EXPO_PUBLIC_API_ORIGIN`, default `http://localhost:8080`).
All endpoints below exist today. **Treat the backend controllers as the source
of truth** — verify request/response shapes against the Java controllers or
Swagger before wiring each screen; do not guess fields.

| Feature | Endpoints (controller package in `HueVista`) |
|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, Google OAuth (`auth/`) — JWT access + refresh token |
| Verification | `/api/auth/verify/*` (email/SMS codes — gate before project creation when enabled) |
| Image upload | `POST /api/images/upload` (multipart; server classifies via Claude) (`image/`) |
| Shade catalogue | `GET /api/shades`, `/api/shades/{brand}`, `/{brand}/families`, `/{brand}/{code}` (`paint/`) — public. Signed-in twins `GET /api/shades/mine`, `/api/shades/mine/brands` apply the distributor's brand grant |
| Shop presentation | `GET /api/me/shade-code-scheme` (`paint/`) — the shop's customer-code pattern + whether paint names are shown |
| Projects | `POST/GET /api/projects`, `GET /api/projects/{id}`, `PUT .../regions`, `POST .../segment` (async — poll `GET .../status`), `POST .../segment/point` (SAM2 click refine), region mask endpoints, `POST .../send-to-shop`, `POST .../share` → `GET /api/shared/{token}` (`project/`) |
| AI recommendations | `POST /api/projects/{projectId}/recommendations` (`ai/`) |
| Billing | `POST /api/billing/subscriptions`, `GET /api/billing/subscriptions/current` (`billing/`) — Razorpay. `GET /api/billing/points/project-options` prices one more project and a reopen on both rails (reward points and money), reports the point balance, and counts paid-for projects not yet created — **retailers only**, since points are a shop currency. **Paying is a web Checkout flow — the app reads the price and links out** |
| Orgs & access codes | `POST /api/organizations`, `POST /api/organizations/{orgId}/access-codes`, `POST /api/access-codes/redeem` (signed in), `POST /api/access-codes/redeem-account` (public, no login — provisions the customer and returns a session) (`account/`) |
| Customer entitlement | `GET /api/me/entitlement` (project allowance, usage, access window), `POST /api/me/request-more-projects` (ask the shop), `GET /api/me/assigned-products` (`account/`) |
| Painters | `POST /api/organizations/{retailerOrgId}/painter-invitations`, `POST /api/painter-invitations/redeem`, `GET /api/painters/me`, `PUT /api/painters/me`, `GET /api/painters/me/retailers`, by-retailer listing (`painter/`) |
| Paint jobs | `/api/jobs` — `GET /mine/painter`, `GET /mine/customer`, `GET /{jobId}`, `POST /{jobId}/accept·decline·start·complete·cancel` (`painter/`) |
| Store | `/api/store/{slug}` public storefront, `POST /{slug}/order`, `POST /{slug}/verify`, store links, wallet + redemptions per org (`store/`) |
| Guest mode | `/api/guest/*` — limited browse without account (`guest/`) |
| Support | `/api/support/*` — AI-assisted chat threads (`support/`) |

**Auth handling on mobile:** access token in memory; refresh token in
`expo-secure-store` (Android Keystore / iOS Keychain) — the mobile equivalent
of the website's HttpOnly cookie. Auto-refresh on 401, single-flight. Optional
biometric unlock later (Phase 4).

---

## 6. App architecture (this repo)

```
HueVistaMobile/
├── app/                          # Expo Router file-based routes
│   ├── (auth)/                   #   welcome, sign-in, register, redeem-code, painter-invite
│   ├── (customer)/               #   tabs: home, shades, visualize, projects, account
│   ├── (retailer)/               #   tabs: counter, codes, orders, painters, account
│   ├── (painter)/                #   tabs: jobs, visualize, earnings, account
│   ├── (distributor)/            #   tabs: network, codes, reports, account
│   └── _layout.tsx               #   root: fonts, theme, auth gate, role router
├── src/
│   ├── api/                      # typed client per backend module (auth, projects, shades, jobs…)
│   ├── auth/                     # token store (secure-store), session context, refresh logic
│   ├── engine/                   # recolor engine (Skia/GL) — mask + luminance-preserving tint
│   ├── components/               # ui kit: Button, Card, Pill, Meter, SwatchGrid, ShadeTray…
│   ├── theme/                    # tokens from §4
│   └── offline/                  # catalogue cache, project draft queue
├── assets/                       # icon, splash, fonts
├── app.json / eas.json           # Expo + build config
└── .github/workflows/ci.yml     # typecheck + lint + test on PR
```

**Key libraries:** `expo` (SDK — latest stable), `expo-router`,
`@shopify/react-native-skia` (recolor engine), `expo-camera`,
`expo-image-picker`, `expo-secure-store`, `expo-notifications` (Phase 2),
`react-native-razorpay` (Phase 2), `zod` (validation — reuse website schemas
where possible), `@tanstack/react-query` (server state, retries, cache).

**Recolor engine (the one genuinely new piece):** the website recolors in
WebGL preserving per-pixel luminance so texture/shadows survive. On mobile,
implement the same math as a Skia shader (or GL): for each pixel inside the
region mask, replace hue/chroma with the target shade while keeping the
original luminance. Masks come from the backend segmentation endpoints as
images. **Build and prove this first in Phase 1 — it is the only technical
risk.** A throwaway spike screen that loads a bundled test photo + mask and
recolors at 60fps is the gate for the rest of Phase 1.

---

## 7. Phase checklists

> Rules: finish phases in order; within a phase, tasks are roughly ordered.
> Every phase ends with a working, committed, pushed app. Never leave the
> repo in a state that doesn't build.

### Phase 0 — Repository & foundations

- [x] Create GitHub repo `VikramMali14/HueVistaMobile` (private) — done by owner, 2026-07-20
- [x] Scaffold Expo app (TypeScript template, Expo Router), commit clean baseline — Expo SDK 57, React 19, RN 0.86
- [x] Add theme module with §4 tokens; load Space Grotesk via expo-font — `src/theme/`
- [x] Build base UI kit: Button, Card, Pill, Input, SheetModal, StatTile, Meter — `src/components/` (+ Text, Screen, Chip, StatusPill)
- [x] Typed API client with base URL from env + error normalization — `src/api/` (zod-validated, 401 single-flight refresh)
- [x] Auth store: secure-store refresh token, in-memory access token, 401 auto-refresh — `src/auth/` (verified against backend `AuthController`)
- [x] CI workflow: typecheck + eslint + unit tests on every push — `.github/workflows/ci.yml`
- [x] README.md: how to run (`npx expo start`), how to point at a backend, repo map

### Phase 1 — Customer core (the product)

> **Phase 1a delivered (2026-07-21):** recolor engine + spike, full auth flow,
> role router, and the customer tab shell. Remaining Phase 1 work (camera →
> upload → AI segmentation → full visualizer editor → live shade catalogue →
> share) is Phase 1b. Status per task below.

- [x] **Recolor engine spike** (see §6) — Skia luminance-preserving shader (`src/engine/`) + Visualize screen recoloring a bundled sample room/mask, with shade tray and press-and-hold compare. Typechecks, lints, bundles. ⚠️ **On-device interactive-framerate validation still pending** (needs the owner's Android phone) — that final check formally closes the gate.
- [x] Welcome screen (brand moment, three entry paths) — `app/(auth)/welcome.tsx`
- [x] Sign in / register / forgot password against existing endpoints — wired to the verified `AuthController` (`app/(auth)/`)
- [ ] Google sign-in (expo-auth-session against existing Google OAuth flow) — button present but disabled; needs OAuth client IDs + `POST /api/auth/oauth2/exchange` wiring
- [x] Access-code redeem — **both paths live.** Signed in: Account → "Link a paint shop" (`POST /api/access-codes/redeem`). Signed out: the Welcome `redeem-code` screen now runs the real **no-login** flow (`POST /api/access-codes/redeem-account`), which provisions a passwordless CUSTOMER account in the name the shop entered and returns a session the app adopts.
- [x] Role router: on session start, mount tab navigator for the account's role (customer first; other roles show a "coming in phase 2/3" placeholder screen) — auth gate in `app/_layout.tsx` + `app/coming-soon.tsx`
- [x] Customer home: CTA, recent projects, AI picks strip — `app/(customer)/home.tsx` (CTA + **live popular shades strip**; recent projects + AI picks are empty-state placeholders until the project/recommendation APIs are wired)
- [x] Camera capture + gallery pick → `POST /api/images/upload` → create project — `app/new-project.tsx` via expo-image-picker (OS camera + gallery); handles the 422 "not a room" + 400 size/type rejections. (Custom full-screen camera with a wall-detection overlay is later polish.)
- [x] Segmentation flow: trigger `POST .../segment`, poll status, handle failure — editor offers **AUTO** (AI wall detection) and **MANUAL** (mark them by hand); neither is charged here, because the project's single credit was taken at creation and covers the run and any retry of it. Polls `GET /status` every 2 s while `SEGMENTING`, surfaces `FAILED` + reason with retry, and turns each coded 402 into an action: `ASK_RETAILER` → ask the shop, `SUBSCRIPTION_REQUIRED` / `PROJECT_LIMIT_REACHED` → say what ran out. **Tap-to-mark walls is wired** (`POST .../segment/point`, mapped through the canvas's `cover` fit), and hand-marked walls can be deleted.
- [x] Visualizer editor: region chips, shade tray, auto-save regions (`PUT .../regions`) — `app/project/[id].tsx`: region chips, live shade tray, **multi-region composite recolor of the real masks** (Skia overlay shader + auth-fetched mask PNGs), per-swatch autosave. ⚠️ **Real-mask recolor + segmentation need a running backend + device to validate** (not exercisable in CI). Before/after compare currently lives in the engine spike.
- [x] Shade library: search + brand/family filters against `/api/shades`, offline cache — **live, and now shop-scoped**: a signed-in account only sees the paint companies it may work with (a customer's from their code, a shop's from `/api/shades/mine/brands`), and every code is rendered through the shop's own shade-code pattern with names hidden when the shop hides them. Signed-out browsing is unchanged. (`app/(customer)/shades.tsx`): server-side search + brand + family filters, infinite scroll via `/api/shades/paged`, shade detail sheet via `/{brand}/{code}` (AI-enriched), and React Query offline persistence of the catalogue (`src/query/persist.ts`). Contract verified against `ShadeController`.
- [x] "Try on wall" from any shade → visualizer with shade preselected — via route param (sample shades); carries over to the live catalogue
- [x] **Company → colour, everywhere paint is chosen.** The catalogue opens on the paint companies this account may work with and the grid that follows belongs to one of them; a shop restricted to a single company skips the step. Within a company: search, a Light/Medium/Dark depth filter (the backend's `tonality`), and family chips. The Studio and the room editor no longer paint from a dozen hardcoded demo swatches — both open the same `ShadePickerSheet` over the real scoped catalogue, with recently-used colours (persisted locally) on top for flipping between candidates. Shade facts match the website exactly — undertone, depth, LRV, family, finishes — via `src/shades/colorScience.ts`, a port of the site's `lib/color-science.ts` that keeps its thresholds and its words; the AI prose the website never renders no longer surfaces here either. `HoldToWall` fills the screen with one colour to hold against a real wall.
- [x] AI suggest: `POST .../recommendations` surfaced in editor — "AI suggest" opens a sheet of Claude's three palettes, each sized to the room (a photo with one wall marked comes back with one colour, not three), matched to real shades; tapping a colour paints the selected wall. Included in the project rather than quota-billed; the only 402 left is a project whose access window has closed. Contract verified against `ColorRecommendationController`.
- [x] Projects list + detail (resume editing) — live list (`app/(customer)/projects.tsx`, `GET /api/projects` with authed thumbnails) + the editor as detail (persisted region colours reload). Contract verified against `ProjectController`.
- [x] Share: native share sheet + share link (`POST .../share`) + save-to-gallery — editor "Share" generates a **10-day** link (the backend's new ceiling: a share link hands over the same repaint capability a walk-in code does, so the two expire on the same clock); "Save" captures the painted canvas (react-native-view-shot) and writes it to Photos (expo-media-library).
- [ ] "Send to shop for a quote" — **located, still blocked for this app.** The setter is `POST /api/guest/projects/{id}/send-to-shop` (`GuestController`) and is scoped to a guest token; there is no equivalent on `ProjectController` for a signed-in customer. The app reads `sentToShopAt` already. Needs either the guest-project flow (below) or a backend addition — **still not guessed.**
- [x] Verification (`/api/auth/verify/*`) — `app/verify.tsx` confirms e-mail and phone against the masked destination the server reports. A `VERIFICATION_REQUIRED` refusal on project creation routes here instead of printing a dead end.
- [x] Manage a room — rename, delete (confirmed), and **withdraw a live share link** (`DELETE /{id}/share`), all from the editor header. A live link is stated where the owner can see it, because sharing hands a stranger the same repaint capability a walk-in code does.
- [x] Account actions for every role — change password, delete account (confirmed, naming what goes), support, sign out. Shared in `src/account/AccountPanel.tsx` so the four roles cannot drift apart.
- [x] Shop palettes in AI suggest — `GET /api/me/retailer-combos` leads the sheet when the shop has any, above Claude's.
- [x] The customer's paint jobs (`GET /api/jobs/mine/customer`) on their Account, when a shop has scheduled one.
- [x] Guest browse mode (shade library only) — `app/(auth)/browse-shades.tsx` via the shared `ShadeLibrary` over the **public** `/api/shades` endpoints; reachable from Welcome, with a sign-up CTA on "Try on wall". (Guest *project creation* via `/api/access-codes/redeem-guest` + `/api/guest/*` is still pending.)

### Phase 2 — Retailer counter mode (the subscriber)

- [x] Retailer tab navigator + counter dashboard — `app/(retailer)/` (Counter · Codes · Customers · Plan · Account). Counter shows the plan in force, the project meter (allowance + bought + carried), reserved-behind-codes, stat tiles and the recent-codes feed. Tabs respect the distributor's page grant via `GET /api/hierarchy/my-access`.
- [x] "New walk-in visualization" fast path — the counter's primary action opens the same camera → project → editor chain the customer uses.
- [x] Access codes: list with status, create sheet, hand-off — `app/(retailer)/codes.tsx`: issue (name + rooms), extend, revoke, +1 project, and a native share sheet for WhatsApp/SMS. Quota is spent at issue time, so a 402 surfaces at the counter.
- [x] Customer portal — `app/(retailer)/customers.tsx`: every customer the shop is responsible for (managed **or** holding a code it issued), with their allowance, access window, and one-tap "give another project".
- [x] Painters: invite (code generation + share) and painter list — `app/painters.tsx`.
- [x] Subscription screen: current plan + reward points — `app/(retailer)/plan.tsx`. Buying a project **with points** happens in-app (a balance debit, no gateway); subscribing and buying points link out to Razorpay Checkout on the web.
- [ ] Orders list (store module) with status updates — the kiosk sells visualisations, not paint orders; there is no order queue endpoint to list. Wallet/kiosk client is built (`retailApi.wallet` / `storeLinks`), screen deferred.
- [ ] Push notifications: backend device-token registration (§9), then — shared-look opened, new order, renewal reminder
- [ ] Retailer onboarding polish: empty states that teach the walk-in flow

### Phase 3 — Painter & distributor (the network)

- [x] Painter invitation → redeem (`POST /api/painter-invitations/redeem`) → linked to the shop — in Painter → Account → "Add a shop's code". (A *deep link* that opens the app straight onto the redeem sheet is still pending; the code path itself is live.)
- [x] Painter jobs list (`GET /api/jobs/mine/painter`) with status pills — `app/(painter)/jobs.tsx`, sorted so anything waiting on the painter leads.
- [x] Job detail: litres, area, quote, address (opens in maps), and the one transition that is legal from where the job stands — accept / decline-with-reason / start / complete (`app/job/[id].tsx`). The approved colours are one tap away via the project. **Site photo upload still pending** — no job-photo endpoint exists.
- [ ] Painter earnings screen — the wallet is a shop's point ledger, not a painter payout account; there is no painter earnings endpoint to read. Needs a backend addition before it can be honest.
- [x] Painter gets the visualizer + catalogue — `app/(painter)/painter-shades.tsx` over the shared `ShadeLibrary`, and the same camera → editor chain.
- [x] Distributor navigator: network dashboard — `app/(distributor)/` (Network · Account) over `GET /api/hierarchy/network`, with per-shop code issued/redeemed counts and an idle / low-uptake / active read.
- [x] Distributor grants: which paint companies and which pages each shop may reach — `app/shop/[id].tsx` over `/api/hierarchy/retailers/{orgId}/brands` + `/features`. (Creating a retailer stays on the web.)
- [x] Support chat screen (all roles) against `/api/support/*` — `app/support.tsx`, reachable from every role's Account.
- [ ] Notifications inbox screen — `/api/support/inbox` is the ADMIN side of these threads, and admin stays on the web (§2.4). Nothing to mirror for the other roles.

### Phase 4 — Launch (the stores)

- [ ] App icon + splash (Midnight Spectrum brand)
- [ ] EAS build profiles: dev / preview / production for both platforms
- [ ] Crash reporting (sentry-expo) + basic analytics events (visualize started, share sent, code redeemed)
- [ ] Over-the-air updates channel (EAS Update) for JS-only fixes
- [ ] Store listings: screenshots from the design mockup set, descriptions (English + Kannada/Hindi)
- [ ] Google Play submission (owner provides dev account) → closed testing → production
- [ ] Apple App Store submission (owner provides dev account) → TestFlight → review
- [ ] Post-launch: monitor crashes, fix, iterate

---

## 8. Working agreements for the executing agent

1. **Update this file as you go** — checkboxes + progress log. That is how the
   owner (who is not a mobile developer) sees status.
2. **Small commits, clear messages**, conventional prefix (`feat:`, `fix:`,
   `chore:`). Push at every stable point.
3. **Verify API shapes against the backend code/Swagger** before wiring a
   screen; the table in §5 is a map, not a contract.
4. **Never modify `HueVista` or `HueVistaFrontEnd`** except the §9 additions
   (backend) — and do those on a branch with tests, matching that repo's
   conventions (Flyway migration for any schema change).
5. **Test on a real Android device early** (owner's phone via Expo Go /
   dev build); iOS via Expo Go until Phase 4.
6. **Keep the app runnable** — `npx expo start` must always work from a fresh
   clone + `npm install`.
7. **Ask the owner** before: spending money (accounts, services), changing a
   §2 locked decision, or any backend change beyond §9.

## 9. Allowed backend additions (only these)

| When | Addition | Notes |
|---|---|---|
| Phase 2 | `POST /api/devices` (+ entity/migration) to register Expo push tokens per user; notification fan-out on: share-link opened, order created, job assigned, renewal approaching | Follow existing module conventions (`notification/` exists); Flyway migration; tests |
| Phase 2 (optional) | Server-driven WhatsApp code send for access codes | Support module already has WhatsApp webhook plumbing to build on |
| Phase 1 (optional, nice-to-have) | Phone-sized image variant in upload response | Only if mobile bandwidth proves painful; otherwise skip |

---

## 10. Progress log

> Append one line per work session: date · phase · what happened · blockers.

| Date | Phase | Summary |
|---|---|---|
| 2026-07-31 | Phase 2 + 3 | **An admin now has a home, every painting role has a Studio, and photos actually load.** Three findings from the first real device+backend session, all of them ours. **Photos never appeared.** `resolveImageUrl` returns either an origin-relative `/api/images/files/…` path (local storage) or an absolute **S3 presigned** URL, and the app attached the bearer token to both. S3 refuses a presigned request that also carries an `Authorization` header — `400 InvalidArgument`, "only one auth mechanism allowed" — so with S3 storage configured every room photo, region mask and thumbnail failed. New `isApiOriginUrl` (host-compared, default-port- and case-insensitive, tested against lookalike hosts) now decides per URL, matching the distinction the website draws in `src/lib/media.ts`. **And the failure was invisible:** `useAuthedSkImage` returned null for "loading" and "failed" alike, so the editor showed its spinner over a photo that was never coming. `useAuthedSkImageState` reports status, and the editor says so with a Try again. **ADMIN landed in the retailer navigator** (`HOME_FOR_ROLE.ADMIN = '/counter'`) — a shop counter that was not their shop, with an empty plan meter, codes they cannot issue, and no dashboard or studio anywhere, because the retailer tab set has neither. New `app/(admin)/` group: Dashboard · Studio · Shades · Account, over the read-only halves of `AdminController` (`/admin/stats`, `/stats/revenue`, `/stats/ai-usage`, `/users/recent`) via a new `admin.ts` + zod schemas. Provisioning stays on the web (§2.4) and the account tab says so; the dashboard leads with the wall-detection failure rate, which is the only figure there that means something is broken. **The Studio was still the Phase-1 spike** — a bundled sample room with no route to the user's own walls. Shared `StudioScreen` (start a room, your saved rooms, sample-wall shade try-on with the way through to a real one) replaces `(customer)/visualize.tsx`, and is now a tab for customer, painter (whose layout comment had claimed a visualizer tab that did not exist) and admin. Verified: `tsc` clean, eslint clean, 110 unit tests pass (up from 99), `expo export` bundles (5.6 MB). ⚠️ The S3 half of the image fix is reasoned from the contract, not observed — it needs a device against an `S3_BUCKET_NAME` deployment to confirm. **Not changed:** the retailer tab set (its counter already links into the same flow, and a sixth tab crowds the bar) and the distributor's (no Studio, deliberately). |
| 2026-07-31 | Phase 2 + 3 | **Full web scan → all four roles now exist in the app.** Enumerated every backend endpoint and every website route against what the app called, and closed the gap rather than only the recent delta. **New API layer:** organisations + hierarchy (`org.ts`), the counter (`retail.ts` — codes, customers, grants, combos, kiosk link, points statement), painters and paint jobs (`painter.ts`), subscription + reward points + PDF allowance (`billing.ts`), support threads (`support.ts`), verification and profile management (`auth.ts`). All zod-validated against the Java DTOs. **Role routing:** the auth gate now mounts a real navigator per role instead of sending three of the four to a placeholder — `HOME_FOR_ROLE` in `app/_layout.tsx`. **Retailer** (`app/(retailer)/`): counter dashboard with the project meter that counts allowance + bought + carried and names what is reserved behind unredeemed codes; access codes (issue, extend, revoke, +1 project, share); the customer portal with one-tap grants; and the plan screen, where spending points on a project happens in-app while Checkout stays on the web. Tabs honour the distributor's page grant. **Painter** (`app/(painter)/`): job list led by whatever is waiting on them, job detail offering only the transition that is legal from where the job stands, maps hand-off, decline-with-reason, shop linking by invitation code, and the catalogue. **Distributor** (`app/(distributor)/`): the network with per-shop uptake, and per-shop grants of paint companies and pages — including the rule that an empty selection means *unrestricted*, said on screen because assuming the opposite would lock a shop down by accident. **Every role** gained verification, change-password, delete-account and support, shared in one component. **Customer tail:** rename/delete a room, withdraw a live share link, shop palettes ahead of Claude's in the suggest sheet, and their own paint jobs. Verified: `tsc` clean, eslint clean, 99 unit tests pass (up from 79), `expo export` bundles (5.6 MB). ⚠️ Needs a running backend + device to exercise end-to-end. **Deliberately not built:** admin (stays on the web, §2.4); painter earnings and job site photos (no endpoint exists — flagged, not guessed); the kiosk order queue (the kiosk sells visualisations, not paint orders); push notifications (§9 backend addition). |
| 2026-07-31 | Phase 1b | **Web-flow catch-up (07-28 → 07-31) — one project quota, points, and codes that outlive a pattern change.** Verified every backend and website change since the last sync and carried the customer-facing ones across. **One quota, charged at creation:** the separate image and auto-mask allowances are gone — one project now covers the whole automatic pipeline (photo clean-up *and* wall detection) and is charged when the project is CREATED, so a retry of a run already paid for is free. `IMAGE_LIMIT_REACHED` / `AUTO_MASK_UNAVAILABLE` are replaced by the single `PROJECT_LIMIT_REACHED`, and neither mask mode is priced against the other any more — AUTO vs MANUAL is now a choice about the result, not the bill. **Reopens are priced in points:** `reopenPricePaise` on a project became `reopenPricePoints`, so the view-only banner leads with the points price and names the card price beside it when the account can see one. **Purchase options moved** to `GET /api/billing/points/project-options` with the new both-rails shape (points + paise, `pointsBalance`, `pricingPlan`); it is retailer-only, so a customer's missing answer reads as "nothing to offer" rather than an error. **No buy button for customers:** everything chargeable is paid in points and points are a shop currency, so a self-serve account is pointed at a shop code or the shop's in-store link instead of a price it would be refused at — the app routes to its own "Link a paint shop" rather than out to the website. **Old shade codes still read:** a shop's retired code patterns now come down with its scheme, and `decodeShadeCodeAnyScheme` tries the live pattern first then each retired one, so a colour board from last season still finds its colour in catalogue search. **AI suggest** is included in the project rather than quota-billed, and comes back sized to the room (one masked wall → one colour), which the sheet already rendered correctly. Verified: `tsc` clean, eslint clean, 79 unit tests pass, `expo export` bundles (5.5 MB). ⚠️ Needs a running backend + device to exercise end-to-end. **Still open:** send-to-shop for signed-in customers (only the guest endpoint exists), guest project creation, Google OAuth, and the retailer/painter/distributor phases. |
| 2026-07-28 | Phase 1b | **Shop-code audit — the shop's numbering now holds everywhere a colour is shown.** Swept every surface in the app (and the website) where a shade code or paint name can reach a screen, against the shop's `/api/me/shade-code-scheme`. Three gaps closed here: the **AI palette sheet** labelled suggestions with the raw catalogue code; **catalogue search** sent the typed text straight to a backend that indexes the real code, so under a pattern the only code a customer could read was the only code that found nothing (added `decodeShadeCode` / `searchTermFor`, both tested); and the **shade detail sheet** showed catalogue prose that is generated from the shade's own name, reading it back out under a shop that hides names. Verified: `tsc` clean, eslint clean, 73 unit tests pass. Matching fixes went to the website (colour finder, shop combos, studio search + dock, and the whole colour library) and to the backend (the public share payload now carries the issuing shop's pattern and name choice — the share viewer has no session to resolve it from). |
| 2026-07-28 | Phase 1b | **Web-flow catch-up — the app now speaks the platform as it stands today.** Verified every backend change since the mobile base (2026-07-21 → 07-28) and carried the customer-facing ones across. **Entitlement:** `GET /api/me/entitlement` drives a projects-left / access-window card on Home, Projects and Account; running out offers **"Ask my shop"** (`POST /api/me/request-more-projects`), never a buy button — those projects were assigned and paid for by the shop. **Coded refusals:** `ASK_RETAILER`, `AUTO_MASK_UNAVAILABLE`, `SUBSCRIPTION_REQUIRED`, `IMAGE_LIMIT_REACHED` each become an action rather than red text. **View-only projects:** `readOnly` / `readOnlyReason` / `accessExpiresAt` / `reopenPricePaise` disable the palette and name the reopen price above the canvas. **Manual walls:** AUTO vs MANUAL mask mode, plus tap-to-mark via `POST .../segment/point` (free on every tier) and delete for hand-marked walls. **No-login redeem:** the Welcome code screen runs `POST /api/access-codes/redeem-account` and adopts the returned session. **Shop scoping:** the catalogue only offers companies the account may work with, and every code renders through the shop's `/api/me/shade-code-scheme` pattern with names hidden when the shop hides them. **Assigned products:** new screen over `GET /api/me/assigned-products` (brands, products, 1–10 brightness). Also: cleaned-image thumbnails, customer-room / view-only badges on the projects list, share links capped at 10 days, and a null e-mail handled for code-provisioned accounts. Verified: `tsc` clean, eslint clean, 66 unit tests pass, `expo export` bundles (5.5 MB). ⚠️ Needs a running backend + device to exercise end-to-end. **Payments stay on the web** (Razorpay Checkout; optional `EXPO_PUBLIC_WEB_ORIGIN` links out). **Still open:** send-to-shop for signed-in customers (only the guest endpoint exists), guest project creation, Google OAuth. |
| 2026-07-20 | — | Plan + visual design created. |
| 2026-07-20 | Phase 0 | Repo created (empty) by owner. Plan + design.html moved into this repo (previously in `HueVista/docs/mobile-app/`, now removed there). Next action: scaffold the Expo app. |
| 2026-07-21 | Phase 0 | **Phase 0 complete.** Scaffolded Expo SDK 57 (React 19, RN 0.86) + Expo Router. Added Midnight Spectrum theme + Space Grotesk fonts, UI kit (Button/Card/Pill/Input/SheetModal/StatTile/Meter/Text/Screen), typed API client (env base URL, error normalization, 401 single-flight refresh), zod schemas + auth API verified against backend `AuthController`/`AuthResponse`, secure session store (Keychain/Keystore) with launch restore. CI (typecheck+lint+test), README, `.env.example`. Verified: `tsc` clean, eslint clean, 16 unit tests pass, `expo export` bundles (1386 modules). Next: Phase 1 — recolor-engine spike, then Welcome/auth screens + customer core. |
| 2026-07-21 | Phase 1b | **Phase 1b-4 delivered — save-to-gallery + guest browse.** Editor "Save" captures the painted canvas (react-native-view-shot) → device Photos (expo-media-library, permission-gated). Extracted a shared `ShadeLibrary`; new guest browse screen (`app/(auth)/browse-shades.tsx`) over the public `/api/shades` endpoints, reachable from Welcome ("Browse shades without an account"), with a sign-up CTA. Verified: `tsc` clean, eslint clean, 43 unit tests pass, `expo export` bundles (5.4 MB). **Send-to-shop was investigated and skipped** — no matching endpoint exists in the current backend controllers; flagged for clarification rather than guessed. **True remaining tail:** send-to-shop (needs backend), guest project creation, tap-to-refine/manual walls, Google OAuth (needs owner OAuth client IDs) — plus the on-device validation pass across the whole camera→paint→share chain. |
| 2026-07-21 | Phase 1b | **Phase 1b-3 delivered — AI suggest, Share, access-code redeem.** Verified `ColorRecommendationController`, project `ShareResponse`, and `AccessCodeController`; built typed `recommendations.ts` / `accessCodes.ts` + `projects.share` + zod schemas + tests. Editor now has an **AI suggest** sheet (Claude's 3 palettes → tap to paint the selected wall; 402-aware) and **Share** (POST /share → OS share sheet). Account gained **"Link a paint shop"** (authed `POST /access-codes/redeem`, shows the linked shop). Verified: `tsc` clean, eslint clean, 43 unit tests pass, `expo export` bundles (5.4 MB). **Remaining Phase 1:** render-result-image + save-to-gallery, send-to-shop, guest browse/redeem, tap-to-refine/manual walls, Google OAuth. |
| 2026-07-21 | Phase 1b | **Phase 1b-2 delivered — camera → project → segmentation → editor.** Verified `ImageController` + `ProjectController`; built typed `images.ts`/`projects.ts` + zod schemas + tests. New-project capture flow (`app/new-project.tsx`, expo-image-picker camera+gallery → upload → create → editor; 422/400 handled). Live Projects list with authed thumbnails. Project editor (`app/project/[id].tsx`): triggers AUTO segmentation, polls status while SEGMENTING, handles FAILED/402, region chips + live shade tray + **multi-region composite recolor of real masks** (new Skia overlay shader + auth-fetched mask/photo loader) + per-swatch autosave (`PUT /regions`). Home CTA now starts the real camera flow. Verified: `tsc` clean, eslint clean, 37 unit tests pass, `expo export` bundles (5.4 MB). ⚠️ The camera/upload/segmentation/real-mask recolor path is wired to the verified contract but needs a running backend + device to exercise end-to-end. **Next (Phase 1b-3):** AI suggest, share + save-to-gallery, send-to-shop, guest browse, tap-to-refine/manual walls. |
| 2026-07-21 | Phase 1b | **Phase 1b-1 delivered — live shade catalogue.** Verified the `ShadeController` contract and built the typed shades client + zod schemas (`src/api/shades.ts`, `shadeSchemas.ts`): brands, paged list, families, detail, colour-match. New live Shades tab (`app/(customer)/shades.tsx`): server-side search + brand + family filters, infinite scroll, shade detail sheet with AI-enriched prose + "Try on wall". Offline catalogue cache via React Query persistence to AsyncStorage (`src/query/persist.ts`, shade queries only). Home popular-shades strip + visualizer "Try on wall" now use the live catalogue (sample set kept as offline/first-load fallback). Verified: `tsc` clean, eslint clean, 31 unit tests pass, `expo export` bundles (5.3 MB). **Next (Phase 1b-2):** camera → `POST /api/images/upload` → project create → segmentation polling → real-mask visualizer editor → share/send-to-shop → guest browse. |
| 2026-07-21 | Phase 1a | **Phase 1a delivered.** Recolor engine: Skia luminance-preserving SkSL shader + `RecolorCanvas` (`src/engine/`) with unit-tested colour math; bundled sample room/mask (procedurally generated). Visualize spike screen recolors the wall live with a shade tray + press-and-hold compare. Full auth flow (Welcome / Sign in / Register / Forgot password) against the verified backend. Role router + auth gate (`app/_layout.tsx`) routes CUSTOMER → tabs, other roles → coming-soon. Customer tab shell: Home (CTA), Shades (local sample: search + brand filter + Try-on-wall), Projects (empty state), Account (profile + sign-out). Verified: `tsc` clean, eslint clean, 22 unit tests pass, `expo export` bundles (5.2 MB Hermes). **Pending:** on-device framerate check for the engine (owner's phone); Google OAuth; and Phase 1b — camera → upload → AI segmentation → full visualizer editor → live `/api/shades` → share/send-to-shop → guest browse. |

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
   chips (Main wall / Left wall / Ceiling / + tap to add), horizontal shade
   tray, "AI suggest" + "Share" actions, auto-save indicator
7. **Shade library** — search, brand chips, mood/family chips, swatch grid,
   shade detail card with "Try on wall"
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
(or platform mono) for shade codes, access codes, prices.

**Shape language:** cards radius 13, buttons radius 11, pills fully rounded,
status pills are UPPERCASE mono 8–10pt. Status colors: NEW=accent,
IN PROGRESS/EXPIRING=warning, DONE/ACTIVE=success, EXPIRED/OVERDUE=danger.

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
| Shade catalogue | `GET /api/shades`, `/api/shades/{brand}`, `/{brand}/families`, `/{brand}/{code}` (`paint/`) |
| Projects | `POST/GET /api/projects`, `GET /api/projects/{id}`, `PUT .../regions`, `POST .../segment` (async — poll `GET .../status`), `POST .../segment/point` (SAM2 click refine), region mask endpoints, `POST .../send-to-shop`, `POST .../share` → `GET /api/shared/{token}` (`project/`) |
| AI recommendations | `POST /api/projects/{projectId}/recommendations` (`ai/`) |
| Billing | `POST /api/billing/subscriptions`, `GET /api/billing/subscriptions/current`, project-credit endpoints (`billing/`) — Razorpay |
| Orgs & access codes | `POST /api/organizations`, `POST /api/organizations/{orgId}/access-codes`, `POST /api/access-codes/redeem` (`account/`) |
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
- [x] Access-code redeem (`POST /api/access-codes/redeem`) incl. linked-shop card — wired as an **Account → "Link a paint shop"** action (redeem requires a signed-in user; shows the linked shop on success). The signed-out Welcome `redeem-code` screen stays a placeholder until the public guest-redeem flow ships.
- [x] Role router: on session start, mount tab navigator for the account's role (customer first; other roles show a "coming in phase 2/3" placeholder screen) — auth gate in `app/_layout.tsx` + `app/coming-soon.tsx`
- [x] Customer home: CTA, recent projects, AI picks strip — `app/(customer)/home.tsx` (CTA + **live popular shades strip**; recent projects + AI picks are empty-state placeholders until the project/recommendation APIs are wired)
- [x] Camera capture + gallery pick → `POST /api/images/upload` → create project — `app/new-project.tsx` via expo-image-picker (OS camera + gallery); handles the 422 "not a room" + 400 size/type rejections. (Custom full-screen camera with a wall-detection overlay is later polish.)
- [x] Segmentation flow: trigger `POST .../segment`, poll status, handle failure — editor triggers AUTO segmentation, polls `GET /status` every 2 s while `SEGMENTING`, surfaces `FAILED` + reason with retry, and 402 no-credits. (Tap-to-refine `segment/point` + manual wall marking still to come.)
- [x] Visualizer editor: region chips, shade tray, auto-save regions (`PUT .../regions`) — `app/project/[id].tsx`: region chips, live shade tray, **multi-region composite recolor of the real masks** (Skia overlay shader + auth-fetched mask PNGs), per-swatch autosave. ⚠️ **Real-mask recolor + segmentation need a running backend + device to validate** (not exercisable in CI). Before/after compare currently lives in the engine spike.
- [x] Shade library: search + brand/family filters against `/api/shades`, offline cache — **live** (`app/(customer)/shades.tsx`): server-side search + brand + family filters, infinite scroll via `/api/shades/paged`, shade detail sheet via `/{brand}/{code}` (AI-enriched), and React Query offline persistence of the catalogue (`src/query/persist.ts`). Contract verified against `ShadeController`.
- [x] "Try on wall" from any shade → visualizer with shade preselected — via route param (sample shades); carries over to the live catalogue
- [x] AI suggest: `POST .../recommendations` surfaced in editor — "AI suggest" opens a sheet of Claude's three palettes (primary/accent/trim, matched to real shades); tapping a colour paints the selected wall. Handles the 402 quota case. Contract verified against `ColorRecommendationController`.
- [x] Projects list + detail (resume editing) — live list (`app/(customer)/projects.tsx`, `GET /api/projects` with authed thumbnails) + the editor as detail (persisted region colours reload). Contract verified against `ProjectController`.
- [x] Share: native share sheet + share link (`POST .../share`) + save-to-gallery — editor "Share" generates a 7-day link (OS share sheet, WhatsApp etc.); "Save" captures the painted canvas (react-native-view-shot) and writes it to Photos (expo-media-library).
- [ ] "Send to shop for a quote" — ⚠️ **no matching backend endpoint** found in the current controllers (`ProjectController` / store / account) despite the §5 map. `ProjectResponse.sentToShopAt` exists, so the setter lives somewhere not yet located or needs a backend addition — **needs clarification before wiring** (didn't guess).
- [x] Guest browse mode (shade library only) — `app/(auth)/browse-shades.tsx` via the shared `ShadeLibrary` over the **public** `/api/shades` endpoints; reachable from Welcome, with a sign-up CTA on "Try on wall". (Guest *project creation* via `/api/access-codes/redeem-guest` + `/api/guest/*` is still pending.)

### Phase 2 — Retailer counter mode (the subscriber)

- [ ] Retailer tab navigator + counter dashboard (quota via billing endpoints, stat tiles, activity feed)
- [ ] "New walk-in visualization" fast path (photo → shades → send, minimal taps)
- [ ] Access codes: list with status, create sheet (3/7/14 days), WhatsApp hand-off
- [ ] Orders list (store module) with status updates
- [ ] Painters tab: invite painter (link generation + share), painter list
- [ ] Subscription screen: current plan, renew/upgrade via Razorpay checkout SDK
- [ ] Push notifications: backend device-token registration (§9), then — shared-look opened, new order, renewal reminder
- [ ] Retailer onboarding polish: empty states that teach the walk-in flow

### Phase 3 — Painter & distributor (the network)

- [ ] Painter invite deep link → redeem (`POST /api/painter-invitations/redeem`) → painter role
- [ ] Painter jobs list (`GET /api/jobs/mine/painter`) with status pills
- [ ] Job detail: approved shades + litres, address (open in maps), accept/decline/start/complete actions, site photo upload
- [ ] Painter earnings screen (wallet endpoints)
- [ ] Painter gets the visualizer (same customer engine, painter context)
- [ ] Distributor navigator: network dashboard (org hierarchy endpoints), retailer health, renewals due
- [ ] Distributor: invite retailer flow; codes + reports tabs
- [ ] Support chat screen (all roles) against `/api/support/*`
- [ ] Notifications inbox screen (mirror of website inbox)

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
| 2026-07-20 | — | Plan + visual design created. |
| 2026-07-20 | Phase 0 | Repo created (empty) by owner. Plan + design.html moved into this repo (previously in `HueVista/docs/mobile-app/`, now removed there). Next action: scaffold the Expo app. |
| 2026-07-21 | Phase 0 | **Phase 0 complete.** Scaffolded Expo SDK 57 (React 19, RN 0.86) + Expo Router. Added Midnight Spectrum theme + Space Grotesk fonts, UI kit (Button/Card/Pill/Input/SheetModal/StatTile/Meter/Text/Screen), typed API client (env base URL, error normalization, 401 single-flight refresh), zod schemas + auth API verified against backend `AuthController`/`AuthResponse`, secure session store (Keychain/Keystore) with launch restore. CI (typecheck+lint+test), README, `.env.example`. Verified: `tsc` clean, eslint clean, 16 unit tests pass, `expo export` bundles (1386 modules). Next: Phase 1 — recolor-engine spike, then Welcome/auth screens + customer core. |
| 2026-07-21 | Phase 1b | **Phase 1b-4 delivered — save-to-gallery + guest browse.** Editor "Save" captures the painted canvas (react-native-view-shot) → device Photos (expo-media-library, permission-gated). Extracted a shared `ShadeLibrary`; new guest browse screen (`app/(auth)/browse-shades.tsx`) over the public `/api/shades` endpoints, reachable from Welcome ("Browse shades without an account"), with a sign-up CTA. Verified: `tsc` clean, eslint clean, 43 unit tests pass, `expo export` bundles (5.4 MB). **Send-to-shop was investigated and skipped** — no matching endpoint exists in the current backend controllers; flagged for clarification rather than guessed. **True remaining tail:** send-to-shop (needs backend), guest project creation, tap-to-refine/manual walls, Google OAuth (needs owner OAuth client IDs) — plus the on-device validation pass across the whole camera→paint→share chain. |
| 2026-07-21 | Phase 1b | **Phase 1b-3 delivered — AI suggest, Share, access-code redeem.** Verified `ColorRecommendationController`, project `ShareResponse`, and `AccessCodeController`; built typed `recommendations.ts` / `accessCodes.ts` + `projects.share` + zod schemas + tests. Editor now has an **AI suggest** sheet (Claude's 3 palettes → tap to paint the selected wall; 402-aware) and **Share** (POST /share → OS share sheet). Account gained **"Link a paint shop"** (authed `POST /access-codes/redeem`, shows the linked shop). Verified: `tsc` clean, eslint clean, 43 unit tests pass, `expo export` bundles (5.4 MB). **Remaining Phase 1:** render-result-image + save-to-gallery, send-to-shop, guest browse/redeem, tap-to-refine/manual walls, Google OAuth. |
| 2026-07-21 | Phase 1b | **Phase 1b-2 delivered — camera → project → segmentation → editor.** Verified `ImageController` + `ProjectController`; built typed `images.ts`/`projects.ts` + zod schemas + tests. New-project capture flow (`app/new-project.tsx`, expo-image-picker camera+gallery → upload → create → editor; 422/400 handled). Live Projects list with authed thumbnails. Project editor (`app/project/[id].tsx`): triggers AUTO segmentation, polls status while SEGMENTING, handles FAILED/402, region chips + live shade tray + **multi-region composite recolor of real masks** (new Skia overlay shader + auth-fetched mask/photo loader) + per-swatch autosave (`PUT /regions`). Home CTA now starts the real camera flow. Verified: `tsc` clean, eslint clean, 37 unit tests pass, `expo export` bundles (5.4 MB). ⚠️ The camera/upload/segmentation/real-mask recolor path is wired to the verified contract but needs a running backend + device to exercise end-to-end. **Next (Phase 1b-3):** AI suggest, share + save-to-gallery, send-to-shop, guest browse, tap-to-refine/manual walls. |
| 2026-07-21 | Phase 1b | **Phase 1b-1 delivered — live shade catalogue.** Verified the `ShadeController` contract and built the typed shades client + zod schemas (`src/api/shades.ts`, `shadeSchemas.ts`): brands, paged list, families, detail, colour-match. New live Shades tab (`app/(customer)/shades.tsx`): server-side search + brand + family filters, infinite scroll, shade detail sheet with AI-enriched prose + "Try on wall". Offline catalogue cache via React Query persistence to AsyncStorage (`src/query/persist.ts`, shade queries only). Home popular-shades strip + visualizer "Try on wall" now use the live catalogue (sample set kept as offline/first-load fallback). Verified: `tsc` clean, eslint clean, 31 unit tests pass, `expo export` bundles (5.3 MB). **Next (Phase 1b-2):** camera → `POST /api/images/upload` → project create → segmentation polling → real-mask visualizer editor → share/send-to-shop → guest browse. |
| 2026-07-21 | Phase 1a | **Phase 1a delivered.** Recolor engine: Skia luminance-preserving SkSL shader + `RecolorCanvas` (`src/engine/`) with unit-tested colour math; bundled sample room/mask (procedurally generated). Visualize spike screen recolors the wall live with a shade tray + press-and-hold compare. Full auth flow (Welcome / Sign in / Register / Forgot password) against the verified backend. Role router + auth gate (`app/_layout.tsx`) routes CUSTOMER → tabs, other roles → coming-soon. Customer tab shell: Home (CTA), Shades (local sample: search + brand filter + Try-on-wall), Projects (empty state), Account (profile + sign-out). Verified: `tsc` clean, eslint clean, 22 unit tests pass, `expo export` bundles (5.2 MB Hermes). **Pending:** on-device framerate check for the engine (owner's phone); Google OAuth; and Phase 1b — camera → upload → AI segmentation → full visualizer editor → live `/api/shades` → share/send-to-shop → guest browse. |

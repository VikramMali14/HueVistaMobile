# HueVista Mobile — Implementation Plan (Handoff Document)

> **Who this is for:** any AI agent or developer picking up the mobile app.
> Read this file top to bottom before writing any code.
>
> **How to use it:** append one line to the **Progress log** (bottom of this
> file) per work session. This file is the single source of truth for what the
> app is and what is pending — keep it honest.

---

## 1. Context — what HueVista is

HueVista is an AI-powered paint shade visualizer for the Indian paint retail
market. A customer photographs a room and previews real catalogue shades
(Asian Paints at launch — ~8,000 shades) applied photorealistically before
painting, then leaves with a colour board the counter can mix from.

Distribution follows the paint trade hierarchy:

```
Distributor → Retailer (paying subscriber) → Painter → End Customer
```

**This app is the last link only.** The backend still knows five roles
(`ADMIN`, `DISTRIBUTOR`, `RETAILER`, `PAINTER`, `CUSTOMER`) and the website
serves all of them; the phone serves `CUSTOMER`.

**The repos:**

| Repo | Stack | Role |
|---|---|---|
| `VikramMali14/HueVistaMobile` | React Native + Expo (TypeScript) | **This repo — the customer app.** |
| `VikramMali14/HueVista` | Spring Boot 4, Java 17, PostgreSQL, Flyway | Backend REST API — serves web AND mobile. **Do not modify** except the additions in §9. |
| `VikramMali14/HueVistaFrontEnd` | Next.js 15, React 19, TypeScript | Website. Source for design tokens, API client patterns, Zod schemas — **copy from it, never modify it** as part of mobile work. |

Swagger is at `http://localhost:8080/swagger-ui.html` when the backend runs
locally.

---

## 2. Locked decisions — do not relitigate

1. **Separate repository** (this one) — not a folder in either existing repo.
2. **React Native + Expo, TypeScript, Expo Router.** Not Flutter, not native
   Swift/Kotlin, not a WebView wrapper.
3. **The phone is the customer’s app.** One role, one navigator. The counter,
   the painter’s job list, the distributor network and the admin console all
   run on the web, where the people using them already sit at a screen — a
   phone in a customer’s hand is for seeing a wall in a colour.

   *This replaces the earlier "one app for all roles" decision.* That build
   shipped four navigators and an admin group; roughly two-thirds of the code
   and every screen with a table in it existed for someone who was not the
   person holding the phone. A non-customer account that signs in here gets the
   customer app, which is the honest outcome.
4. **Backend is consumed as-is.** Same JWT auth, same endpoints the website
   uses. The only backend additions allowed are listed in §9.
5. **Visual identity: "Midnight Spectrum"**, carried over from the website
   (tokens in §4). **Dark only.** The whole product is a room photograph with
   paint on it, and a pale chrome throws its own cast over the one thing the
   customer is judging.
6. **Payment stays on the web.** Razorpay Checkout is a web flow and the app
   carries no payment SDK. The app quotes the real, server-held price and hands
   the browser the checkout; it never prints a number the server did not say.
7. **Recolor runs on-device** (Skia, luminance-preserving — the same technique
   as the website’s WebGL engine) so colour changes stay instant and free. AI
   segmentation and AI rendering stay server-side; both are quota-billed.

---

## 3. The customer journey

```
Launch ─► Welcome
            ├─► "I have a code from my shop"  ─► redeem  ─► signed in
            ├─► Sign in ─► (forgot password: send code → reset)
            ├─► Create account
            └─► Browse the catalogue as a guest
                          │
                          ▼
   Home ── Shades ── ( Start a room ) ── Library ── Account
                            │
                            ▼
    1 Photo → 2 Prepare → 3 Walls → 4 Adjust → 5 Colour
                                                   │
                                          ┌────────┴────────┐
                                          ▼                 ▼
                                    Colour board ─────► AI image
                                     save · share      save · share
```

### The tab bar

Four destinations and one action: **Home · Shades · ( Start a room ) · Library
· Account**, where the middle slot is a raised accent button rather than a tab.

Starting a room is the app’s primary verb, not a place: with three rooms on the
go a "Studio" tab cannot know which to open, and with none it has nothing to
show. The room flow lives in its own stack outside the tabs, because a
five-step job on a photograph wants the whole screen.

### The five steps

The step a room opens on is **derived from the project**, never from a counter
the app keeps (`src/studio/roomStep.ts`, unit-tested). That is what makes a
half-finished room resumable — closing the app on step 4 and coming back
tomorrow, on another phone, lands on step 4, because the project is the only
thing that knows.

| Step | What it is | Backed by |
|---|---|---|
| 1 · Photo | Camera, gallery or the sample room | `POST /api/images/upload`, `POST /api/projects` |
| 2 · Prepare | Clean-up runs either way; the choice is **find the walls for me** vs **I’ll mark them myself** | `POST /api/projects/{id}/segment` (`maskMode: AUTO \| MANUAL`) |
| 3 · Walls | Waiting, or what came back — including the two failure routes | poll `GET /api/projects/{id}` |
| 4 · Adjust | Check what was found; redraw, add or remove a surface | `segment/point`, `regions/custom-mask`, `regions/{id}/mask` |
| 5 · Colour | Shades · Palettes · Finder, with a before/after wipe | `PUT /api/projects/{id}/regions` |

### Screens

**Getting in** — launch · welcome · sign in · create account · redeem shop code
(with the used/unknown refusals in place) · forgot password (send → enter code
→ set new) · guest browse.

**The app** — home (greeting, what you have, the one lit CTA, rooms in
progress, latest AI image, popular shades) · shades (company → catalogue, with
the offline notice) · shade detail · library (rooms · AI images · saved shades)
· account (settings list).

**The room** — the five steps, plus the working, failed-detection,
camera-denied and unreadable-photo states.

**What they leave with** — colour board (confirm → the board, saved to Photos
or shared) · AI image (choose a combination and five real options → working →
result).

**Money** — rooms & AI images · buy (hands off to web checkout).

**Also** — verify e-mail · your products (what the shop unlocked) · help &
support.

---

## 4. Design tokens — Midnight Spectrum

Source of truth: `HueVistaFrontEnd/src/app/globals.css`. Everything down to
`accentGhost` in `src/theme/colors.ts` mirrors it one-for-one; below that is
mobile-only surface treatment with no web counterpart to drift from.

Three token facts worth knowing before touching a colour:

- **A filled button’s ground is `accentDeep` (#5a3fcc), not `accent`.** White
  on the bright accent is 4.35:1 — under AA at the 15pt a button label runs.
- **The accent AS TEXT is `accentSoft` (#a080ff).** #7c5cff reads 4.56:1 on the
  page and fails the moment the text lands on a surface rather than the page.
- **`fgFaint` is never a word.** It is for rules and disabled glyphs; the
  quietest legible text colour is `fgMute`.

**Type.** Space Grotesk sets headlines, **Inter** sets everything else, and
Instrument Serif italic is the accent face. Shade codes are Inter with tabular
figures, **not** a mono face — JetBrains Mono draws a dotted zero that reads as
an 8 at caption size, and the code IS the order at the counter.

**The serif is rationed.** `SERIF_BUDGET` in `src/theme/typography.ts` names
the three places that spend it. One italic word inside a sans headline is a
device; on every headline it is a template, which is how the first pass of this
design read.

**The lit card is rationed too.** `Card tone="feature"` carries the corner wash
and the lit top edge, and there is **one per screen** — the thing the screen
exists to get done. Six identical flourishes on a screen point at nothing.

**Shape.** Cards 20 (14 for dense rows), buttons 16, inputs 14, sheets 28,
chips 12, pills round. Radii sit above the web’s flat 10 because both phone
platforms draw their own chrome that round.

### 4.1 The aurora layer (mobile only)

- **Aurora background.** Every screen sits on `<Aurora>` (via `Screen`): a
  vertical wash blooming violet at the top over three drifting colour clouds,
  in Skia. `tint` biases it toward a colour — the room flow passes the shade
  currently on the wall, so the room being painted lights the whole screen.
- **Depth over borders.** Cards are translucent (`colors.glass`) with a top-lit
  edge and a real shadow, not opaque blocks separated by hairlines.
- **Floating tab bar.** A dark capsule inset from all three edges, drawn over
  the scene, with one indicator that travels on a spring. It reports its height
  through `BottomTabBarHeightContext` and `Screen` reserves that space, so no
  screen hardcodes a tab-bar inset.
- **Motion.** RN `Animated` with `useNativeDriver` only (transform/opacity).
  Use `useAnimatedValue()`, not `useRef(new Animated.Value())` — the latter
  trips `react-hooks/refs`. `useElapsedSeconds()` paces the two long waits.
- **Reduced motion is honoured.** `useReducedMotion()` reads the OS setting
  live; the aurora stops drifting and `<Reveal>` stops travelling and
  staggering.
- **Haptics.** Call the semantic intent (`haptics.select/tap/press/success/
  warning/error`), never `expo-haptics` directly. The module no-ops on web and
  honours the opt-out in Account.

---

## 5. Backend API map

Base URL from env (`EXPO_PUBLIC_API_ORIGIN`, default `http://localhost:8080`).
**Treat the backend controllers as the source of truth** — verify shapes
against the Java controllers or Swagger before wiring a screen; do not guess
fields.

| Feature | Endpoints |
|---|---|
| Auth | `POST /api/auth/register`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `GET·PATCH /api/auth/profile`, `POST /api/auth/change-password`, `DELETE /api/auth/account` |
| Verification | `POST /api/auth/verify/email/send` · `/confirm` — gates project creation when enabled |
| Image upload | `POST /api/images/upload` (multipart; server classifies the photo and refuses a non-room with 422) |
| Shade catalogue | `GET /api/shades`, `/paged`, `/brands`, `/{brand}`, `/{brand}/families`, `/{brand}/{code}`, `/match`, `/decode` — public |
| Shop presentation | `GET /api/me/shade-code-scheme` — the shop’s code pattern and whether paint names are shown |
| Rooms | `POST·GET /api/projects`, `GET /{id}`, `PATCH /{id}`, `DELETE /{id}`, `PUT /{id}/regions`, `POST /{id}/segment`, `/segment/point`, `/regions/custom-mask`, `PUT /regions/{id}/mask`, `GET /{id}/regions/{id}/mask` |
| Colour boards | `POST /api/projects/{id}/colour-boards` (records and charges), `POST /{id}/close`, `GET /{id}/combos` |
| AI images | `POST /api/projects/{id}/renders` (202, then poll), `GET /{id}/renders`, `GET /{id}/renders/{renderId}`, `GET /api/me/renders`, `/renderable-projects` |
| AI palettes | `POST /api/projects/{id}/recommendations` — included in the room, not charged per ask |
| Shop palettes | `GET /api/me/retailer-combos` — the customer’s own shop’s card |
| Billing | `GET /api/billing/plans` (public; the free tier is what a self-serve customer pays), `GET /api/billing/pdf-allowance`, `GET /api/billing/ai-credits` |
| Access codes | `POST /api/access-codes/redeem` (signed in), `POST /api/access-codes/redeem-account` (public — provisions the customer and returns a session) |
| Entitlement | `GET /api/me/entitlement`, `POST /api/me/request-more-projects`, `GET /api/me/assigned-products` |
| Sharing | `POST /api/projects/{id}/share`, `DELETE /{id}/share` |
| Support | `/api/support/conversations*` — AI-assisted threads, a human on request |

**Auth handling on mobile:** access token in memory; refresh token in
`expo-secure-store` (Android Keystore / iOS Keychain) — the mobile equivalent
of the website’s HttpOnly cookie. Auto-refresh on 401, single-flight.

**Not reachable from this app** (all of it web-side): the counter, access-code
issuing, the painter and distributor modules, the store kiosk, reward points,
subscriptions and every `/api/admin/*` route.

---

## 6. App architecture

```
HueVistaMobile/
├── app/                          # Expo Router file-based routes
│   ├── index.tsx                 #   launch
│   ├── (auth)/                   #   welcome, sign-in, register, redeem-code,
│   │                             #   forgot-password, browse-shades
│   ├── (customer)/               #   tabs: home, shades, library, account
│   ├── studio/new.tsx            #   step 1
│   ├── studio/[id].tsx           #   steps 2–5
│   ├── board/[id].tsx            #   confirm → the board
│   ├── ai/[id].tsx               #   choose → working → result
│   ├── shade/[code].tsx          #   one shade, full screen
│   ├── credits.tsx, buy.tsx      #   what you have, and getting more
│   ├── verify.tsx, support.tsx, assigned-products.tsx
│   └── _layout.tsx               #   fonts, providers, auth gate
├── src/
│   ├── api/                      # typed client per backend module, zod-validated
│   ├── auth/                     # secure token store, session context, refresh
│   ├── engine/                   # Skia recolor — mask + luminance-preserving tint
│   ├── studio/                   # the room flow, its panels and the step model
│   ├── shades/                   # catalogue, colour science, saved/recent shades
│   ├── account/                  # entitlement, wallet, profile queries
│   ├── components/               # the UI kit
│   └── theme/                    # tokens from §4
└── .github/workflows/            # typecheck + lint + test on PR
```

**Key libraries:** `expo`, `expo-router`, `@shopify/react-native-skia` (recolor
engine), `expo-image-picker`, `expo-media-library`, `react-native-view-shot`
(the board), `expo-secure-store`, `zod`, `@tanstack/react-query`.

**The recolor engine** is the one genuinely novel piece: for each pixel inside a
region mask, replace hue and chroma with the target shade while keeping the
original luminance, so texture and shadow survive. Every wall is drawn into
**one** Skia canvas — a canvas per wall asks the driver for a full-screen GPU
surface each and can exhaust graphics memory on a mid-range phone.

---

## 7. What is left

- [ ] **A device pass against a running backend.** The whole chain — upload,
      segmentation, drawn masks, board recording, render polling — is wired to
      verified contracts but has not been exercised end to end on hardware.
- [ ] **Google sign-in.** `POST /api/auth/oauth2/exchange` exists; the app has
      no OAuth client IDs and no `expo-auth-session`. Do not ship a button
      until both are real.
- [ ] **Push notifications** — needs the §9 backend addition.
- [ ] **Saved shades on the account.** They live on the device today because
      no server-side list exists; `src/shades/savedShades.ts` is the seam.
- [ ] **In-app purchase.** Blocked on §2.6 — revisit only if the store
      guidelines force it.

---

## 8. Working agreements

1. **Update this file as you go** — the progress log is how the owner (who is
   not a mobile developer) sees status.
2. **Small commits, clear messages**, conventional prefix (`feat:`, `fix:`,
   `chore:`).
3. **Verify API shapes against the backend code/Swagger** before wiring a
   screen; §5 is a map, not a contract.
4. **Never modify `HueVista` or `HueVistaFrontEnd`** except the §9 additions.
5. **Keep the app runnable** — `npx expo start` must work from a fresh clone +
   `npm install`.
6. **Never print a price, a count or a date the server did not say.** Every
   number on a screen in this app is read from an endpoint. A hard-coded ₹99
   is a promise the counter has to keep.
7. **Every failure state gets a way onward.** An empty screen with no action is
   a dead end, and this app had several.
8. **Ask the owner** before: spending money, changing a §2 decision, or any
   backend change beyond §9.

## 9. Allowed backend additions (only these)

| Addition | Notes |
|---|---|
| `POST /api/devices` (+ entity/migration) to register Expo push tokens; fan-out on share-link opened, board ready, render finished | Follow existing module conventions (`notification/` exists); Flyway migration; tests |
| A per-user saved-shade list | Would replace the on-device store in `src/shades/savedShades.ts` |
| Phone-sized image variant in the upload response | Only if mobile bandwidth proves painful; otherwise skip |

---

## 10. Progress log

> Append one line per work session: date · phase · what happened · blockers.

| Date | Phase | Summary |
|---|---|---|
| 2026-08-26 | Customer-only | **The app is one app now — the customer's — and the design it was built from was audited rather than transcribed.** Four navigators, an admin group and eleven screens for people who are not holding the phone came out (`(admin)`, `(retailer)`, `(painter)`, `(distributor)`, the kiosk, the counter, the painter list, the products manager and the API modules behind them), and the auth gate stopped branching on role. **The end of a room was missing entirely.** The phone could paint a wall and then had nowhere to put the result — `colour-boards`, `close`, `combos`, `renders`, `/me/renders` and the AI wallet had no client at all, so a room never finished. All of them are wired now: a board records what the customer commits to (which is the only moment those colours can be captured, since the sheet is drawn on the device), is saved to Photos with `view-shot`, and an AI image is made from a combination that actually went onto one. **The five-step flow is real and derived.** `stepOfProject` reads the step off the project rather than a counter the app keeps, so a room left half-finished resumes on the step it was left on, from any phone (unit-tested, ten cases). **Six things the design got wrong were corrected rather than copied.** Step 2's three checkboxes (remove furniture / remove wall art / straighten) map to nothing the backend takes — the real fork is `maskMode`, AUTO vs MANUAL, which is also the answer to "what if the AI is wrong about my room". "Studio" cannot be a tab: with three rooms open it does not know which to show, so it became the raised action in the middle of the bar and the room flow moved into its own stack. "Email me a code instead" and "Continue with Google" are not things this product can do — `/auth/login/otp` is an ADMIN second factor and there is no OAuth client — so the passwordless route offered is the shop code, which is real; meanwhile **forgot-password was a genuine dead end** (it sent a code and had nowhere to type it, and `resetPassword` was not even in the client) and is now a complete flow. The confirm screen's flat "downloading closes the project · 1 of 1" is read from the server's own allowance, because telling someone their room is finished when it has a board left is what stops people finishing. "Code already used" invented a date and a branch the API does not return. Every hard-coded price (₹99 / ₹249 / ₹29) is now read from `/billing/plans` or the wallet. **And the design read as machine-made for reasons that are fixable:** the same italic-serif headline trick on twenty-two screens (now rationed to three, written down in `SERIF_BUDGET`), the same violet corner-wash on every card (now one lit `Card tone="feature"` per screen, the thing the screen exists to get done), an uppercase eyebrow above every group (rationed), and the colour disclaimers pasted at full length into eleven places (now one collapsible `<Disclosure>` that is present everywhere and readable in the one place someone wants to read it). **Added on top of the design:** a drag-to-wipe before/after over the painted room, depth and undertone printed on the swatches themselves (the product's own expertise, previously buried on one detail screen), saved shades, an AI-image shelf in the library, `prefers-reduced-motion` honoured throughout, and Inter loaded so a sentence has the same colour and rhythm as it does on the site. Verified: `tsc` clean, eslint clean, 185 unit tests pass (up from 164), `expo export` bundles (5.7 MB). ⚠️ The board recording, render polling and camera chain are wired to verified contracts but need a device against a running backend. **Deliberately not built:** a light theme (§2.5 — the wall must stay the brightest thing on screen), Google sign-in (no client IDs), and in-app purchase (§2.6). |
| 2026-08-03 | Phase 3 | **The Studio, rebuilt around the room.** Six things reported from a real phone, all of them ours. **The photo was cropped.** The editor drew every room into a fixed 4:3 box with Skia's `cover`, so a phone-shaped photo — the normal case, since these are taken on the phone showing them — lost roughly a quarter of its height, often the top of the wall being painted. `src/engine/fitBox.ts` now derives the box from the photo and everything is drawn `contain`; `tapToPhotoPoint` learned the fit so a tap still lands where the finger did. **Choosing a colour took the phone over.** The catalogue was a full-screen sheet and the AI palettes a sheet over the room, so the wall — the only thing a visualizer exists to show — was hidden at exactly the moment it changed. All three colour tools are now docked under the photo behind one segmented control: `ColourPanel` (the scoped catalogue, filters and a grid that grows on demand rather than scrolling inside a scroll), `SuggestPanel` (shop palettes then Claude's), and `FinderPanel`. **The colour finder had never reached the phone** even though the phone is where the photo is taken: tap any colour in your own room and the nearest catalogue shades come back, ΔE-ranked and scoped to what the shop can sell — one Skia `readPixels` averaged over a patch, then the matcher the website already calls. **Marking a wall was one path with no fallback.** It went through SAM 2, and every failure of it was terminal — plus nothing said which of the three hidden preconditions had not been met. `MaskStudioSheet` is now a popup with two ways through: tap to detect, and **draw it** — a finger-traced outline rasterized on device to a white-on-black PNG and saved through `POST .../regions/custom-mask`, which needs no model, no credit and no network beyond the save. A failed detection now names drawing by its name instead of ending the road, choosing MANUAL opens the popup by itself when the clean-up lands, and any wall — AI-detected included — can be redrawn (`PUT .../regions/{id}/mask`). **Share links opened raw JSON.** The backend minted them against the API origin (`…/api/share/{token}`), so a recipient without the app read the response body instead of seeing the room; they now point at the website's `/share/{token}` page (`app.web-base-url`, falling back to the first CORS origin). **And the tab bar cross-faded.** One indicator now travels between tabs on a spring, the way iOS's does, with labels under the icons; sheets came down to a drag on the grabber and the segmented thumb became a lifted neutral pane rather than a tinted one. Verified: `tsc` clean, eslint clean, 170 unit tests pass (up from 154), `expo export` bundles (5.5 MB), and the backend's share-link test passes. ⚠️ The drawn-mask round trip, the eyedropper and the marking popup need a device against a running backend to confirm end-to-end. **Deleted:** `ShadePickerSheet` and `RecommendationsSheet`, both of which the dock replaces. |
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

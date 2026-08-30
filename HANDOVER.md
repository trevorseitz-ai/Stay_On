# Stay On — Handover

Endless arcade night-driving game ("Stay On"), synthwave/outrun aesthetic. Native iOS app via Capacitor, plus a parallel web build. Last updated 2026-08-29 (Sentry + fastlane added).

## Directory map

- **`Stay_On_iOS/mobile/`** — the active iOS app (Capacitor 7, React + Vite). This is what ships to TestFlight/App Store. App ID `com.trevorseitz.stayon`.
- **`Stay_On_iOS/source/`** — parallel web build (Next.js/vinext-based), same game logic, **no ads/IAP** (gated out via `Capacitor.isNativePlatform()` checks since it's browser-only).
- **`Music/`** — Suno-generated soundtrack masters (WAV, licensed for commercial use) plus OGG/MP3 conversions. `Neon Drift Circuit` is the official in-game soundtrack.
- **`Source_Files/Stay_On_Source_v9/`** — an older archival snapshot of the web source, predates the music/IAP work in this doc. Not actively maintained; `Stay_On_iOS/source/` is the current one.
- `Stay_On_iOS-oldish/` no longer exists — it was the pre-rename version of `Stay_On_iOS/`, fully removed as of the 2026-08-21 commit.

## Core game logic

Both `Stay_On_iOS/mobile/src/App.tsx` and `Stay_On_iOS/source/app/page.tsx` contain near-duplicate implementations of the same canvas-based driving game (state machine: `ready → countdown → playing → crashed`). **When changing gameplay, audio, or ad logic, mirror the change in both files** unless it's native-only (ads/IAP are mobile-only, so those only touch `mobile/src/App.tsx`).

## What's implemented (as of 2026-08-23)

- **Soundtrack**: `Neon Drift Circuit.mp3` loops in the background (`public/audio/neon-drift-circuit.mp3` in both builds), starts on first touch (iOS autoplay requirement), toggled via a bottom-right speaker icon. Preference persists in `localStorage` (`stay-on-muted`).
- **Banner ad** (AdMob): always shown on native launch, unless the player owns the ad-free entitlement. Real ad unit: `ca-app-pub-4738248194115302/4821502245`.
- **Interstitial ad** (AdMob): shown after every 2nd crash (`INTERSTITIAL_RUN_INTERVAL = 2` in `App.tsx`), preloaded ahead of time so there's no load delay at the crash screen, skipped once ad-free is owned. Real approved ad unit: `ca-app-pub-4738248194115302/3809716597`.
- **"Remove Ads" IAP** (RevenueCat, `@revenuecat/purchases-capacitor@11.3.2` — pinned below v12 because v12+ requires Capacitor 8, this project is on Capacitor 7): one-time non-consumable purchase ($2.99), button + "Restore purchase" link on the crash screen. **Fully wired and verified working end-to-end** via sandbox purchase test on a real device (2026-08-23): real RevenueCat API key in place, Apple product `com.trevorseitz.stayon.removeads` created in App Store Connect and imported/attached to the `ad_free` entitlement in RevenueCat, package matched via `current?.lifetime` (RevenueCat auto-assigns lifetime packages the reserved identifier `$rc_lifetime` — don't try to match on a custom package name string).
  - The button label shows the localized store price when the offering loads (`REMOVE ADS · $2.99`, from the package's `product.priceString`), falling back to a plain `REMOVE ADS` label. Price is fetched once during `initPurchases` into the `adFreePrice` state.
  - As of 2026-08-29: package lookup goes through an `adFreePackage()` helper (`offering.lifetime ?? availablePackages[0] ?? null`) so a dashboard slot mismatch can't disable the button; `Purchases.setLogLevel` is set (DEBUG in dev, INFO in prod) so TestFlight offering failures are diagnosable in device logs.
  - `ios/App/StayOn.storekit` + the committed shared `App.xcscheme` (`ios/App/App.xcodeproj/xcshareddata/xcschemes/`) let the **simulator** load the offering and run a StoreKit *test* purchase — but only when launched from Xcode (Run the App scheme). A plain `xcodebuild`/`simctl` launch does not apply the StoreKit config, so the button falls back to the label with no price there. Release builds ignore the `.storekit` file entirely.
- **Steering hint on crash screen**: the decorative steering-wheel hint (`.steering-control` + "PLACE THUMB HERE") is now hidden whenever `showFeedback` is true, so it no longer overlaps the Quick Feedback / Remove Ads buttons on the crash screen. Mobile-only change (`mobile/src/App.tsx`).
- App Store Connect **Paid Apps Agreement + tax/banking** are now signed/submitted (previously only had the Free Apps Agreement, which silently blocks StoreKit from returning any IAP product — this was the root cause of a long RevenueCat error 23 "offerings empty" debugging session before it resolved).
- **Difficulty levels** (2026-08-29): Easy / Medium / Hard segmented picker shown on the ready + crash screens (hidden mid-run), selection persisted in `localStorage` (`stay-on-difficulty`, default `easy`). Each difficulty sets the level the run *starts* on — displayed LEVEL 1 / 5 / 10 (`DIFFICULTY_START_LEVEL` = 0 / 4 / 9, 0-indexed — Hard starts fast but not at the 420 speed cap). The in-run level-up formula became `startLevel + Math.floor(distance / 3000)`, so speed/road-narrowing scale off the elevated start. Top speed caps (420) by ~LEVEL 4 and road width bottoms out (118px) by ~LEVEL 11–12 on a typical phone; past that, `roadCenter()` adds a continuous secondary sine "weave" (ramps in over `progress` 27k→51k where `progress = startLevel*3000 + worldY`, capped to remaining on-screen headroom) so higher levels keep getting harder via more/sharper turns rather than plateauing. Mirrored in both `mobile/src/App.tsx` and `source/app/page.tsx` (+ `.difficulty-select` CSS in `mobile/src/styles.css` and `source/app/globals.css`). Mobile emits `difficulty_changed`, and adds `difficulty` / `start_level` to `run_started` + `run_ended` PostHog events.
- **Crash sound**: a synthesized noise-burst + low-frequency "thud" (Web Audio API, `AudioContext` — no external audio asset) plays the instant the car crashes, in both `mobile/src/App.tsx` and `source/app/page.tsx`. Respects the existing mute toggle via a `mutedRef` (the mute `useState` isn't in the main game effect's dependency array, so a ref mirrors it for the closure to read live). The `AudioContext` is created lazily on first crash and closed on effect cleanup.

## Observability & tooling (added 2026-08-29, mobile build only)

- **Sentry crash reporting**: `@sentry/capacitor` + `@sentry/react`, initialized in `mobile/src/main.tsx`, DSN-gated on `VITE_SENTRY_DSN` (in `mobile/.env`, git-ignored). Native iOS crashes captured automatically by the Capacitor plugin; JS errors via the React SDK. Sentry project `stay-on` under org `personal-evw`. **`@sentry/react` is pinned to the exact version in `@sentry/capacitor`'s `peerDependencies`** (currently `10.69.0`) — a floating `@latest` pulls a duplicate nested `@sentry/browser` and breaks `tsc` with a TS2345 in `main.tsx`. Re-pin on any bump.
- **Sentry source maps**: `@sentry/vite-plugin` in `mobile/vite.config.ts` uploads maps on every build where `SENTRY_AUTH_TOKEN` is set (org auth token, `org:ci` scope, in `mobile/.env`), then deletes the `.map` files from `dist` so they never ship. `build.sourcemap` is gated on the token — no token, no maps emitted. CI/other machines skip the upload silently.
- **iOS deployment target bumped 14.0 → 15.0** (`mobile/ios/App/Podfile`) — `SentryCapacitor` requires 15. iOS 15 covers the same device list as 14, and the app target was already 18.6, so zero user impact.
- **fastlane** (`mobile/ios/App/fastlane/`): lanes `sync_web`, `bump` (build number → UTC timestamp), `build` (signed App Store `.ipa` → `./build`), `beta` (sync_web → bump → build → TestFlight upload), `auth_check` (verifies ASC API key — confirmed working 2026-08-29). Auth is via App Store Connect API key; setup notes are the comment block at the top of the `Fastfile`. Credentials go in `mobile/ios/App/fastlane/.env` (git-ignored): `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH`. Gems vendored to `vendor/bundle` (git-ignored); run via `bundle exec fastlane <lane>`. `fastlane/README.md` is auto-generated — don't hand-edit.
- **MCP servers** added to `~/.claude.json` (user scope): `sentry` (`https://mcp.sentry.dev/mcp`) and `revenuecat` (`https://mcp.revenuecat.ai/mcp`). Both need a one-time `/mcp` auth after a Claude Code restart (Sentry: browser OAuth; RevenueCat: v2 secret key).

## Remaining before wide release

- The public App Store listing itself is not yet approved — last submission (build 8) showed "Ready for Review" with unresolved issues in App Store Connect as of 2026-08-23. Only TestFlight beta access (build 4) had cleared. Check current status in App Store Connect → Distribution before assuming this is live.
- IAP screenshot for App Store review must be an exact native resolution from Apple's accepted list (1260×2736, 1290×2796, or 1320×2868 portrait) — a Simulator screenshot via Cmd+S on a Pro Max/Plus/Air-class device works well; a resized/AirDropped photo from a real device often doesn't match and gets rejected. Capture it on the **crash screen** (where the Remove Ads button lives), and run from **Xcode** (App scheme) so the StoreKit config loads and the button shows the price. The system "Sign in to Apple Account" payment sheet is Apple-generated and is *not* what the review screenshot should show.

## Backlog / ideas for later

- **Choice of soundtrack**: let the player pick between the available tracks (currently just "Neon Drift Circuit" is wired in as the default; "Midnight Circuit Run" masters already exist in `Music/` but aren't hooked up).
- **Car color choice**.
- **Night mode** (as a toggle/variant — the game's existing look is already synthwave/night-themed, so clarify what this means before implementing: a separate day/light mode, or a darker/higher-contrast night variant).

## Build & verify

```bash
cd Stay_On_iOS/mobile
npm install
npx tsc -b        # type-check
npx vite build     # build web assets into dist/
npx cap sync ios   # copy assets + sync native deps into ios/App
```

## TestFlight

Signing is already set up (Apple Distribution cert for team `78H427V6FY`, Apple ID signed into Xcode on this Mac).

**Preferred (2026-08-29 onward) — fastlane:**

```bash
cd Stay_On_iOS/mobile/ios/App
bundle exec fastlane beta   # rebuilds web, bumps build number, archives, uploads to TestFlight
```

Requires the ASC API key in `fastlane/.env` (see the Observability & tooling section). `bundle exec fastlane auth_check` confirms the key works without doing a build.

**Manual fallback (the historical flow):**

```bash
cd Stay_On_iOS/mobile
npm run build && npx cap sync ios
cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -archivePath <path>/StayOn.xcarchive archive
open <path>/StayOn.xcarchive   # opens Xcode Organizer
```

Then in Organizer: **Distribute App → App Store Connect → Upload**, using the already-signed-in Apple ID.

## Repo notes

- No Git LFS — `Music/*.wav` masters (~117MB total) are committed as regular files by choice; be aware of repo size growth if more audio gets added.
- Root `.gitignore` covers `node_modules/`, `dist/`, `build/`; `mobile/ios/.gitignore` covers `Pods/`, `DerivedData/`, etc.; `mobile/ios/App/.gitignore` covers `fastlane/.env`, `*.p8`, `vendor/bundle/`, `build/`, `*.ipa`. Verify any file is ignored with `git check-ignore -v <path>`.
- Secrets live in git-ignored `.env` files, never committed: `mobile/.env` (`VITE_SENTRY_DSN`, `VITE_POSTHOG_*`, `SENTRY_ORG`/`SENTRY_PROJECT`/`SENTRY_AUTH_TOKEN`) and `mobile/ios/App/fastlane/.env` (`ASC_*`). `.env.example` files document the keys.
- Two stale `Stay_On_iOS_Capacitor*.zip` exports sit untracked at repo root — old manual exports, safe to ignore or delete.

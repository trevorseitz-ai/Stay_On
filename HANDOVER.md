# Stay On — Handover

Endless arcade night-driving game ("Stay On"), synthwave/outrun aesthetic. Native iOS app via Capacitor, plus a parallel web build. Last updated 2026-08-23.

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
- App Store Connect **Paid Apps Agreement + tax/banking** are now signed/submitted (previously only had the Free Apps Agreement, which silently blocks StoreKit from returning any IAP product — this was the root cause of a long RevenueCat error 23 "offerings empty" debugging session before it resolved).
- **Crash sound**: a synthesized noise-burst + low-frequency "thud" (Web Audio API, `AudioContext` — no external audio asset) plays the instant the car crashes, in both `mobile/src/App.tsx` and `source/app/page.tsx`. Respects the existing mute toggle via a `mutedRef` (the mute `useState` isn't in the main game effect's dependency array, so a ref mirrors it for the closure to read live). The `AudioContext` is created lazily on first crash and closed on effect cleanup.

## Remaining before wide release

- The public App Store listing itself is not yet approved — last submission (build 8) showed "Ready for Review" with unresolved issues in App Store Connect as of 2026-08-23. Only TestFlight beta access (build 4) had cleared. Check current status in App Store Connect → Distribution before assuming this is live.
- IAP screenshot for App Store review must be an exact native resolution from Apple's accepted list (1260×2736, 1290×2796, or 1320×2868 portrait) — a Simulator screenshot via Cmd+S on a Pro Max/Plus/Air-class device works well; a resized/AirDropped photo from a real device often doesn't match and gets rejected.

## Backlog / ideas for later

- **Difficulty levels**: Easy / Medium / Hard, starting the player at level 1, 7, and 15 respectively.
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

Signing is already set up (Apple Distribution cert for team `78H427V6FY`, Apple ID signed into Xcode on this Mac). To ship a new build:

```bash
cd Stay_On_iOS/mobile
npm run build && npx cap sync ios
cd ios/App
xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -archivePath <path>/StayOn.xcarchive archive
open <path>/StayOn.xcarchive   # opens Xcode Organizer
```

Then in Organizer: **Distribute App → App Store Connect → Upload**, using the already-signed-in Apple ID (no new credentials needed — this has been the working flow historically).

## Repo notes

- No Git LFS — `Music/*.wav` masters (~117MB total) are committed as regular files by choice; be aware of repo size growth if more audio gets added.
- Root `.gitignore` covers `node_modules/`, `dist/`, `build/`; `mobile/ios/.gitignore` covers `Pods/`, `DerivedData/`, etc.
- Two stale `Stay_On_iOS_Capacitor*.zip` exports sit untracked at repo root — old manual exports, safe to ignore or delete.

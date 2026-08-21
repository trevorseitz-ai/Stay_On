# Stay On — Handover

Endless arcade night-driving game ("Stay On"), synthwave/outrun aesthetic. Native iOS app via Capacitor, plus a parallel web build. Last updated 2026-08-21.

## Directory map

- **`Stay_On_iOS/mobile/`** — the active iOS app (Capacitor 7, React + Vite). This is what ships to TestFlight/App Store. App ID `com.trevorseitz.stayon`.
- **`Stay_On_iOS/source/`** — parallel web build (Next.js/vinext-based), same game logic, **no ads/IAP** (gated out via `Capacitor.isNativePlatform()` checks since it's browser-only).
- **`Music/`** — Suno-generated soundtrack masters (WAV, licensed for commercial use) plus OGG/MP3 conversions. `Neon Drift Circuit` is the official in-game soundtrack.
- **`Source_Files/Stay_On_Source_v9/`** — an older archival snapshot of the web source, predates the music/IAP work in this doc. Not actively maintained; `Stay_On_iOS/source/` is the current one.
- `Stay_On_iOS-oldish/` no longer exists — it was the pre-rename version of `Stay_On_iOS/`, fully removed as of the 2026-08-21 commit.

## Core game logic

Both `Stay_On_iOS/mobile/src/App.tsx` and `Stay_On_iOS/source/app/page.tsx` contain near-duplicate implementations of the same canvas-based driving game (state machine: `ready → countdown → playing → crashed`). **When changing gameplay, audio, or ad logic, mirror the change in both files** unless it's native-only (ads/IAP are mobile-only, so those only touch `mobile/src/App.tsx`).

## What's implemented (as of last session)

- **Soundtrack**: `Neon Drift Circuit.mp3` loops in the background (`public/audio/neon-drift-circuit.mp3` in both builds), starts on first touch (iOS autoplay requirement), toggled via a bottom-right speaker icon. Preference persists in `localStorage` (`stay-on-muted`).
- **Banner ad** (AdMob): always shown on native launch, unless the player owns the ad-free entitlement. Real ad unit already in use: `ca-app-pub-4738248194115302/4821502245`.
- **Interstitial ad** (AdMob): shown after every 2nd crash (`INTERSTITIAL_RUN_INTERVAL = 2` in `App.tsx`), preloaded ahead of time so there's no load delay at the crash screen, skipped once ad-free is owned. **Currently using Google's public test ad unit ID** (`ca-app-pub-3940256099942544/4411468910`) — needs to be swapped for a real approved unit.
- **"Remove Ads" IAP** (RevenueCat, `@revenuecat/purchases-capacitor@11.3.2` — pinned below v12 because v12+ requires Capacitor 8, this project is on Capacitor 7): one-time non-consumable purchase, button + "Restore purchase" link on the crash screen. Code is fully wired but **inert until the manual setup below is done** — no real API key or product configured yet.

## Manual setup still required (can't be done from a coding agent)

1. **RevenueCat**: create account/project, add iOS app (bundle id `com.trevorseitz.stayon`), get the public iOS API key → replace `REVENUECAT_IOS_API_KEY = "appl_REPLACE_ME"` in `mobile/src/App.tsx`.
2. **App Store Connect**: create the non-consumable IAP product (pick a product id, price, submit for review), then in RevenueCat's dashboard link it to an Entitlement (must match `AD_FREE_ENTITLEMENT_ID = "ad_free"`) and an Offering/Package (must match `REMOVE_ADS_PACKAGE_ID = "remove_ads"`) — or update those constants to match whatever you actually name them.
3. **AdMob interstitial**: once AdMob/Apple review clears, replace `INTERSTITIAL_AD_ID` with the real approved unit.
4. **Sandbox testing**: verify purchase + restore flow on a real device/simulator with a sandbox Apple ID — not verifiable by build tooling.

_Context: as of last session, AdMob review was still pending with Apple — that's the blocker on getting a second (interstitial) ad unit approved._

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

# Stay On — Handover

Endless arcade night-driving game ("Stay On"), synthwave/outrun aesthetic. Native iOS app via Capacitor, plus a parallel web build. Last updated 2026-09-25 (1.0 resubmitted with the Remove Ads IAP after a 2.1(b) rejection; Capacitor 8 upgrade; marketing site deploy fixed; `app-ads.txt` live).

## Current status (2026-09-25) — start here

- **App Review**: version **1.0, build `202609231310`**, submitted **together with** the Remove Ads IAP (`com.trevorseitz.stayon.removeads`) on 2026-09-25. Both `WAITING_FOR_REVIEW` (IAP state confirmed via RevenueCat `get-product-store-state`). No action needed until Apple replies.
- **Why it was rejected (2026-09-23, Guideline 2.1(b))**: the app referenced Remove Ads but the IAP had never been submitted. An app's **first** IAP can only be submitted *with* an app version — RevenueCat's `submit-products-to-store` skips it for that reason. See "App Store submission gotchas" below for the App Store Connect flow that finally worked.
- **AdMob**: ads currently **do not load** on device — `requestConsentInfo` fails ("Request consent info failed") and interstitials return "Publisher data not found". Cause is account-side: AdMob setup is incomplete (**payment verification pending with Google**). Not related to the Capacitor 8 upgrade (ads loaded on the upgraded build earlier the same day; app ID/ad unit IDs unchanged).
- **Next steps, in order**:
  1. When Google verifies payments: AdMob → Privacy & messaging → publish the **European regulations** consent message for Stay On Driving, privacy URL `https://stayondriving.com/privacy`.
  2. When Apple approves 1.0: AdMob → Apps → Stay On Driving → App settings → App store details → **Add** (link the App Store listing). Then AdMob reviews the app (a few days) until it shows **Ready**.
  3. Then reinstall from Xcode on a device and confirm banner + interstitial load. If not, grab `AdMob initialization failed` / `Interstitial prepare failed` lines from the Xcode console.
  4. After approval: in `mobile/src/App.tsx` `showBannerAd`, stop a failed consent request from aborting the banner attempt entirely. Keep it privacy-correct: use the consent SDK's `canRequestAds`, don't just skip consent.
  5. Marketing site TODO (below): swap the "Coming soon" App Store caption once 1.0 is live.

## Directory map

- **`Stay_On_iOS/mobile/`** — the active iOS app (Capacitor 8, React + Vite). This is what ships to TestFlight/App Store. App ID `com.trevorseitz.stayon`.
- **`Stay_On_iOS/source/`** — parallel web build (Next.js/vinext-based), same game logic, **no ads/IAP** (gated out via `Capacitor.isNativePlatform()` checks since it's browser-only).
- **`Marketing/site/`** — static marketing site (plain HTML/CSS, no build step), **live in production at https://stayondriving.com**. See "Marketing site" section below.
- **`Music/`** — Suno-generated soundtrack masters (WAV, licensed for commercial use) plus OGG/MP3 conversions. `Neon Drift Circuit` is the official in-game soundtrack.
- `Source_Files/` no longer exists — it held an archival `Stay_On_Source_v9/` snapshot (a near-duplicate of `Stay_On_iOS/source/`) plus two zipped snapshots; removed 2026-08-31 as stale. `git log` still has it if ever needed.
- `Stay_On_iOS-oldish/` no longer exists — it was the pre-rename version of `Stay_On_iOS/`, fully removed as of the 2026-08-21 commit.

## Core game logic

Both `Stay_On_iOS/mobile/src/App.tsx` and `Stay_On_iOS/source/app/page.tsx` contain near-duplicate implementations of the same canvas-based driving game (state machine: `ready → countdown → playing → crashed`). **When changing gameplay, audio, or ad logic, mirror the change in both files** unless it's native-only (ads/IAP are mobile-only, so those only touch `mobile/src/App.tsx`).

## What's implemented (as of 2026-08-23)

- **Soundtrack**: `Neon Drift Circuit.mp3` loops in the background (`public/audio/neon-drift-circuit.mp3` in both builds), starts on first touch (iOS autoplay requirement), toggled via a bottom-right speaker icon. Preference persists in `localStorage` (`stay-on-muted`).
- **Banner ad** (AdMob): always shown on native launch, unless the player owns the ad-free entitlement. Real ad unit: `ca-app-pub-4738248194115302/4821502245`.
- **Interstitial ad** (AdMob): shown after every 2nd crash (`INTERSTITIAL_RUN_INTERVAL = 2` in `App.tsx`), preloaded ahead of time so there's no load delay at the crash screen, skipped once ad-free is owned. Real approved ad unit: `ca-app-pub-4738248194115302/3809716597`.
- **"Remove Ads" IAP** (RevenueCat, `@revenuecat/purchases-capacitor@13.6.1` / RevenueCat iOS SDK 5.90.2 since the 2026-09-25 Capacitor 8 upgrade — see "Capacitor 8 upgrade" below): one-time non-consumable purchase ($2.99), button + "Restore purchase" link on the crash screen. **Fully wired and verified working end-to-end** via sandbox purchase test on a real device (2026-08-23): real RevenueCat API key in place, Apple product `com.trevorseitz.stayon.removeads` created in App Store Connect and imported/attached to the `ad_free` entitlement in RevenueCat, package matched via `current?.lifetime` (RevenueCat auto-assigns lifetime packages the reserved identifier `$rc_lifetime` — don't try to match on a custom package name string).
  - The button label shows the localized store price when the offering loads (`REMOVE ADS · $2.99`, from the package's `product.priceString`), falling back to a plain `REMOVE ADS` label. Price is fetched once during `initPurchases` into the `adFreePrice` state.
  - As of 2026-08-29: package lookup goes through an `adFreePackage()` helper (`offering.lifetime ?? availablePackages[0] ?? null`) so a dashboard slot mismatch can't disable the button; `Purchases.setLogLevel` is set (DEBUG in dev, INFO in prod) so TestFlight offering failures are diagnosable in device logs.
  - `ios/App/StayOn.storekit` + the committed shared `App.xcscheme` (`ios/App/App.xcodeproj/xcshareddata/xcschemes/`) let the **simulator** load the offering and run a StoreKit *test* purchase — but only when launched from Xcode (Run the App scheme). A plain `xcodebuild`/`simctl` launch does not apply the StoreKit config, so the button falls back to the label with no price there. Release builds ignore the `.storekit` file entirely.
  - **Sandbox testing on a real device requires the StoreKit config OFF** (Edit Scheme → Run → Options → StoreKit Configuration = None). With it on, purchases go to Xcode's local fake store (`StoreKitTest_Transaction_…` IDs in RevenueCat), and deleting the app wipes them, so "Restore purchase" then reports "Nothing to restore". On 2026-09-25 this was turned off in the working copy of the shared `App.xcscheme` **but deliberately not committed**, so the committed scheme still references `StayOn.storekit`.
  - The sandbox Apple account on the dev iPhone **already owns** Remove Ads (real sandbox purchase 2026-08-23, transaction `2000001225677784`). So tapping Remove Ads there shows **no payment sheet**: StoreKit returns the existing purchase and the button disappears. That's correct behavior. To see the sheet again, App Store Connect → Users and Access → Sandbox → tester → Clear Purchase History (or use a new tester). The direct URL for sandbox testers is `https://appstoreconnect.apple.com/access/users/sandbox`.
  - Verified 2026-09-25 on Capacitor 8: fresh install shows ads-free=false + $2.99 offering; restore after reinstall re-grants `ad_free`.
- **Steering hint on crash screen**: the decorative steering-wheel hint (`.steering-control` + "PLACE THUMB HERE") is now hidden whenever `showFeedback` is true, so it no longer overlaps the Quick Feedback / Remove Ads buttons on the crash screen. Mobile-only change (`mobile/src/App.tsx`).
- App Store Connect **Paid Apps Agreement + tax/banking** are now signed/submitted (previously only had the Free Apps Agreement, which silently blocks StoreKit from returning any IAP product — this was the root cause of a long RevenueCat error 23 "offerings empty" debugging session before it resolved).
- **Difficulty levels** (2026-08-29): Easy / Medium / Hard segmented picker shown on the ready + crash screens (hidden mid-run), selection persisted in `localStorage` (`stay-on-difficulty`, default `easy`). Each difficulty sets the level the run *starts* on — displayed LEVEL 1 / 5 / 10 (`DIFFICULTY_START_LEVEL` = 0 / 4 / 9, 0-indexed — Hard starts fast but not at the 420 speed cap). The in-run level-up formula became `startLevel + Math.floor(distance / 3000)`, so speed/road-narrowing scale off the elevated start. Top speed caps (420) by ~LEVEL 4 and road width bottoms out (118px) by ~LEVEL 11–12 on a typical phone; past that, `roadCenter()` adds a continuous secondary sine "weave" (ramps in over `progress` 27k→51k where `progress = startLevel*3000 + worldY`, capped to remaining on-screen headroom) so higher levels keep getting harder via more/sharper turns rather than plateauing. Mirrored in both `mobile/src/App.tsx` and `source/app/page.tsx` (+ `.difficulty-select` CSS in `mobile/src/styles.css` and `source/app/globals.css`). Mobile emits `difficulty_changed`, and adds `difficulty` / `start_level` to `run_started` + `run_ended` PostHog events.
- **Crash sound**: a synthesized noise-burst + low-frequency "thud" (Web Audio API, `AudioContext` — no external audio asset) plays the instant the car crashes, in both `mobile/src/App.tsx` and `source/app/page.tsx`. Respects the existing mute toggle via a `mutedRef` (the mute `useState` isn't in the main game effect's dependency array, so a ref mirrors it for the closure to read live). The `AudioContext` is created lazily on first crash and closed on effect cleanup.

## Observability & tooling (added 2026-08-29, mobile build only)

- **Sentry crash reporting**: `@sentry/capacitor` + `@sentry/react`, initialized in `mobile/src/main.tsx`, DSN-gated on `VITE_SENTRY_DSN` (in `mobile/.env`, git-ignored). Native iOS crashes captured automatically by the Capacitor plugin; JS errors via the React SDK. Sentry project `stay-on` under org `personal-evw`. **`@sentry/react` is pinned to the exact version in `@sentry/capacitor`'s `peerDependencies`** (currently `10.69.0`) — a floating `@latest` pulls a duplicate nested `@sentry/browser` and breaks `tsc` with a TS2345 in `main.tsx`. Re-pin on any bump.
- **Sentry source maps**: `@sentry/vite-plugin` in `mobile/vite.config.ts` uploads maps on every build where `SENTRY_AUTH_TOKEN` is set (org auth token, `org:ci` scope, in `mobile/.env`), then deletes the `.map` files from `dist` so they never ship. `build.sourcemap` is gated on the token — no token, no maps emitted. CI/other machines skip the upload silently.
- **iOS deployment target bumped 14.0 → 15.0** (`mobile/ios/App/Podfile`) — `SentryCapacitor` requires 15. iOS 15 covers the same device list as 14, and the app target was already 18.6, so zero user impact. Since 2026-09-25 the Podfile `post_install` also forces every **pod target** below 15.0 up to 15.0. Some pods declare 14.0, which Xcode 27 rejects ("supported deployment target versions is 15.0 to 27.0.x"). Don't try to fix this in the Pods project in Xcode: `pod install` regenerates it.
- **Export compliance** (2026-08-30): `ITSAppUsesNonExemptEncryption` = `false` is now in `mobile/ios/App/App/Info.plist`, so uploads no longer land in `MISSING_EXPORT_COMPLIANCE` needing a manual answer per build. The app uses only standard HTTPS (PostHog, Sentry, AdMob, RevenueCat). To answer it on an already-uploaded build without re-uploading: `Spaceship::ConnectAPI::Build` → find by `.version`, then `b.update(attributes: { usesNonExemptEncryption: false })` (see the throwaway `/tmp/flip.rb` pattern used this session).
- **fastlane** (`mobile/ios/App/fastlane/`): lanes `sync_web` (rebuilds web + `cap sync`; resolves the Capacitor root from the Fastfile's `__dir__` since `sh` runs from `fastlane/`, not `ios/App`), `bump` (build number → UTC timestamp, `skip_info_plist: true` so `Info.plist` keeps the `$(CURRENT_PROJECT_VERSION)` reference), `build` (signed App Store `.ipa` → `./build`), `beta` (sync_web → bump → build → TestFlight upload), `auth_check` (verifies ASC API key — confirmed working 2026-08-29). Auth is via App Store Connect API key; setup notes are the comment block at the top of the `Fastfile`. Credentials go in `mobile/ios/App/fastlane/.env` (git-ignored): `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_PATH`. Gems vendored to `vendor/bundle` (git-ignored); run via `bundle exec fastlane <lane>`. `fastlane/README.md` is auto-generated — don't hand-edit.
- **MCP servers** added to `~/.claude.json` (user scope): `sentry` (`https://mcp.sentry.dev/mcp`) and `revenuecat` (`https://mcp.revenuecat.ai/mcp`). Both need a one-time `/mcp` auth after a Claude Code restart (Sentry: browser OAuth; RevenueCat: v2 secret key).

## Capacitor 8 upgrade (2026-09-25, PR #5)

- **Why**: this Mac now has **Xcode 27** (the only Xcode installed). RevenueCat iOS 5.51.1 (from `purchases-capacitor` 11.3.2, the last Capacitor-7 release) fails to compile under it: `PaywallColor` "Invalid redeclaration of synthesized memberwise init(stringRepresentation:)" and "Ambiguous use of 'init'". The fix only ships in `purchases-capacitor` 12+, and those require Capacitor 8.
- **Versions**: `@capacitor/core|ios|cli` 8.5.2 · `@capacitor-community/admob` 8.1.0 (Google Mobile Ads 13.6.0) · `@revenuecat/purchases-capacitor` 13.6.1 (RevenueCat 5.90.2, PurchasesHybridCommon 19.3.1) · **Sentry unchanged** (`@sentry/capacitor` 4.3.0 supports Cap ≥3; keep the `@sentry/react` 10.69.0 pin).
- No app-code changes were needed: the RevenueCat calls the app uses kept the same signatures, and `tsc` passes with AdMob 8.
- **`npx cap sync ios` on Capacitor 8 runs an Xcode clean** that fails if a non-Xcode `mobile/ios/App/build/` folder exists ("Could not delete … because it was not created by the build system"). The old 2026-09-01 `App.ipa` + dSYM that lived there were moved to `~/Projects/Stay_On_build_backups/2026-09-01/`. Keep fastlane's `build` lane output in mind: if it writes `./build` there again, move it before syncing.

## App Store submission gotchas (learned 2026-09-25)

- **Build numbers** are UTC-ish timestamps (`YYYYMMDDHHMM`), in `CURRENT_PROJECT_VERSION` in `App.xcodeproj/project.pbxproj` (Debug + Release). Current: `202609231310`.
- **The first IAP must be in the same review submission as an app version.** The flow that worked:
  1. If the version is stuck in a rejected or unresolved submission, **remove it from review first**. Use the "remove this version" link on the version page, or remove it on the App Review submission page. The version becomes *Developer Rejected*.
  2. Sidebar → **In-App Purchases** → Edit → tick the IAP → **Add for Review**. This creates a *Draft Submission*. Its "add an app version" warning is expected.
  3. Version page → **Add for Review** ▾ → pick the existing **Draft Submission (1)**, *not* "Create New Submission".
  4. Before clicking Submit, confirm the panel lists **both** the version and the IAP. The confirmation must say **2 Items Submitted**.
- The version page **does not show an "In-App Purchases and Subscriptions" section** in this account's current App Store Connect UI (checked 2026-09-25), so use the flow above.
- If you resubmit the version alone by mistake, it goes to *Waiting for Review* with only 1 item. Pull it back with the "remove this version" link and redo the flow.
- The App Store Connect tab formerly called "App Store" is now **Distribution**.
- App Review notes on 1.0 describe how to reach Remove Ads (crash screen; hidden while Quick Feedback is open) and list AdMob (banner + interstitial) and IAP-via-RevenueCat. Keep them accurate if the UI changes.

## Remaining before wide release

- See **Current status** at the top. Older history: 1.0 was first submitted 2026-08-28 (build 8), then build `202609011900` was rejected 2026-09-23 for the unsubmitted IAP.
- IAP screenshot for App Store review must be an exact native resolution from Apple's accepted list (1260×2736, 1290×2796, or 1320×2868 portrait) — a Simulator screenshot via Cmd+S on a Pro Max/Plus/Air-class device works well; a resized/AirDropped photo from a real device often doesn't match and gets rejected. Capture it on the **crash screen** (where the Remove Ads button lives), and run from **Xcode** (App scheme) so the StoreKit config loads and the button shows the price. The system "Sign in to Apple Account" payment sheet is Apple-generated and is *not* what the review screenshot should show.

## Marketing site

- **Live at https://stayondriving.com** (deployed 2026-08-31). Source in `Marketing/site/`, plus `Marketing/site/README.md`.
- **Host**: Vercel, project `trevorseitz-ais-projects/stayondriving` (`prj_0B4BbL6Xpa8HFBbHFhqnEGwxOAc8`, team `team_6kERxtN8rsN3xEoujV9ck3DA`), linked via `Marketing/site/.vercel/`. Static — no build step.
- **Deploys happen automatically from Git**: every push/merge to `main` deploys to production. The project's **Root Directory is `Marketing/site`** (set 2026-09-25).
  - **Outage 2026-09-23 → 2026-09-25**: Root Directory was `.` (repo root), so every Git deploy built the repo root, which has no `index.html`. Each became production, and the **whole domain (incl. /privacy and /support) returned 404** while 1.0 was in App Review. It was fixed by rolling back, then setting Root Directory and redeploying.
  - Never set Root Directory back to `.`. If the site 404s again, check `x-vercel-error` in the response headers and `vercel project inspect stayondriving`.
  - **Manual CLI deploys**: with Root Directory set, run `vercel deploy --prod` from the **repo root**, not from `Marketing/site`, or Vercel will look for `Marketing/site/Marketing/site`. Prefer just merging to `main`.
- **`app-ads.txt`** (added 2026-09-25, PR #6): `Marketing/site/app-ads.txt` → https://stayondriving.com/app-ads.txt, contents `google.com, pub-4738248194115302, DIRECT, f08c47fec0942fa0`. AdMob crawls it from the developer site on the App Store listing. App Store Connect URLs were confirmed on 2026-09-25 to all use stayondriving.com: Support `/support`, Marketing `/`, Privacy Policy `/privacy`.
- **DNS**: managed at Porkbun (Cloudflare-backed DNS UI). Apex `A → 76.76.21.21`, `www CNAME → cname.vercel-dns.com`. The old Cloudflare parking A records (162.159.143.30, 172.66.3.26) and the `*` wildcard CNAME were removed during cutover. MX/SPF for Porkbun email forwarding left intact.
- **Routes**: `/` landing, `/privacy` (App Store Privacy Policy URL), `/support` (App Store Support URL). `.html` → clean-path 308 redirects. `www` → apex 308 redirect (host-scoped rule in `vercel.json`).
- **Email**: `support@stayondriving.com` forwarding is set up (contact address on /privacy and /support).
- **TODO once 1.0 is approved**: `index.html` App Store link points at `apps.apple.com/app/id6801365584` with a "Coming soon — 1.0 is in review" `<small>` caption. Confirm the ID, drop the caption, redeploy.

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

Build `202609231310` was archived and uploaded manually from Xcode 27 (Any iOS Device → Product → Archive → Distribute App → App Store Connect → Upload). Before archiving: quit/reopen `App.xcworkspace` after any `pod install`, then Product → Clean Build Folder.

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
- Root `.DS_Store` files and the orphaned root `package-lock.json` (no root `package.json`) were removed 2026-08-31. `.DS_Store` is git-ignored; Finder recreates it, ignore it.

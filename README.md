# Stay On

Endless arcade night-driving game with a synthwave look. It ships as a native iOS app built with Capacitor, and it also has a browser build.

**Start with [`HANDOVER.md`](HANDOVER.md).** It has the current App Store status, the directory map, build and release steps, and known issues.

## Layout

- `Stay_On_iOS/mobile/`: the iOS app (Capacitor 8, React, Vite). This is what ships to the App Store, as `com.trevorseitz.stayon`.
- `Stay_On_iOS/source/`: the browser build. It has the same game logic and no ads or in-app purchases.
- `Marketing/site/`: the static marketing site, live at https://stayondriving.com. Vercel deploys it automatically when changes merge to `main`.
- `Marketing/mockups`, `Marketing/Shorts`: marketing images and short-form video work.
- `Music/`: soundtrack masters (WAV) and OGG versions.

## Quick build

```bash
cd Stay_On_iOS/mobile
npm install
npx tsc -b && npx vite build
npx cap sync ios
```

For TestFlight and App Store uploads, see the "TestFlight" section of `HANDOVER.md`.

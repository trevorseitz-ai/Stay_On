# Stay On iPhone Packaging Project

This folder holds two builds of the game. `source/` is the browser build (the original ChatGPT Site source). `mobile/` is the Vite + Capacitor 8 iOS app that ships to the App Store.

## On the Mac

```bash
cd mobile
npm install
npm run build
npx cap sync ios
npx cap open ios
```

Then pick an iPhone simulator or a connected iPhone in Xcode and press Run.

**Don't run `npx cap add ios`.** The `ios/` project already exists and has hand-made changes: the UIScene manifest that iOS 27 needs, `SceneDelegate.swift`, `MainViewController`, and the StoreKit config. Regenerating the project would erase them. See `../HANDOVER.md` for details.

App ID: `com.trevorseitz.stayon`

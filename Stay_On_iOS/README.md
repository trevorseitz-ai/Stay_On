# Stay On iPhone Packaging Project

This folder contains the original ChatGPT Site source under `source/` and a
mobile-ready Vite + Capacitor project under `mobile/`.

## On the Mac

```bash
cd mobile
npm install
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

Then select an iPhone simulator or connected iPhone in Xcode and press Run.

App ID: `com.trevorseitz.stayon`

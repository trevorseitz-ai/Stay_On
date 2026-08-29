# fastlane

Runs from `Stay_On_iOS/mobile/ios/App`.

## One-time setup

1. **App Store Connect API key** — App Store Connect → Users and Access →
   Integrations → App Store Connect API → generate a key with the **App Manager**
   role. Download the `.p8` (one download only).

2. Store it and export the three values (put them in a shell profile, or a
   `fastlane/.env` file which fastlane auto-loads — that file is git-ignored):

   ```sh
   ASC_KEY_ID=XXXXXXXXXX
   ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ASC_KEY_PATH=/Users/trevorseitz/.appstoreconnect/AuthKey_XXXXXXXXXX.p8
   ```

## Lanes

| Lane | What it does |
|------|--------------|
| `fastlane sync_web` | `npm run build` + `npx cap sync ios` |
| `fastlane bump` | Set build number to a UTC timestamp |
| `fastlane build` | Signed App Store `.ipa` into `./build` |
| `fastlane beta` | sync_web → bump → build → upload to TestFlight |

## Notes

- Signing: relies on the Xcode project's existing automatic signing for team
  `78H427V6FY`. If CI needs it, add `match` later.
- The IAP (`com.trevorseitz.stayon.removeads`) must exist in App Store Connect
  for RevenueCat + StoreKit to resolve it in TestFlight.

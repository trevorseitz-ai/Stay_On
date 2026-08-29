fastlane documentation
----

# Installation

Make sure you have the latest version of the Xcode command line tools installed:

```sh
xcode-select --install
```

For _fastlane_ installation instructions, see [Installing _fastlane_](https://docs.fastlane.tools/#installing-fastlane)

# Available Actions

## iOS

### ios sync_web

```sh
[bundle exec] fastlane ios sync_web
```

Rebuild the web bundle and sync it into the iOS project

### ios auth_check

```sh
[bundle exec] fastlane ios auth_check
```

Verify the App Store Connect API key authenticates

### ios bump

```sh
[bundle exec] fastlane ios bump
```

Set the build number to a UTC timestamp (monotonic, no state to track)

### ios build

```sh
[bundle exec] fastlane ios build
```

Build a signed App Store .ipa into ./build

### ios beta

```sh
[bundle exec] fastlane ios beta
```

Sync web, bump build number, build, and upload to TestFlight

----

This README.md is auto-generated and will be re-generated every time [_fastlane_](https://fastlane.tools) is run.

More information about _fastlane_ can be found on [fastlane.tools](https://fastlane.tools).

The documentation of _fastlane_ can be found on [docs.fastlane.tools](https://docs.fastlane.tools).

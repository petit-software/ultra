# Agent notes for Ultra

Conventions to follow when working in this repo.

## Builds / packaging

- **Packaged (DMG / `dist:mac`) builds must NOT show the console by default.**
  The DevTools inspector is opened only in development (`!app.isPackaged`) in
  `src/main/index.ts`. Never open DevTools unconditionally — end users should
  not see the console on launch.
- The macOS build is **signed + notarized**. electron-builder auto-discovers
  the "Developer ID Application" cert in the keychain; `scripts/notarize.cjs`
  (afterSign hook) notarizes via notarytool and staples, using the keychain
  profile **`ultra-notary`**. Team ID `TJ3ALYQV5G`.
  - One-time setup: `xcrun notarytool store-credentials "ultra-notary"
    --apple-id <id> --team-id TJ3ALYQV5G --password <app-specific-password>`.
  - Unsigned local build (no cert needed):
    `CSC_IDENTITY_AUTO_DISCOVERY=false SKIP_NOTARIZE=1 npm run dist:mac`.

## Releases

- Distributed via GitHub releases on `petit-software/ultra`, tag `v<version>`.
  Re-upload artifacts with `gh release upload <tag> <files> --clobber`.

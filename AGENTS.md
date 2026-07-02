# Agent notes for Ultra

Conventions to follow when working in this repo.

## Builds / packaging

- **Packaged (DMG / `dist:mac`) builds must NOT show the console by default.**
  The DevTools inspector is opened only in development (`!app.isPackaged`) in
  `src/main/index.ts`. Never open DevTools unconditionally — end users should
  not see the console on launch.

## macOS signing + notarization

The macOS build is **signed + notarized + stapled** so it opens with zero
Gatekeeper prompts. Identity facts:

- Apple ID: `bartosz.bak@me.com` · Team ID: **`TJ3ALYQV5G`** (team "Bartosz Bak").
- Signing cert: `Developer ID Application: Bartosz Dariusz Bak (TJ3ALYQV5G)`
  (auto-discovered from the login keychain by electron-builder).
- Notarization auth: keychain profile **`ultra-notary`** (notarytool), pinned to
  the login keychain. The hook passes `keychain:
  ~/Library/Keychains/login.keychain-db` — WITHOUT this, notarytool intermittently
  fails with "No Keychain password item found for profile". Override via
  `NOTARY_KEYCHAIN`. If a build still fails this way, re-store creds (step 2 below).
- `electron-builder.yml`: `hardenedRuntime: true`, `entitlements`/`entitlementsInherit`
  → `build/entitlements.mac.plist`, `notarize: false` (we notarize via the hook),
  `afterSign: scripts/notarize.cjs`.
- `scripts/notarize.cjs` runs after signing: notarizes the **.app** via the
  `ultra-notary` profile, then staples it. Honors `SKIP_NOTARIZE=1`.

### One-time machine setup (already done; redo only on a new machine)

1. Install the **Developer ID Application** cert (Xcode → Settings → Accounts →
   team → Manage Certificates → `+` → Developer ID Application).
2. Store notarization creds in the keychain:
   ```
   xcrun notarytool store-credentials "ultra-notary" \
     --apple-id "bartosz.bak@me.com" --team-id "TJ3ALYQV5G" \
     --password "<app-specific-password from appleid.apple.com>" \
     --keychain "$HOME/Library/Keychains/login.keychain-db"
   ```
   Always pass `--keychain` so the profile lands in (and is read from) the login
   keychain deterministically. The app-specific password is generated at
   appleid.apple.com — never commit it.
   The Team ID is the cert's **OU** field, NOT the code in the cert's CN parens.
   Verify: `security find-identity -v -p codesigning | grep "Developer ID"`.

### Release runbook — EXACT steps every time you sign a DMG for a release

Run from the repo root. `<tag>` is `v<version>` (e.g. `v0.1.0`); artifact names
follow `Ultra-<version>-arm64.dmg` / `Ultra-<version>-arm64-mac.zip`.

1. **Build (signs → notarizes .app → staples .app → builds dmg/zip):**
   ```
   npm run dist:mac
   ```
   Expect to see `signing … identity=…`, `notarize submitting Ultra.app`,
   `The staple and validate action worked!`, then the dmg/zip build lines.

2. **Notarize + staple the DMG file itself** (the hook only does the .app; the
   dmg is created afterward, so it needs its own ticket):
   ```
   xcrun notarytool submit "release/Ultra-<version>-arm64.dmg" \
     --keychain-profile "ultra-notary" \
     --keychain "$HOME/Library/Keychains/login.keychain-db" --wait  # status: Accepted
   xcrun stapler staple "release/Ultra-<version>-arm64.dmg"   # expect: worked!
   ```

3. **Verify everything is accepted/stapled:**
   ```
   spctl -a -vvv "release/mac-arm64/Ultra.app"   # accepted, source=Notarized Developer ID
   xcrun stapler validate "release/Ultra-<version>-arm64.dmg"     # validate worked
   xcrun stapler validate "release/mac-arm64/Ultra.app"          # validate worked
   ```
   NOTE: `spctl -a -t open --context context:primary-signature` on a DMG reports
   "no usable signature" — that's expected (DMGs aren't code-signed, they're
   notarized+stapled). `stapler validate` passing is the authoritative check.

4. **Publish to the GitHub release** (`petit-software/ultra`):
   ```
   git tag -f <tag> && git push -f origin <tag>
   gh release upload <tag> \
     "release/Ultra-<version>-arm64.dmg" \
     "release/Ultra-<version>-arm64-mac.zip" --clobber
   ```

### Unsigned local build (no cert / quick iteration)

```
CSC_IDENTITY_AUTO_DISCOVERY=false SKIP_NOTARIZE=1 npm run dist:mac
```
Unsigned DMGs trip Gatekeeper ("damaged"); to open one locally:
`xattr -dr com.apple.quarantine <app>` then `codesign --force --deep --sign - <app>`.

## Releases

- Distributed via GitHub releases on `petit-software/ultra`, tag `v<version>`.
- Re-upload/replace artifacts with `gh release upload <tag> <files> --clobber`.
- **"Add a release" means the full flow**: bump the version in `package.json`,
  commit + push, create the `v<version>` GitHub release with notes describing
  what changed, AND build + attach the signed/notarized DMG (runbook above).
  A release without the DMG artifact is incomplete.

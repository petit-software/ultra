# Agent notes for Ultra

Conventions to follow when working in this repo.

## Builds / packaging

- **Packaged (DMG / `dist:mac`) builds must NOT show the console by default.**
  The DevTools inspector is opened only in development (`!app.isPackaged`) in
  `src/main/index.ts`. Never open DevTools unconditionally — end users should
  not see the console on launch.
- The macOS build is currently **unsigned** (`identity: null` in
  `electron-builder.yml`). Downloaded DMGs trip Gatekeeper ("damaged"); fixing
  it requires clearing quarantine + ad-hoc re-signing, or signing + notarizing
  with an Apple Developer ID for a clean install.

## Releases

- Distributed via GitHub releases on `petit-software/ultra`, tag `v<version>`.
  Re-upload artifacts with `gh release upload <tag> <files> --clobber`.

// electron-builder afterSign hook: notarize the .app with Apple, then staple.
// Auth comes from a keychain profile created once via:
//   xcrun notarytool store-credentials "ultra-notary" \
//     --apple-id <apple-id> --team-id <team-id> --password <app-specific-password>
//
// Set SKIP_NOTARIZE=1 to skip (e.g. quick local/unsigned builds).
const { notarize } = require('@electron/notarize')
const { execFileSync } = require('node:child_process')

const KEYCHAIN_PROFILE = 'ultra-notary'

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') return
  if (process.env.SKIP_NOTARIZE === '1') {
    console.log('  • notarize  skipped (SKIP_NOTARIZE=1)')
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = `${appOutDir}/${appName}.app`

  console.log(`  • notarize  submitting ${appName}.app (keychain profile "${KEYCHAIN_PROFILE}")…`)
  await notarize({ tool: 'notarytool', appPath, keychainProfile: KEYCHAIN_PROFILE })

  console.log('  • notarize  stapling ticket…')
  execFileSync('xcrun', ['stapler', 'staple', appPath], { stdio: 'inherit' })
  console.log('  • notarize  done')
}

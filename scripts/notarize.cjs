// electron-builder afterSign hook: notarize the .app with Apple, then staple.
// Preferred auth uses an App Store Connect API key, which avoids app-specific
// passwords:
//   NOTARY_API_KEY=/path/to/AuthKey_XXXXXXXXXX.p8
//   NOTARY_API_KEY_ID=XXXXXXXXXX
//   NOTARY_API_ISSUER=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
//
// Fallback auth uses a keychain profile created once via notarytool.
//
// Set SKIP_NOTARIZE=1 to skip (e.g. quick local/unsigned builds).
const { notarize } = require('@electron/notarize')
const { execFileSync } = require('node:child_process')
const os = require('node:os')
const path = require('node:path')

const KEYCHAIN_PROFILE = 'ultra-notary'
// Pin the keychain explicitly — without it, notarytool can fail to locate the
// saved profile ("No Keychain password item found") depending on the default
// keychain search list. Override with NOTARY_KEYCHAIN if needed.
const KEYCHAIN =
  process.env.NOTARY_KEYCHAIN || path.join(os.homedir(), 'Library/Keychains/login.keychain-db')

function notarizeAuthOptions() {
  const appleApiKey = process.env.NOTARY_API_KEY
  const appleApiKeyId = process.env.NOTARY_API_KEY_ID
  const appleApiIssuer = process.env.NOTARY_API_ISSUER

  if (appleApiKey || appleApiKeyId || appleApiIssuer) {
    const missing = [
      ['NOTARY_API_KEY', appleApiKey],
      ['NOTARY_API_KEY_ID', appleApiKeyId],
      ['NOTARY_API_ISSUER', appleApiIssuer]
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name)

    if (missing.length > 0) {
      throw new Error(`Missing App Store Connect notarization env vars: ${missing.join(', ')}`)
    }

    return {
      label: `ASC API key "${appleApiKeyId}"`,
      options: { appleApiKey, appleApiKeyId, appleApiIssuer }
    }
  }

  return {
    label: `keychain profile "${KEYCHAIN_PROFILE}"`,
    options: { keychainProfile: KEYCHAIN_PROFILE, keychain: KEYCHAIN }
  }
}

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') return
  if (process.env.SKIP_NOTARIZE === '1') {
    console.log('  • notarize  skipped (SKIP_NOTARIZE=1)')
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = `${appOutDir}/${appName}.app`
  const auth = notarizeAuthOptions()

  console.log(`  • notarize  submitting ${appName}.app (${auth.label})…`)
  await notarize({
    tool: 'notarytool',
    appPath,
    ...auth.options
  })

  console.log('  • notarize  stapling ticket…')
  execFileSync('xcrun', ['stapler', 'staple', appPath], { stdio: 'inherit' })
  console.log('  • notarize  done')
}

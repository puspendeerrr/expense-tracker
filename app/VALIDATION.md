# Phase 1 validation record

Date: 21 September 2026. See README.md for versions, architecture and daily commands.

## Results

| Check | Result |
| --- | --- |
| TypeScript | Passed (`npm run typecheck`) |
| ESLint | Passed (`npm run lint`) |
| Expo version alignment | Passed (`npx expo install --check`) |
| Expo Doctor | 21/21 checks passed |
| Public Expo configuration | Name, package, version, automatic appearance and dev-client/router plugins verified |
| Android prebuild | Passed; compile/target API 36, min API 24, versionCode 1 |
| Android JS/Hermes export | Passed, 1,247 modules; not a native build result |
| adb | 37.0.1 Platform Tools; Galaxy M34 SM_M346B authorized as `device` |
| USB forwarding | Ports 8081 and 5000 configured and listed by adb |
| Metro | Started on localhost:8081 in development-client mode |
| Native build/install | Passed: 14m 26s, 455 tasks; 88,171,994-byte arm64 debug APK installed by Expo/adb |
| Phone launch | Pending unlocked-phone verification |
| Fast Refresh on phone | Pending native installation |
| Deprecated npm packages | Zero packages marked deprecated in final lockfile |
| npm audit | Three moderate entries in one upstream Router dependency chain; unresolved |
| Existing web/backend | No tracked files modified outside app/ |

## Commands performed

Read-only inspection included `git status --short`, repository file searches,
Node/npm versions, Get-Command for Java/adb/WinGet, environment variables,
installed programs, OS/RAM/disk checks and Windows PnP inspection of the phone.
Official documentation and npm metadata were checked before selecting the stack.

Project commands (from root for creation, otherwise app/):

```text
npm view expo version
npm view create-expo-app version
npx --yes create-expo-app@latest app --template default@sdk-57 --yes
npx expo install expo-dev-client
npx expo install eslint eslint-config-expo --dev
npm install --save-dev eslint@latest
npm uninstall eslint-config-expo
npm install --save-dev @eslint/js typescript-eslint
npm pkg set scripts.lint="eslint ."
npm pkg set overrides.xcode.uuid=11.1.1
npm install
npm run typecheck
npm run lint
npx expo install --check
npx expo-doctor@latest
npx expo config --type public
npx expo prebuild --platform android --no-install
npm run export:android
npm audit --json
npm ls --depth=0
npx expo run:android --device SM_M346B --no-bundler
./scripts/usb.ps1
npm start
```

The template's unused direct packages were removed from package.json before
reinstalling. Final versions are listed in README and locked in package-lock.json.
No force audit fix, Expo downgrade, global expo-cli or react-native-cli was used.

Machine commands included the two WinGet installations in README, official SDK
archive download/checksum/extraction, `sdkmanager --licenses`, SDK installation,
`android --no-metrics --version`, `android --no-metrics sdk list`, Java version,
`adb devices -l`, `adb version`, and `adb reverse` for 8081/5000.
The SDK download switched from slow PowerShell Invoke-WebRequest to curl.exe;
the completed archive's official checksum was verified.

## Issues and resolutions

- Phone initially unauthorized: owner accepted the phone's RSA prompt; adb then
  reported `device`. Existing Samsung ADB driver worked, no new driver needed.
- SDK Manager deprecation: installed tools warned that sdkmanager is deprecated.
  Installed/verified Android CLI and documented `android sdk` for ongoing use.
- ESLint: Expo preset selected deprecated version 9, then failed with v10 because
  its React plugin calls removed APIs. Replaced with maintained typescript-eslint
  flat configuration. Lint and typecheck passed afterward.
- uuid: Expo's xcode tool depended on deprecated/vulnerable uuid 7. Override to
  11.1.1 preserves its CommonJS v4 API. A direct xcode UUID generation check passed.
- Remaining audit: Expo Router → query-string 7 → decode-uri-component has a
  moderate malformed-input denial-of-service advisory. Patched decoder is ESM;
  caller expects CommonJS. Forced npm fix would downgrade Router incompatibly.
  Left documented pending an upstream compatible fix; see README advisory link.
- Expo device selection: this CLI's `--device` expects a device name; passing the
  adb serial failed. `--device SM_M346B` selected the authorized phone correctly.
- Gradle wrapper's download from services.gradle.org timed out at the GitHub
  redirect. curl could reach the same official URL. Downloaded the exact 9.3.1
  distribution into the wrapper cache and verified its official `.sha256` before
  retrying. No Gradle version, mirror, TLS policy or project wrapper was changed.
- Gradle requested Build Tools 35.0.0 in addition to 36.0.0; it installed that
  side-by-side component automatically. No emulator was installed.
- Cross-drive C:/D: hard links fell back to ordinary copies during native
  compilation; slower but successful, no workaround required.
- Browser requests to Metro attempted a web bundle after web-only packages were
  removed. Restricted Expo platforms to Android/iOS and restarted Metro; this
  project intentionally does not supply a second web client.
- Expo's initial launch URL used LAN. For USB verification explicitly launched
  the development client with the documented 127.0.0.1 URL and adb reverse.

## Files / external effects

All repository changes are under app/: source routes/screens/components/theme,
public environment example, ignored local env, app configuration, placeholder
icons, package manifest/lockfile, TypeScript/ESLint configuration, scripts and docs.
Generated android/, node_modules/, dist/, .expo/ and artifacts/ are ignored.

Outside the repository, installed Studio/JDK/SDK, set user JAVA_HOME/ANDROID_HOME
and three PATH entries, populated standard npm/Gradle/Android caches and accepted
SDK licenses. adb authorized this PC after user interaction. No backend secrets
were copied and no existing server/client implementation was changed.

Local evidence: artifacts/android-build.log, artifacts/metro.log,
artifacts/npm-audit.json and artifacts/sdk-packages.txt (ignored).

# Building SplitMoney for release

How to produce store builds of the SplitMoney mobile app for **Android** (Google Play) and
**iOS** (App Store / TestFlight). Every command here is meant to be run from the `app/`
folder unless it says otherwise.

| | Android | iOS |
|---|---|---|
| App name on the device | SplitMoney | SplitMoney |
| Application / bundle id | `com.chaten.splitwise.mobile` (see [Identifiers](#identifiers)) | `com.chaten.splitmoney` |
| Store artifact | `.aab` (Play) + `.apk` (sideload/testing) | `.ipa` |
| Can be built on Windows | Yes, locally | Only in the cloud, with EAS Build |
| Signing | Upload keystore `splitmoney-release.jks` | Apple distribution certificate + provisioning profile (EAS creates them) |
| Push notifications | Firebase (`google-services.json`) → Expo push | APNs key → Expo push |

---

## Contents

1. [What is already configured](#1-what-is-already-configured)
2. [One-time setup](#2-one-time-setup)
3. [Production settings (`.env`)](#3-production-settings-env)
4. [Android: local build on Windows](#4-android-local-build-on-windows)
5. [Android: cloud build with EAS](#5-android-cloud-build-with-eas)
6. [iOS: everything you need](#6-ios-everything-you-need)
7. [iOS: cloud build with EAS (works from Windows)](#7-ios-cloud-build-with-eas-works-from-windows)
8. [iOS: local build on a Mac with Xcode](#8-ios-local-build-on-a-mac-with-xcode)
9. [Uploading to the stores](#9-uploading-to-the-stores)
10. [Versioning](#10-versioning)
11. [App icon and launch screen](#11-app-icon-and-launch-screen)
12. [Identifiers](#identifiers)
13. [Troubleshooting](#13-troubleshooting)
14. [Command reference](#14-command-reference)

---

## 1. What is already configured

- **Name:** `SplitMoney` everywhere a person sees it (launcher, home screen, settings, store).
- **Icons:** generated from the brand logo (`client/public/SplitMoney only logo.svg`):
  - `assets/icon.png`: 1024×1024, opaque white, used by iOS and legacy Android.
  - `assets/adaptive-icon.png`: Android adaptive foreground, transparent, safe-zone sized.
  - `assets/adaptive-icon-monochrome.png`: Android 13+ themed icon.
  - `assets/notification-icon.png`: white status-bar glyph.
  - `assets/splash-icon.png`: launch screen mark.
  - `assets/store-icon-512.png`: Play Store listing icon (512×512).
- **Launch screen:** the SplitMoney mark on white, or on `#09090B` in dark mode
  (`expo-splash-screen`).
- **Release signing (Android):** `plugins/withReleaseSigning.js` signs release builds with
  the upload key and never the debug key. Credentials are read at build time and are not
  stored in the repository.
- **Guards in `app.config.ts`:** a production build fails if the API is not `https://`,
  or if ads are on with Google's sample AdMob app id.
- **Production hardening:**
  - The development launcher is removed.
  - The "draw over other apps" permission is blocked.
  - Microphone and storage-write permissions are blocked.
- **iOS:**
  - The push entitlement is `production` for production builds.
  - `ITSAppUsesNonExemptEncryption = false` is set, so App Store Connect doesn't ask the
    export-compliance question on every upload.
  - iPhone only (`supportsTablet: false`).
- **`eas.json`:** `development`, `preview` (installable, internal) and `production`
  (store) profiles.

---

## 2. One-time setup

### Tools

| Tool | Version | Needed for | Check |
|---|---|---|---|
| Node.js | ≥ 22.13 | everything | `node -v` |
| npm | bundled | everything | `npm -v` |
| JDK | 17 | Android local builds | `java -version` |
| Android SDK | platform 36, build-tools 36 | Android local builds | `sdkmanager --list_installed` |
| EAS CLI | latest | cloud builds, iOS from Windows, submissions | `npx eas-cli@latest --version` |
| Xcode | 26 or newer | iOS local builds (Mac only) | `xcodebuild -version` |
| CocoaPods | latest | iOS local builds (Mac only) | `pod --version` |

```powershell
cd app
npm ci                              # exact dependency versions from package-lock.json
npx expo-doctor@latest              # checks SDK/dependency compatibility
npx eas-cli@latest login            # once per machine (account: chatwn)
npx eas-cli@latest whoami
```

The Expo project is already linked through `extra.eas.projectId` in `app.config.ts`
(`da93a159-6ca2-4aa0-af94-02f58b190f11`), so there's no need to run `eas init`.

### Files that are deliberately not in git

| File | What it is | Keep it |
|---|---|---|
| `app/.env` | production public settings (API URL, AdMob ids, Cloudinary preset) | on the build machine and in EAS env |
| `app/google-services.json` | Firebase config for Android push | on the build machine and uploaded to EAS as a file variable |
| `app/splitmoney-release.jks` | **Android upload key** | back it up in two safe places; losing it means asking Google to reset the upload key |
| `app/splitmoney-release.old.jks` | an older keystore kept from `android/app/` before it was regenerated | keep until you're sure it was never used for an upload |
| `*firebase-adminsdk*.json` | Firebase **server** credentials | belongs on the server only. It must never be bundled into the app, and it is not referenced by the app. Move it out of `app/` when convenient. |

---

## 3. Production settings (`.env`)

`app/.env` holds the production values. Everything prefixed `EXPO_PUBLIC_` is compiled
into the app and is readable by anyone who unpacks it, so **only public values belong
here**. Never put API secrets, database URLs or server keys in it.

```dotenv
EXPO_PUBLIC_APP_ENV=production
EXPO_PUBLIC_API_URL=https://splitmoney.algorithyum.in/api

EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=...
EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=...        # unsigned, upload-only preset
EXPO_PUBLIC_CLOUDINARY_FOLDER=...

EXPO_PUBLIC_ADS_ENABLED=true
EXPO_PUBLIC_ADS_INTERSTITIALS_ENABLED=...
EXPO_PUBLIC_ANDROID_ADMOB_APP_ID=ca-app-pub-XXXXXXXX~XXXXXXXX
EXPO_PUBLIC_ANDROID_BANNER_AD_UNIT_ID=ca-app-pub-XXXXXXXX/XXXXXXXX
EXPO_PUBLIC_ANDROID_INTERSTITIAL_AD_UNIT_ID=ca-app-pub-XXXXXXXX/XXXXXXXX
EXPO_PUBLIC_IOS_ADMOB_APP_ID=ca-app-pub-XXXXXXXX~XXXXXXXX
EXPO_PUBLIC_IOS_BANNER_AD_UNIT_ID=ca-app-pub-XXXXXXXX/XXXXXXXX
EXPO_PUBLIC_IOS_INTERSTITIAL_AD_UNIT_ID=ca-app-pub-XXXXXXXX/XXXXXXXX
```

> **Watch out:** Expo also loads `.env.local`, and it **overrides** `.env`. On this
> machine `.env.local` is the development file (`http://localhost:5000/api`). A plain
> `npx expo prebuild` would therefore pick up development values. The build script loads
> `.env` into the process first, which always wins. If you build by hand, do the same
> (see §4.3).

Check the API is reachable before building:

```powershell
curl.exe -s -o NUL -w "%{http_code}`n" https://splitmoney.algorithyum.in/api/health   # expect 200
```

---

## 4. Android: local build on Windows

### 4.1 The upload key

Release builds are signed by `plugins/withReleaseSigning.js`, which reads four values
from **Gradle properties or environment variables**:

| Name | Value |
|---|---|
| `SPLITMONEY_UPLOAD_STORE_FILE` | path to the keystore (defaults to `app/splitmoney-release.jks`) |
| `SPLITMONEY_UPLOAD_KEY_ALIAS` | the key's alias |
| `SPLITMONEY_UPLOAD_STORE_PASSWORD` | keystore password |
| `SPLITMONEY_UPLOAD_KEY_PASSWORD` | key password (often the same) |

Pick one way to provide them.

**A. Let the script ask (recommended).** Nothing is written to disk:

```powershell
.\scripts\build-android-release.ps1 -VersionCode 2
# prompts: Upload key alias / Keystore password / Key password
```

**B. Keep them in your user Gradle properties**, outside the repo, in
`%USERPROFILE%\.gradle\gradle.properties`:

```properties
SPLITMONEY_UPLOAD_STORE_FILE=D:/Web Dev/SplitWise/app/splitmoney-release.jks
SPLITMONEY_UPLOAD_KEY_ALIAS=your-alias
SPLITMONEY_UPLOAD_STORE_PASSWORD=...
SPLITMONEY_UPLOAD_KEY_PASSWORD=...
```

Don't know the alias? Run this and enter the keystore password when asked:

```powershell
. .\scripts\android-env.ps1
keytool -list -v -keystore splitmoney-release.jks | Select-String "Alias name","SHA256"
```

If the values are missing, the release build is produced **unsigned** and Gradle prints
`SplitMoney: upload key not configured`. It never falls back to the debug key.

### 4.2 Build with the script

```powershell
cd app
.\scripts\build-android-release.ps1 -VersionCode 2            # signed .aab + .apk
.\scripts\build-android-release.ps1 -VersionCode 2 -Unsigned  # compile check only
.\scripts\build-android-release.ps1 -VersionCode 2 -SkipPrebuild   # reuse android/ as is
```

What it does:

1. Loads `.env` (production) into the process.
2. Refuses anything but `production` with an `https://` API.
3. Asks for the key.
4. Runs `expo prebuild --platform android --clean`.
5. Runs `gradlew bundleRelease assembleRelease`.
6. Copies the results to:

```text
app/artifacts/release/SplitMoney-0.1.0-2.aab    ← upload this to Google Play
app/artifacts/release/SplitMoney-0.1.0-2.apk    ← install directly on a phone
```

### 4.3 The same thing by hand

```powershell
cd app
. .\scripts\android-env.ps1                                   # JAVA_HOME, ANDROID_HOME, PATH

# Production values from .env, overriding .env.local
Get-Content .env | Where-Object { $_ -match '^(EXPO_PUBLIC_[A-Z0-9_]+)=(.*)$' } | ForEach-Object {
  Set-Item "Env:$($Matches[1])" $Matches[2]
}
$env:NODE_ENV = 'production'
$env:ANDROID_VERSION_CODE = '2'

npx expo config --type public | Select-String "apiUrl|package|versionCode"   # sanity check
npx expo prebuild --platform android --clean
cd android
.\gradlew.bat bundleRelease        # -> app\build\outputs\bundle\release\app-release.aab
.\gradlew.bat assembleRelease      # -> app\build\outputs\apk\release\app-release.apk
```

### 4.4 Verify the build

```powershell
. .\scripts\android-env.ps1
$bt = Get-ChildItem "$env:ANDROID_HOME\build-tools" | Sort-Object Name | Select-Object -Last 1

# Who signed it (must be the upload key, never "Android Debug")
& "$($bt.FullName)\apksigner.bat" verify --print-certs artifacts\release\SplitMoney-0.1.0-2.apk
keytool -printcert -jarfile artifacts\release\SplitMoney-0.1.0-2.aab

# Install on a USB phone and open it
adb install -r artifacts\release\SplitMoney-0.1.0-2.apk
adb shell monkey -p com.chaten.splitwise.mobile 1
```

> A release APK can't be installed over the **development** build: they're signed by
> different keys. Uninstall the dev build first (`adb uninstall com.chaten.splitwise.mobile`).
> Uninstalling signs you out on that phone.

### 4.5 Going back to development

The production prebuild removes the development launcher from `android/`. To go back to
day-to-day development:

```powershell
npx expo prebuild --platform android --clean     # with .env.local in effect
npx expo run:android --device
```

---

## 5. Android: cloud build with EAS

Useful when you don't want to use the local toolchain. Files ignored by git are **not**
uploaded, so give EAS the settings first (once, and again whenever they change):

```powershell
# public settings from .env -> EAS "production" environment
npx eas-cli@latest env:push --environment production --path .env

# Firebase config for Android push, as a secret file variable
npx eas-cli@latest env:create --environment production --name GOOGLE_SERVICES_JSON `
  --type file --value .\google-services.json --visibility secret

# upload key: give EAS the existing keystore (Android > production > Keystore > Set up a new keystore / use existing)
npx eas-cli@latest credentials --platform android
```

`app.config.ts` already reads `GOOGLE_SERVICES_JSON` when it's set.

```powershell
$env:ANDROID_VERSION_CODE = '2'
npx eas-cli@latest build --platform android --profile production   # .aab for Play
npx eas-cli@latest build --platform android --profile preview      # installable .apk
```

`ANDROID_VERSION_CODE` must be available to the build. Either add it to the profile's
`env` in `eas.json`, or run `eas env:create --name ANDROID_VERSION_CODE --value 2
--environment production` and update it on every release.

---

## 6. iOS: everything you need

An iOS build **can't be produced on Windows**: Apple's toolchain runs only on macOS.
You have two options:

- **EAS Build (§7):** Expo compiles on a Mac in the cloud. You can start it from this
  Windows machine. **Recommended.**
- **A Mac with Xcode (§8):** a fully local build.

Either way, you need the following first.

### 6.1 Apple accounts

1. **Apple Developer Program** membership (USD 99/year) at https://developer.apple.com/programs/.
   An individual account is enough; an organisation needs a D-U-N-S number.
2. Sign in to **App Store Connect**: https://appstoreconnect.apple.com.
3. Two-factor authentication must be on for the Apple ID.

### 6.2 Register the app identifier

The bundle identifier is **`com.chaten.splitmoney`**.

1. developer.apple.com → Certificates, IDs & Profiles → Identifiers → **+** → App IDs → App.
2. Description `SplitMoney`, Bundle ID **Explicit** `com.chaten.splitmoney`.
3. Capabilities: tick **Push Notifications**.
4. Continue → Register.

EAS can do this for you on the first build (§7) if you let it sign in to Apple.

### 6.3 Create the app in App Store Connect

1. App Store Connect → Apps → **+** → New App.
2. Fill in:
   - Platform: iOS
   - Name: **SplitMoney** (must be unique on the App Store; if it's taken, use something
     like "SplitMoney – Split Expenses", which only changes the store listing)
   - Primary language: English (India) or English (U.S.)
   - Bundle ID: `com.chaten.splitmoney`
   - SKU: `splitmoney-ios`
   - User Access: Full Access
3. Note the **Apple ID** of the app (a number, under App Information). This is the
   `ascAppId` used for submitting.

### 6.4 Push notifications (APNs key)

The server sends pushes through Expo's push service, which needs an **APNs key** for iOS.
No Firebase file is needed for iOS.

1. developer.apple.com → Keys → **+** → name `SplitMoney APNs` → tick **Apple Push
   Notifications service (APNs)** → Continue → Register.
2. **Download the `.p8` file.** It can be downloaded only once. Note the **Key ID** and
   your **Team ID** (top right of the developer site).
3. Give it to EAS:

   ```powershell
   npx eas-cli@latest credentials --platform ios
   # production -> Push Notifications: Manage your Apple Push Notifications Key -> Upload the .p8
   ```

Never commit the `.p8`. `.gitignore` already excludes `*.p8`.

### 6.5 AdMob for iOS

1. AdMob → Apps → Add app → iOS → "SplitMoney".
2. Create a banner unit and an interstitial unit for it.
3. Put the ids in `.env` and push them to EAS again (§7.1):

```dotenv
EXPO_PUBLIC_IOS_ADMOB_APP_ID=ca-app-pub-XXXXXXXX~XXXXXXXX
EXPO_PUBLIC_IOS_BANNER_AD_UNIT_ID=ca-app-pub-XXXXXXXX/XXXXXXXX
EXPO_PUBLIC_IOS_INTERSTITIAL_AD_UNIT_ID=ca-app-pub-XXXXXXXX/XXXXXXXX
```

If the iOS AdMob app id is missing, the build falls back to Google's **sample** id. Test
ads would then show in production and AdMob would flag the traffic. Set the real id
before a store build.

### 6.6 Privacy details App Store Connect will ask for

Under App Privacy → Data collection, based on what the app actually does:

| Data | Collected | Linked to the user | Used for |
|---|---|---|---|
| Name, email address | Yes | Yes | App functionality (account) |
| Financial info: expenses, balances, payments recorded by the user | Yes | Yes | App functionality |
| Photos (receipts, payment proofs, avatars the user chooses to upload) | Yes | Yes | App functionality |
| Device ID (push token) | Yes | Yes | App functionality (notifications) |
| Advertising data (AdMob) | Yes | No | Third-party advertising |

The app does **not** track users across other companies' apps and does not show the
App Tracking Transparency prompt, so AdMob serves non-personalised ads on iOS. You'll also
need a privacy policy URL, a support URL, screenshots (6.9" iPhone) and an age rating.

---

## 7. iOS: cloud build with EAS (works from Windows)

### 7.1 Settings (once, and whenever they change)

```powershell
cd app
npx eas-cli@latest login
npx eas-cli@latest env:push --environment production --path .env
```

### 7.2 Build

```powershell
$env:IOS_BUILD_NUMBER = '1'      # must go up for every upload of the same version
npx eas-cli@latest build --platform ios --profile production
```

On the first run EAS asks:

1. **"Do you want to log in to your Apple account?"** Yes. Sign in with the Apple ID
   from §6.1 (you'll get a 2FA code).
2. **Select team.**
3. **Bundle identifier `com.chaten.splitmoney`:** EAS registers it if §6.2 wasn't done.
4. **Distribution Certificate:** let EAS generate one (Apple allows two per account).
5. **Provisioning Profile:** let EAS generate one.
6. **Push key:** use the one uploaded in §6.4, or let EAS create one.

EAS keeps these credentials for future builds. The build runs on Expo's Macs (roughly
15–30 minutes) and ends with a link to download the **`.ipa`**.

`IOS_BUILD_NUMBER` must be visible to the build. Put it in `eas.json` →
`build.production.env`, or run `eas env:create --name IOS_BUILD_NUMBER --value 1
--environment production`, and raise it on every upload.

### 7.3 Submit to TestFlight / App Store

```powershell
npx eas-cli@latest submit --platform ios --latest
# asks for the App Store Connect app (ascAppId from §6.3) the first time
```

Or build and submit in one go:

```powershell
npx eas-cli@latest build --platform ios --profile production --auto-submit
```

About 10–30 minutes after upload the build appears in App Store Connect → TestFlight.
Add yourself as an internal tester, install **TestFlight** on the iPhone and test there.
Then in App Store Connect → the app → **+ Version**, pick the build, fill in the listing
and **Submit for Review**.

### 7.4 Test on a real iPhone without TestFlight (optional)

```powershell
npx eas-cli@latest device:create            # register the iPhone's UDID (opens a link on the phone)
npx eas-cli@latest build --platform ios --profile preview
```

The `preview` profile produces an ad-hoc build that installs from a link on registered
devices only.

---

## 8. iOS: local build on a Mac with Xcode

Only if you have a Mac with Xcode installed.

```bash
# 1. Tools
xcode-select --install
sudo xcodebuild -license accept
sudo gem install cocoapods          # or: brew install cocoapods
node -v                             # >= 22.13

# 2. Code and dependencies
git clone <repo> SplitWise && cd SplitWise/app
npm ci
cp /path/to/.env .env               # production settings (§3); do NOT copy .env.local

# 3. Production environment for this shell
set -a && source .env && set +a
export NODE_ENV=production
export IOS_BUILD_NUMBER=1

# 4. Generate the native iOS project and install pods
npx expo prebuild --platform ios --clean
cd ios && pod install && cd ..

# 5. Open in Xcode
open ios/SplitMoney.xcworkspace
```

In Xcode:

1. Select the **SplitMoney** target → **Signing & Capabilities**:
   - Team: your Apple team.
   - Bundle Identifier: `com.chaten.splitmoney`.
   - "Automatically manage signing": on, or pick your App Store provisioning profile.
   - Check that **Push Notifications** is listed as a capability.
2. At the top, choose the device **Any iOS Device (arm64)**.
3. **Product → Archive**. When it finishes, the Organizer opens.
4. **Distribute App → App Store Connect → Upload**. This sends it to TestFlight.

Or, from the command line:

```bash
xcodebuild -workspace ios/SplitMoney.xcworkspace -scheme SplitMoney \
  -configuration Release -destination 'generic/platform=iOS' \
  -archivePath build/SplitMoney.xcarchive archive

xcodebuild -exportArchive -archivePath build/SplitMoney.xcarchive \
  -exportOptionsPlist ExportOptions.plist -exportPath build/ipa
```

With `ExportOptions.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>YOUR_TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>uploadSymbols</key><true/>
</dict>
</plist>
```

Upload the `.ipa` with Apple's **Transporter** app, or:

```bash
xcrun altool --upload-app -f build/ipa/SplitMoney.ipa -t ios \
  --apiKey <APP_STORE_CONNECT_KEY_ID> --apiIssuer <ISSUER_ID>
```

To run it on a connected iPhone instead: `npx expo run:ios --device --configuration Release`.

---

## 9. Uploading to the stores

### Google Play

1. https://play.google.com/console → **Create app**:
   - Name **SplitMoney**, App, Free.
   - Declarations ticked.
2. **Setup → App signing:** use Play App Signing. Google holds the app signing key; your
   `splitmoney-release.jks` is the **upload key**.
3. **Testing → Internal testing → Create release:**
   - Upload `artifacts/release/SplitMoney-<version>-<code>.aab`.
   - Add testers' emails.
   - Save and roll out.
4. Before production, complete the Play Console forms:
   - **Data safety** (same facts as §6.6).
   - **Contains ads: Yes.**
   - Content rating.
   - Target audience.
   - Privacy policy URL.
   - Store listing: icon `assets/store-icon-512.png`, a 1024×500 feature graphic, and
     phone screenshots.
5. New personal developer accounts must run a **closed test with at least 12 testers for
   14 days** before production access is granted.

Or, from the command line after the first manual upload:

```powershell
npx eas-cli@latest submit --platform android --path artifacts\release\SplitMoney-0.1.0-2.aab
```

(Needs a Google Play service-account JSON. EAS asks for it the first time. The
`production` submit profile uploads to the internal track as a draft.)

### Apple App Store

See §7.3 (EAS) or §8 (Xcode/Transporter).

---

## 10. Versioning

| Field | Where | Rule |
|---|---|---|
| `version` | `app.config.ts` (`0.1.0`) and `package.json` | what people see. Raise it for each public release (`0.2.0`, `1.0.0`). |
| Android `versionCode` | `ANDROID_VERSION_CODE` env / `-VersionCode` | integer, **must increase on every Play upload**; never reuse one |
| iOS `buildNumber` | `IOS_BUILD_NUMBER` env | must increase for every upload of the same `version`; can restart at 1 for a new `version` |

Keep a note of the last code you uploaded. Play and App Store Connect both reject a
repeat.

---

## 11. App icon and launch screen

The icons come from `client/public/SplitMoney only logo.svg`. To change the logo,
replace that SVG and regenerate the icon PNGs listed in §1 at the same sizes:

| File | Size | Background | Logo size |
|---|---|---|---|
| `icon.png` | 1024 | opaque `#FFFFFF`; iOS rejects transparency | about 74% of the width |
| `adaptive-icon.png` | 1024 | transparent | about 56% (inside the 66% safe zone) |
| `adaptive-icon-monochrome.png` | 1024 | transparent, logo solid black | about 56% |
| `notification-icon.png` | 96 | transparent, logo solid white | about 84% |
| `splash-icon.png` | 1024 | transparent | about 90% |
| `store-icon-512.png` | 512 | opaque `#FFFFFF` | about 74% |

Icons are compiled into the native project, so after changing them rebuild with
`expo prebuild --clean`. A Metro reload doesn't pick them up.

---

## Identifiers

| | Value | Why |
|---|---|---|
| Display name | **SplitMoney** | |
| iOS bundle id | `com.chaten.splitmoney` | never built before, so it takes the product name |
| Android application id | `com.chaten.splitwise.mobile` | Firebase (`google-services.json`) is registered for this id. Changing it breaks the build until a matching Firebase app exists. |
| Expo slug | `splitwise-mobile` | linked to the EAS project id; users never see it |
| URL schemes | `splitmoney` (primary), `splitwise-mobile`, `splitwise` | old ones kept so existing links still work |

**Renaming the Android id to `com.chaten.splitmoney`:** this must happen **before the
first Play upload** or never, because Play treats a new id as a different app.

1. Firebase console → project `splitmoney-aa78a` → Add app → Android → package
   `com.chaten.splitmoney`.
2. Download the new `google-services.json` and replace `app/google-services.json`.
3. In `app.config.ts` set `android.package: 'com.chaten.splitmoney'`.
4. Rebuild with `prebuild --clean`.

Every existing install is a different app afterwards, so testers must reinstall and sign
in again.

---

## 13. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Production builds require EXPO_PUBLIC_API_URL to be an https:// address` | `.env.local` overrode `.env`, or `.env` is missing | use the script, or load `.env` into the shell first (§4.3) |
| `...must not use Google's sample AdMob app id` | ads enabled without a real Android AdMob id | set `EXPO_PUBLIC_ANDROID_ADMOB_APP_ID` or `EXPO_PUBLIC_ADS_ENABLED=false` |
| Gradle warns `upload key not configured` and output is `*-unsigned` | signing values not set | §4.1 |
| `Keystore was tampered with, or password was incorrect` | wrong keystore password | re-enter; check `SPLITMONEY_UPLOAD_STORE_PASSWORD` |
| `No key with alias '...' found` | wrong alias | `keytool -list -v -keystore splitmoney-release.jks` |
| `No matching client found for package name` | Android id doesn't match `google-services.json` | see [Identifiers](#identifiers) |
| `INSTALL_FAILED_UPDATE_INCOMPATIBLE` on `adb install` | a build signed with another key (the dev build) is installed | `adb uninstall com.chaten.splitwise.mobile` |
| Play: "Version code 1 has already been used" | reused `versionCode` | raise `-VersionCode` |
| App shows the old icon | launcher cache, or `prebuild` not re-run | rebuild with `--clean`; uninstall and reinstall |
| EAS: "google-services.json is missing" | the file is gitignored and not uploaded | §5, `GOOGLE_SERVICES_JSON` file variable |
| iOS: push token error on device | no APNs key in EAS, or a dev entitlement | §6.4; production builds use the `production` entitlement |
| App Store Connect: "Missing Compliance" | — | already answered by `usesNonExemptEncryption: false` |
| iOS build: "Provisioning profile doesn't include the aps-environment entitlement" | App ID created without Push Notifications | tick Push Notifications on the identifier (§6.2), then `eas credentials` → remove and regenerate the profile |

---

## 14. Command reference

```powershell
# ---------- setup ----------
cd app
npm ci
npx expo-doctor@latest
npx eas-cli@latest login

# ---------- checks before any release ----------
npm run typecheck
npm run lint
curl.exe -s -o NUL -w "%{http_code}`n" https://splitmoney.algorithyum.in/api/health

# ---------- Android, local ----------
.\scripts\build-android-release.ps1 -VersionCode <n>             # signed .aab + .apk
.\scripts\build-android-release.ps1 -VersionCode <n> -Unsigned   # compile check
adb install -r artifacts\release\SplitMoney-<version>-<n>.apk

# ---------- Android, EAS ----------
npx eas-cli@latest env:push --environment production --path .env
npx eas-cli@latest credentials --platform android
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform android --latest

# ---------- iOS, EAS (from Windows) ----------
npx eas-cli@latest env:push --environment production --path .env
npx eas-cli@latest credentials --platform ios                     # APNs key, certs
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --latest

# ---------- iOS, Mac ----------
#   set -a && source .env && set +a && export NODE_ENV=production IOS_BUILD_NUMBER=<n>
#   npx expo prebuild --platform ios --clean && (cd ios && pod install)
#   open ios/SplitMoney.xcworkspace   ->  Product > Archive > Distribute

# ---------- back to development ----------
npx expo prebuild --platform android --clean
npx expo run:android --device
```

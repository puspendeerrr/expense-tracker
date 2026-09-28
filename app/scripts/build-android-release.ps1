<#
.SYNOPSIS
  Builds the SplitMoney Android release: a Play Store bundle (.aab) and an installable APK.

.DESCRIPTION
  1. Loads the production settings from app/.env into THIS process only. Expo would
     otherwise let .env.local (development, http://localhost) override them.
  2. Refuses to continue unless the environment is production and the API is https://.
  3. Asks for the upload-key details if they are not already set. They are kept in this
     process's memory and never written to disk.
  4. Regenerates android/ with `expo prebuild --clean`, then runs Gradle.
  5. Copies the results to app/artifacts/release/ as SplitMoney-<version>-<code>.aab/.apk.

.EXAMPLE
  cd app
  .\scripts\build-android-release.ps1 -VersionCode 2

.EXAMPLE
  .\scripts\build-android-release.ps1 -VersionCode 2 -Unsigned   # compile check, no key needed
#>
param(
  [Parameter(Mandatory = $true)][int]$VersionCode,
  [switch]$Unsigned,
  [switch]$SkipPrebuild
)

$ErrorActionPreference = 'Stop'
$app = Split-Path -Parent $PSScriptRoot
Set-Location $app
. "$PSScriptRoot\android-env.ps1"

# ---- 1. Production settings from .env -----------------------------------------------
if (-not (Test-Path '.env')) { throw 'app/.env (production settings) is missing. Copy .env.example and fill it in.' }
foreach ($line in Get-Content '.env') {
  if ($line -match '^\s*(EXPO_PUBLIC_[A-Z0-9_]+)\s*=\s*(.*)\s*$') {
    Set-Item -Path "Env:$($Matches[1])" -Value $Matches[2].Trim('"').Trim("'")
  }
}
$env:NODE_ENV = 'production'
$env:ANDROID_VERSION_CODE = "$VersionCode"

# ---- 2. Guards --------------------------------------------------------------------------
if ($env:EXPO_PUBLIC_APP_ENV -ne 'production') { throw "EXPO_PUBLIC_APP_ENV in .env must be 'production' (is '$env:EXPO_PUBLIC_APP_ENV')." }
if (-not $env:EXPO_PUBLIC_API_URL.StartsWith('https://')) { throw 'EXPO_PUBLIC_API_URL in .env must be https://.' }
Write-Host "SplitMoney release  |  API $env:EXPO_PUBLIC_API_URL  |  versionCode $VersionCode" -ForegroundColor Green

# ---- 3. Upload key ------------------------------------------------------------------------
function Read-Secret([string]$prompt) {
  $secure = Read-Host -Prompt $prompt -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}
if ($Unsigned) {
  foreach ($name in 'SPLITMONEY_UPLOAD_KEY_ALIAS', 'SPLITMONEY_UPLOAD_STORE_PASSWORD', 'SPLITMONEY_UPLOAD_KEY_PASSWORD') { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }
  Write-Warning 'Building UNSIGNED. The outputs cannot be installed or uploaded until signed.'
} else {
  if (-not $env:SPLITMONEY_UPLOAD_STORE_FILE) { $env:SPLITMONEY_UPLOAD_STORE_FILE = Join-Path $app 'splitmoney-release.jks' }
  if (-not (Test-Path $env:SPLITMONEY_UPLOAD_STORE_FILE)) { throw "Keystore not found: $env:SPLITMONEY_UPLOAD_STORE_FILE" }
  if (-not $env:SPLITMONEY_UPLOAD_KEY_ALIAS) { $env:SPLITMONEY_UPLOAD_KEY_ALIAS = Read-Host -Prompt 'Upload key alias' }
  if (-not $env:SPLITMONEY_UPLOAD_STORE_PASSWORD) { $env:SPLITMONEY_UPLOAD_STORE_PASSWORD = Read-Secret 'Keystore password' }
  if (-not $env:SPLITMONEY_UPLOAD_KEY_PASSWORD) {
    $keyPassword = Read-Secret 'Key password (Enter = same as keystore password)'
    $env:SPLITMONEY_UPLOAD_KEY_PASSWORD = if ($keyPassword) { $keyPassword } else { $env:SPLITMONEY_UPLOAD_STORE_PASSWORD }
  }
}

# ---- 4. Native project and Gradle ----------------------------------------------------------
if (-not $SkipPrebuild) {
  & npx expo prebuild --platform android --clean --no-install
  if ($LASTEXITCODE -ne 0) { throw 'expo prebuild failed.' }
}
Push-Location android
try {
  & .\gradlew.bat bundleRelease assembleRelease --no-daemon
  if ($LASTEXITCODE -ne 0) { throw 'Gradle release build failed.' }
} finally { Pop-Location }

# ---- 5. Named outputs ---------------------------------------------------------------------
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$name = "SplitMoney-$version-$VersionCode" + $(if ($Unsigned) { '-unsigned' } else { '' })
$out = New-Item -ItemType Directory -Force -Path 'artifacts\release'
$aab = Get-ChildItem 'android\app\build\outputs\bundle\release\*.aab' | Select-Object -First 1
$apk = Get-ChildItem 'android\app\build\outputs\apk\release\*.apk' | Select-Object -First 1
Copy-Item $aab.FullName (Join-Path $out "$name.aab") -Force
Copy-Item $apk.FullName (Join-Path $out "$name.apk") -Force
Get-ChildItem $out -Filter "$name.*" | ForEach-Object {
  '{0}  {1:N1} MB  SHA-256 {2}' -f $_.Name, ($_.Length / 1MB), (Get-FileHash $_.FullName).Hash
}

# Clear the key material from this process.
foreach ($name in 'SPLITMONEY_UPLOAD_STORE_PASSWORD', 'SPLITMONEY_UPLOAD_KEY_PASSWORD') { Remove-Item "Env:$name" -ErrorAction SilentlyContinue }

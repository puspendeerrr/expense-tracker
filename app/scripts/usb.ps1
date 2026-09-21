param([string]$Serial)
$ErrorActionPreference = 'Stop'
. "$PSScriptRoot/android-env.ps1"
$deviceLines = @(& adb devices | Select-Object -Skip 1 | Where-Object { $_ -match '\S' })
if (-not $Serial) {
  $authorized = @($deviceLines | Where-Object { $_ -match '^\S+\s+device$' })
  if ($authorized.Count -ne 1) { throw 'Connect and authorize exactly one phone, or pass -Serial. Run adb devices.' }
  $Serial = ($authorized[0] -split '\s+')[0]
}
& adb -s $Serial get-state
if ($LASTEXITCODE -ne 0) { throw 'Phone is not authorized/connected.' }
foreach ($port in @(8081, 5000)) {
  & adb -s $Serial reverse "tcp:$port" "tcp:$port"
  if ($LASTEXITCODE -ne 0) { throw "USB reverse failed for port $port" }
}
& adb -s $Serial reverse --list
Write-Host 'USB is ready. Run npm start, then open SplitWise on the phone.'

# Dot-source after installation if this terminal predates the environment changes.
$env:JAVA_HOME = [Environment]::GetEnvironmentVariable('JAVA_HOME', 'User')
$env:ANDROID_HOME = [Environment]::GetEnvironmentVariable('ANDROID_HOME', 'User')
if (-not $env:JAVA_HOME -or -not $env:ANDROID_HOME) { throw 'Install JDK/Android SDK and set JAVA_HOME/ANDROID_HOME first. See README.md.' }
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

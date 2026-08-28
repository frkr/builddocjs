@echo off
setlocal EnableExtensions
REM MANUAL/EMERGENCY ONLY. Never call from the application, npm, or automation.
REM Usage: kill_chrome.bat ROOT_PID [--force]

if defined npm_lifecycle_event (
  echo Refusing to run from an npm lifecycle/script. 1>&2
  exit /b 64
)

set "TARGET_PID=%~1"
set "FORCE=%~2"

if not defined TARGET_PID goto :usage
for /f "delims=0123456789" %%A in ("%TARGET_PID%") do goto :usage
if "%TARGET_PID%"=="0" goto :unsafe
if "%TARGET_PID%"=="1" goto :unsafe
if defined FORCE if /I not "%FORCE%"=="--force" goto :usage

REM Require an explicit Chromium executable and reject Chrome/Edge or an unknown path.
powershell -NoProfile -Command "$p=Get-CimInstance Win32_Process -Filter 'ProcessId=%TARGET_PID%' -ErrorAction SilentlyContinue; if(-not $p){exit 2}; if(-not $p.ExecutablePath){exit 3}; if([IO.Path]::GetFileName($p.ExecutablePath) -ine 'chromium.exe'){exit 4}; Write-Host ('WARNING: manual emergency cleanup only.'); Write-Host ('Root PID: '+$p.ProcessId); Write-Host ('Executable: '+$p.ExecutablePath); Write-Host ('Command: '+$p.CommandLine)"
if errorlevel 4 (
  echo Refusing target that is not chromium.exe. 1>&2
  exit /b 1
)
if errorlevel 3 (
  echo Cannot verify the executable path; refusing to signal the PID. 1>&2
  exit /b 1
)
if errorlevel 2 (
  echo PID %TARGET_PID% does not exist or cannot be inspected. 1>&2
  exit /b 1
)

echo This will signal only PID %TARGET_PID% and its process tree.
set /p "CONFIRM=Type KILL CHROMIUM PID %TARGET_PID% to continue: "
if not "%CONFIRM%"=="KILL CHROMIUM PID %TARGET_PID%" (
  echo Cancelled; no process was terminated.
  exit /b 1
)

REM taskkill without /F requests normal termination for the reviewed tree.
taskkill /PID %TARGET_PID% /T
if not errorlevel 1 exit /b 0

if /I not "%FORCE%"=="--force" (
  echo Normal termination did not complete. Review and rerun with --force if justified. 1>&2
  exit /b 1
)

set /p "FORCE_CONFIRM=Type FORCE KILL PID %TARGET_PID% to force this tree: "
if not "%FORCE_CONFIRM%"=="FORCE KILL PID %TARGET_PID%" (
  echo Force step cancelled.
  exit /b 1
)

taskkill /F /PID %TARGET_PID% /T
exit /b %ERRORLEVEL%

:unsafe
echo Refusing unsafe PID: %TARGET_PID% 1>&2
exit /b 64

:usage
echo Usage: %~nx0 ROOT_PID [--force] 1>&2
exit /b 64

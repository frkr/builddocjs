@echo off
REM Script para encerrar processos do Chrome/Chromium no Windows
REM Uso: kill_chrome.bat

echo Encerrando processos do Chrome/Chromium...

REM Matar processos do Google Chrome (incluindo auxiliares)
taskkill /F /IM "chrome.exe" /T 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   - Encerrando Google Chrome...
)

REM Matar processos do Chromium (incluindo auxiliares)
taskkill /F /IM "chromium.exe" /T 2>nul
if %ERRORLEVEL% EQU 0 (
    echo   - Encerrando Chromium...
)

REM Verificar se ainda há processos
tasklist /FI "IMAGENAME eq chrome.exe" 2>nul | findstr /I "chrome.exe" >nul
if %ERRORLEVEL% EQU 0 (
    echo   [!] Ainda ha processos Chrome em execucao. Tentando forcar encerramento...
    taskkill /F /IM "chrome.exe" /T 2>nul
) else (
    tasklist /FI "IMAGENAME eq chromium.exe" 2>nul | findstr /I "chromium.exe" >nul
    if %ERRORLEVEL% EQU 0 (
        echo   [!] Ainda ha processos Chromium em execucao. Tentando forcar encerramento...
        taskkill /F /IM "chromium.exe" /T 2>nul
    ) else (
        echo   [v] Todos os processos Chrome/Chromium foram encerrados.
    )
)

echo Concluido!

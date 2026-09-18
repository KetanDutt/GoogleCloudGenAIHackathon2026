@echo off
REM Use the checked-in, non-destructive PowerShell launcher.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_local.ps1"
exit /b %ERRORLEVEL%

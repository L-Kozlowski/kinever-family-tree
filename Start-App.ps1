# Run the built local application. Build frontend with pnpm build first.
param([switch]$Check)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$appPython = Join-Path $PSScriptRoot '.venv/Scripts/python.exe'
if (!(Test-Path -LiteralPath $appPython)) { throw 'Create the environment: python -m venv .venv, then ./.venv/Scripts/python.exe -m pip install -r backend/requirements.txt' }
if (!(Test-Path -LiteralPath 'dist/index.html')) { throw 'Build the frontend with pnpm build.' }
if ($Check) { & $appPython -c 'import fastapi, uvicorn, sqlite3; print("Environment ready")'; exit $LASTEXITCODE }
Write-Host 'KinEver: http://127.0.0.1:8000/ — press Ctrl+C to stop'
& $appPython -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
exit $LASTEXITCODE

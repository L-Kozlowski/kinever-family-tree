param([string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$version = (Get-Content -Raw -LiteralPath package.json | ConvertFrom-Json).version
if (!$OutputDirectory) { $OutputDirectory = "output/release/KinEver-$version" }
pnpm build
if ($LASTEXITCODE) { exit $LASTEXITCODE }
New-Item -ItemType Directory -Force output/tmp | Out-Null
$icon = Join-Path $PSScriptRoot "output/tmp/KinEver.ico"
& ./Build-AppIcon.ps1 -Destination $icon
& .venv/Scripts/python.exe -m PyInstaller --icon $icon --noconfirm --windowed --name KinEver --distpath $OutputDirectory --workpath output/tmp/desktop-build --specpath output/tmp --paths "$PSScriptRoot" --add-data "$PSScriptRoot/dist:dist" --collect-all webview --hidden-import uvicorn.logging --hidden-import uvicorn.loops.auto --hidden-import uvicorn.protocols.http.auto --hidden-import uvicorn.lifespan.on desktop.py
if ($LASTEXITCODE) { exit $LASTEXITCODE }
# Some Python distributions ship a trust-policy file beside ssl.py.
$trustPolicy = & .venv/Scripts/python.exe -c "import ssl,pathlib; print(pathlib.Path(ssl.__file__).with_name('codex-rejected-cas.pem'))"
if (Test-Path -LiteralPath $trustPolicy) {
    Copy-Item -LiteralPath $trustPolicy -Destination (Join-Path $OutputDirectory "KinEver/_internal")
}


& .venv/Scripts/python.exe ./package_release.py $OutputDirectory $version
exit $LASTEXITCODE

param(
  [Parameter(Mandatory = $true)]
  [string]$PreviousSetupUrl,
  [Parameter(Mandatory = $true)]
  [string]$CurrentSetupPath,
  [Parameter(Mandatory = $true)]
  [string]$ExpectedVersion,
  [int]$TimeoutSeconds = 45
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$resolvedCurrentSetup = (Resolve-Path $CurrentSetupPath -ErrorAction Stop).Path
$previousSetupPath = Join-Path $env:RUNNER_TEMP ("nisti-previous-setup-{0}.exe" -f $PID)
$installDir = Join-Path $env:RUNNER_TEMP ("nisti-upgrade-smoke-{0}" -f $PID)
$userDataDir = Join-Path $env:APPDATA "Nisti Print PKM Marketing Hub"
$sentinelPath = Join-Path $userDataDir ("upgrade-smoke-sentinel-{0}.json" -f $PID)
$sentinelValue = [guid]::NewGuid().ToString("N")
$accessViolationExitCode = -1073741819 # 0xC0000005 on GitHub-hosted Windows runners

function Stop-ProcessesFromInstallDir {
  param([string]$Directory)

  Get-Process -ErrorAction SilentlyContinue | ForEach-Object {
    try {
      if ($_.Path -and $_.Path.StartsWith($Directory, [System.StringComparison]::OrdinalIgnoreCase)) {
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
      }
    } catch {
      # Alguns processos do sistema não expõem Path ao runner; podem ser ignorados.
    }
  }
}

function Invoke-NsisSetup {
  param(
    [string]$SetupPath,
    [string]$Directory,
    [string]$Label
  )

  $maxAttempts = 3
  for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
    Write-Host "$Label tentativa $attempt/$maxAttempts em $Directory"
    $process = Start-Process -FilePath $SetupPath -ArgumentList @("/S", "/D=$Directory") -Wait -PassThru
    if ($process.ExitCode -eq 0) {
      Stop-ProcessesFromInstallDir -Directory $Directory
      return
    }

    if ($process.ExitCode -ne $accessViolationExitCode) {
      throw "$Label falhou com exit code não transitório $($process.ExitCode)."
    }

    Write-Warning "$Label retornou access violation 0xC0000005 na tentativa $attempt/$maxAttempts."
    if ($attempt -lt $maxAttempts) { Start-Sleep -Seconds 3 }
  }

  throw "$Label sofreu access violation 0xC0000005 nas $maxAttempts tentativas."
}

try {
  Remove-Item $previousSetupPath -Force -ErrorAction SilentlyContinue
  Remove-Item $installDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $sentinelPath -Force -ErrorAction SilentlyContinue

  Write-Host "Baixando instalador estável anterior: $PreviousSetupUrl"
  Invoke-WebRequest -Uri $PreviousSetupUrl -OutFile $previousSetupPath -UseBasicParsing
  if (-not (Test-Path $previousSetupPath)) {
    throw "O instalador da release anterior não foi baixado."
  }

  Invoke-NsisSetup -SetupPath $previousSetupPath -Directory $installDir -Label "Instalação da release anterior"

  $appExe = Join-Path $installDir "Nisti Marketing.exe"
  $installedPackage = Join-Path $installDir "resources\app\package.json"
  if (-not (Test-Path $appExe)) {
    throw "A release anterior não instalou 'Nisti Marketing.exe'."
  }
  if (-not (Test-Path $installedPackage)) {
    throw "A release anterior não contém resources/app/package.json para validação."
  }

  $previousVersion = (Get-Content $installedPackage -Raw | ConvertFrom-Json).version
  Write-Host "Release anterior instalada: $previousVersion"

  New-Item -ItemType Directory -Path $userDataDir -Force | Out-Null
  @{ value = $sentinelValue; createdAt = (Get-Date).ToUniversalTime().ToString("o") } |
    ConvertTo-Json |
    Set-Content -Path $sentinelPath -Encoding utf8

  Invoke-NsisSetup -SetupPath $resolvedCurrentSetup -Directory $installDir -Label "Upgrade para $ExpectedVersion"

  if (-not (Test-Path $appExe)) {
    throw "O executável desapareceu depois do upgrade."
  }
  if (-not (Test-Path $installedPackage)) {
    throw "O package.json instalado desapareceu depois do upgrade."
  }

  $installedVersion = (Get-Content $installedPackage -Raw | ConvertFrom-Json).version
  if ($installedVersion -ne $ExpectedVersion) {
    throw "Versão instalada incorreta após upgrade. Esperado '$ExpectedVersion', encontrado '$installedVersion'."
  }

  if (-not (Test-Path $sentinelPath)) {
    throw "O userData foi removido durante o upgrade."
  }
  $sentinel = Get-Content $sentinelPath -Raw | ConvertFrom-Json
  if ($sentinel.value -ne $sentinelValue) {
    throw "O conteúdo persistido no userData foi alterado durante o upgrade."
  }

  $runtimeSmoke = Join-Path $PSScriptRoot "windows-electron-smoke.ps1"
  & pwsh -NoProfile -ExecutionPolicy Bypass -File $runtimeSmoke -ExecutablePath $appExe -TimeoutSeconds $TimeoutSeconds
  if ($LASTEXITCODE -ne 0) {
    throw "O Electron falhou no smoke depois do upgrade."
  }

  Write-Host "Upgrade compatibility OK: $previousVersion -> $installedVersion; userData preservado."
}
finally {
  Stop-ProcessesFromInstallDir -Directory $installDir
  Remove-Item $previousSetupPath -Force -ErrorAction SilentlyContinue
  Remove-Item $installDir -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item $sentinelPath -Force -ErrorAction SilentlyContinue
}

param(
  [Parameter(Mandatory = $true)]
  [string]$ExecutablePath,
  [int]$TimeoutSeconds = 45
)

$resolvedExecutable = (Resolve-Path $ExecutablePath -ErrorAction Stop).Path
$healthPath = Join-Path $env:RUNNER_TEMP ("nisti-electron-health-{0}-{1}.json" -f $PID, (Get-Random))
$previousHealthPath = $env:NISTI_RUNTIME_HEALTH_FILE
$process = $null

try {
  Remove-Item $healthPath -Force -ErrorAction SilentlyContinue
  $env:NISTI_RUNTIME_HEALTH_FILE = $healthPath
  $process = Start-Process -FilePath $resolvedExecutable -PassThru
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    $process.Refresh()
    if ($process.HasExited) {
      throw "Electron encerrou antes de confirmar o runtime. Exit code: $($process.ExitCode)."
    }

    if (Test-Path $healthPath) {
      $health = Get-Content $healthPath -Raw | ConvertFrom-Json
      if ($health.title -ne "Nisti Marketing") {
        throw "Título inesperado no renderer: '$($health.title)'."
      }
      if ($health.rendererReady -ne $true) {
        throw "O renderer abriu, mas a árvore React não foi montada."
      }
      if ($health.preloadReady -ne $true) {
        throw "O preload Electron não ficou disponível no renderer."
      }
      if ($health.backendReady -ne $true) {
        throw "O aplicativo caiu no fallback file://; o backend local integrado não foi carregado."
      }

      Write-Host ("Electron runtime OK | {0} | {1}" -f $health.title, $health.location)
      exit 0
    }

    Start-Sleep -Milliseconds 500
  }

  throw "O Electron não gravou o probe de runtime em $TimeoutSeconds segundos."
}
finally {
  if ($null -ne $process) {
    $process.Refresh()
    if (-not $process.HasExited) {
      [void]$process.CloseMainWindow()
      if (-not $process.WaitForExit(5000)) {
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      }
    }
  }

  if ($null -eq $previousHealthPath) {
    Remove-Item Env:NISTI_RUNTIME_HEALTH_FILE -ErrorAction SilentlyContinue
  } else {
    $env:NISTI_RUNTIME_HEALTH_FILE = $previousHealthPath
  }
  Remove-Item $healthPath -Force -ErrorAction SilentlyContinue
}

param(
  [Parameter(Mandatory = $true)]
  [string]$ExecutablePath,
  [Parameter(Mandatory = $true)]
  [string]$OutputDirectory,
  [int]$TimeoutSeconds = 45
)

$resolvedExecutable = (Resolve-Path $ExecutablePath -ErrorAction Stop).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
[System.IO.Directory]::CreateDirectory($resolvedOutput) | Out-Null
$healthPath = Join-Path $env:RUNNER_TEMP ("nisti-ui-gallery-health-{0}-{1}.json" -f $PID, (Get-Random))
$previousHealthPath = $env:NISTI_RUNTIME_HEALTH_FILE
$process = $null

# Pré-configura um Vault temporário vazio apenas para homologação visual.
# Isso evita o seletor nativo de pasta sem simular REST API ou dados do usuário.
$previewVault = Join-Path $env:RUNNER_TEMP ("nisti-ui-gallery-vault-{0}-{1}" -f $PID, (Get-Random))
[System.IO.Directory]::CreateDirectory($previewVault) | Out-Null
$stableUserData = Join-Path $env:APPDATA "Nisti Print PKM Marketing Hub"
[System.IO.Directory]::CreateDirectory($stableUserData) | Out-Null
$configPath = Join-Path $stableUserData "nisti_config.json"
@{ vaultPath = $previewVault } | ConvertTo-Json | Set-Content -Path $configPath -Encoding UTF8

Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms

if (-not ([System.Management.Automation.PSTypeName]'NistiUiGalleryNative').Type) {
  Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class NistiUiGalleryNative {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }

    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);
    [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

    public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    public const uint MOUSEEVENTF_LEFTUP = 0x0004;

    public static IntPtr FindLargestWindowForProcess(int processId) {
        IntPtr bestHandle = IntPtr.Zero;
        long bestArea = 0;
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            uint windowProcessId;
            GetWindowThreadProcessId(hWnd, out windowProcessId);
            if (windowProcessId != (uint)processId || !IsWindowVisible(hWnd)) return true;
            RECT rect;
            if (!GetWindowRect(hWnd, out rect)) return true;
            long width = Math.Max(0, rect.Right - rect.Left);
            long height = Math.Max(0, rect.Bottom - rect.Top);
            long area = width * height;
            if (area > bestArea) { bestArea = area; bestHandle = hWnd; }
            return true;
        }, IntPtr.Zero);
        return bestHandle;
    }
}
"@
}

function Get-MainWindowHandle {
  param([System.Diagnostics.Process]$TargetProcess)
  $TargetProcess.Refresh()
  $handle = [NistiUiGalleryNative]::FindLargestWindowForProcess($TargetProcess.Id)
  if ($handle -eq [IntPtr]::Zero) {
    throw "Não foi possível localizar a janela principal do Nisti Marketing."
  }
  return $handle
}

function Close-ModalIfPresent {
  param([IntPtr]$Handle)
  # Primeiro envia ESC para qualquer diálogo ativo; depois devolve foco à janela principal.
  try { [System.Windows.Forms.SendKeys]::SendWait("{ESC}") } catch {}
  Start-Sleep -Milliseconds 200
  [void][NistiUiGalleryNative]::SetForegroundWindow($Handle)
  Start-Sleep -Milliseconds 300
}

function Click-ClientPoint {
  param([IntPtr]$Handle, [int]$X, [int]$Y)
  $point = New-Object NistiUiGalleryNative+POINT
  $point.X = $X
  $point.Y = $Y
  if (-not [NistiUiGalleryNative]::ClientToScreen($Handle, [ref]$point)) {
    throw "ClientToScreen falhou para o clique de navegação."
  }
  [void][NistiUiGalleryNative]::SetForegroundWindow($Handle)
  [void][NistiUiGalleryNative]::SetCursorPos($point.X, $point.Y)
  Start-Sleep -Milliseconds 120
  [NistiUiGalleryNative]::mouse_event([NistiUiGalleryNative]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
  [NistiUiGalleryNative]::mouse_event([NistiUiGalleryNative]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
}

function Save-WindowScreenshot {
  param([IntPtr]$Handle, [string]$OutputPath)
  $rect = New-Object NistiUiGalleryNative+RECT
  if (-not [NistiUiGalleryNative]::GetWindowRect($Handle, [ref]$rect)) {
    throw "GetWindowRect falhou durante a captura visual."
  }
  $width = [Math]::Max(1, $rect.Right - $rect.Left)
  $height = [Math]::Max(1, $rect.Bottom - $rect.Top)
  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $hdc = $graphics.GetHdc()
  try {
    if (-not [NistiUiGalleryNative]::PrintWindow($Handle, $hdc, 2)) {
      throw "PrintWindow falhou durante a captura visual."
    }
  }
  finally {
    $graphics.ReleaseHdc($hdc)
    $graphics.Dispose()
  }
  try {
    $bitmap.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host "Captura salva: $OutputPath"
  }
  finally {
    $bitmap.Dispose()
  }
}

try {
  Remove-Item $healthPath -Force -ErrorAction SilentlyContinue
  $env:NISTI_RUNTIME_HEALTH_FILE = $healthPath
  $process = Start-Process -FilePath $resolvedExecutable -PassThru
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    $process.Refresh()
    if ($process.HasExited) { throw "Electron encerrou antes da galeria. Exit code: $($process.ExitCode)." }
    if (Test-Path $healthPath) {
      $health = Get-Content $healthPath -Raw | ConvertFrom-Json
      if ($health.title -eq "Nisti Marketing" -and $health.rendererReady -eq $true -and $health.preloadReady -eq $true -and $health.backendReady -eq $true) {
        break
      }
    }
    Start-Sleep -Milliseconds 500
  }

  if (-not (Test-Path $healthPath)) { throw "O Electron não confirmou o runtime dentro do tempo esperado." }
  $handle = Get-MainWindowHandle -TargetProcess $process
  Close-ModalIfPresent -Handle $handle

  $clientRect = New-Object NistiUiGalleryNative+RECT
  if (-not [NistiUiGalleryNative]::GetClientRect($handle, [ref]$clientRect)) {
    throw "GetClientRect falhou."
  }
  $clientHeight = [Math]::Max(1, $clientRect.Bottom - $clientRect.Top)
  $sidebarX = 40

  $screens = @(
    @{ Name = "01-inicio.png"; Y = 132 },
    @{ Name = "02-base.png"; Y = 192 },
    @{ Name = "03-criar.png"; Y = 252 },
    @{ Name = "04-planejar.png"; Y = 312 },
    @{ Name = "05-executar.png"; Y = 372 },
    @{ Name = "06-aprender.png"; Y = 432 },
    @{ Name = "07-configuracoes.png"; Y = ($clientHeight - 96) }
  )

  foreach ($screen in $screens) {
    Close-ModalIfPresent -Handle $handle
    Click-ClientPoint -Handle $handle -X $sidebarX -Y ([int]$screen.Y)
    Start-Sleep -Milliseconds 1100
    $handle = Get-MainWindowHandle -TargetProcess $process
    Save-WindowScreenshot -Handle $handle -OutputPath (Join-Path $resolvedOutput $screen.Name)
  }

  Write-Host "Galeria visual concluída em $resolvedOutput"
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
  Remove-Item $previewVault -Recurse -Force -ErrorAction SilentlyContinue
}

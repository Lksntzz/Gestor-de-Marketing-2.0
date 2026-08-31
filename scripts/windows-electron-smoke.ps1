param(
  [Parameter(Mandatory = $true)]
  [string]$ExecutablePath,
  [int]$TimeoutSeconds = 45,
  [string]$ScreenshotPath = ""
)

$resolvedExecutable = (Resolve-Path $ExecutablePath -ErrorAction Stop).Path
$healthPath = Join-Path $env:RUNNER_TEMP ("nisti-electron-health-{0}-{1}.json" -f $PID, (Get-Random))
$previousHealthPath = $env:NISTI_RUNTIME_HEALTH_FILE
$process = $null

function Save-WindowScreenshot {
  param(
    [Parameter(Mandatory = $true)]
    [System.Diagnostics.Process]$TargetProcess,
    [Parameter(Mandatory = $true)]
    [string]$OutputPath
  )

  Add-Type -AssemblyName System.Drawing
  if (-not ([System.Management.Automation.PSTypeName]'NistiWindowCapture').Type) {
    Add-Type @"
using System;
using System.Runtime.InteropServices;

public static class NistiWindowCapture {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [DllImport("user32.dll")]
    public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint nFlags);

    public static IntPtr FindLargestWindowForProcess(int processId) {
        IntPtr bestHandle = IntPtr.Zero;
        long bestArea = 0;

        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            uint windowProcessId;
            GetWindowThreadProcessId(hWnd, out windowProcessId);
            if (windowProcessId != (uint)processId || !IsWindowVisible(hWnd)) {
                return true;
            }

            RECT rect;
            if (!GetWindowRect(hWnd, out rect)) {
                return true;
            }

            long width = Math.Max(0, rect.Right - rect.Left);
            long height = Math.Max(0, rect.Bottom - rect.Top);
            long area = width * height;
            if (area > bestArea) {
                bestArea = area;
                bestHandle = hWnd;
            }
            return true;
        }, IntPtr.Zero);

        return bestHandle;
    }
}
"@
  }

  $TargetProcess.Refresh()
  $handle = [NistiWindowCapture]::FindLargestWindowForProcess($TargetProcess.Id)
  if ($handle -eq [IntPtr]::Zero) {
    throw "Não foi possível localizar uma janela visível do processo Nisti Marketing para a captura visual."
  }

  $rect = New-Object NistiWindowCapture+RECT
  if (-not [NistiWindowCapture]::GetWindowRect($handle, [ref]$rect)) {
    throw "GetWindowRect falhou durante a captura visual."
  }

  $width = [Math]::Max(1, $rect.Right - $rect.Left)
  $height = [Math]::Max(1, $rect.Bottom - $rect.Top)
  $bitmap = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $hdc = $graphics.GetHdc()

  try {
    if (-not [NistiWindowCapture]::PrintWindow($handle, $hdc, 2)) {
      throw "PrintWindow falhou durante a captura visual."
    }
  }
  finally {
    $graphics.ReleaseHdc($hdc)
    $graphics.Dispose()
  }

  try {
    $resolvedOutput = [System.IO.Path]::GetFullPath($OutputPath)
    $directory = [System.IO.Path]::GetDirectoryName($resolvedOutput)
    if ($directory) {
      [System.IO.Directory]::CreateDirectory($directory) | Out-Null
    }
    $bitmap.Save($resolvedOutput, [System.Drawing.Imaging.ImageFormat]::Png)
    Write-Host ("Preview visual salvo em {0} ({1}x{2})" -f $resolvedOutput, $width, $height)
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

      if ($ScreenshotPath.Trim()) {
        Start-Sleep -Milliseconds 1200
        Save-WindowScreenshot -TargetProcess $process -OutputPath $ScreenshotPath
      }

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

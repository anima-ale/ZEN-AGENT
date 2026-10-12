$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$src = "C:\Users\giova\Pictures\logo zen-agent.png"
$img = [System.Drawing.Image]::FromFile($src)
Write-Output ("SIZE:{0}x{1}" -f $img.Width, $img.Height)
Write-Output ("BYTES:{0}" -f (Get-Item $src).Length)
$img.Dispose()

$root = "C:\Users\giova\.local\share\opencode\worktree\2830fa\clever-eagle"
$iconDir = Join-Path $root "src-tauri\icons"
$nsisDir = Join-Path $root "src-tauri\nsis-assets"
if (-not (Test-Path $nsisDir)) { New-Item -ItemType Directory -Force $nsisDir | Out-Null }

function New-DarkBmp($w, $h, $out) {
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.Clear([System.Drawing.Color]::FromArgb(10, 10, 9))
  $logo = [System.Drawing.Image]::FromFile($src)
  # contain: scala il logo dentro il riquadro con margine, centrato
  $margin = [Math]::Max(6, [int]($h * 0.08))
  $maxW = $w - $margin * 2
  $maxH = $h - $margin * 2
  $s = [Math]::Min($maxW / $logo.Width, $maxH / $logo.Height)
  $dw = [int]($logo.Width * $s)
  $dh = [int]($logo.Height * $s)
  $dx = [int](($w - $dw) / 2)
  $dy = [int](($h - $dh) / 2)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($logo, $dx, $dy, $dw, $dh)
  # filetto oro in basso (accento funzionale NEO1)
  $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(232, 176, 75), 2)
  $g.DrawLine($pen, 0, $h - 2, $w, $h - 2)
  $pen.Dispose()
  $logo.Dispose()
  $g.Dispose()
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Bmp)
  $bmp.Dispose()
  Write-Output ("BMP:{0} ({1}x{2})" -f $out, $w, $h)
}

# Header NSIS 150x57, sidebar NSIS 164x314, sidebar scura compatta per il nostro installer
New-DarkBmp 150 57 (Join-Path $nsisDir "header.bmp")
New-DarkBmp 164 314 (Join-Path $nsisDir "sidebar.bmp")
New-DarkBmp 164 240 (Join-Path $nsisDir "sidebar-dark.bmp")
Write-Output "NSIS-ASSETS-OK"

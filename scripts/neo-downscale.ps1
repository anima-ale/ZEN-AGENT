$ErrorActionPreference = "Stop"
$src = "C:\Users\giova\.local\share\opencode\worktree\2830fa\clever-eagle\site-lab\_big.png"
$dst = [IO.Path]::Combine([IO.Path]::GetTempPath(), "zen-img-test.jpg")
Add-Type -AssemblyName System.Drawing
$i = [System.Drawing.Image]::FromFile($src)
$w = $i.Width; $h = $i.Height
$s = [Math]::Min(1920 / $w, 1920 / $h)
if ($s -gt 1) { $s = 1 }
$w = [int]($w * $s); $h = [int]($h * $s)
$b = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($b)
$g.InterpolationMode = 2
$g.DrawImage($i, 0, 0, $w, $h)
$e = New-Object System.Drawing.Imaging.EncoderParameters(1)
$e.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 80)
$c = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
$b.Save($dst, $c[0], $e)
$g.Dispose(); $b.Dispose(); $i.Dispose()
Write-Output ("OUT: {0} MB {1}x{2}" -f [math]::Round((Get-Item $dst).Length / 1MB, 2), $w, $h)

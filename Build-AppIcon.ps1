param(
    [Parameter(Mandatory)][string]$Destination,
    [string]$FaviconDestination
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$source = [Drawing.Image]::FromFile((Join-Path $PSScriptRoot 'assets/branding/logo.png'))
try {
    $frames = foreach ($size in 16, 32, 48, 64, 128, 256) {
        $bitmap = [Drawing.Bitmap]::new($size, $size)
        $graphics = [Drawing.Graphics]::FromImage($bitmap)
        $stream = [IO.MemoryStream]::new()
        try {
            $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $scale = $size / [Math]::Max($source.Width, $source.Height)
            $width = [int][Math]::Round($source.Width * $scale)
            $height = [int][Math]::Round($source.Height * $scale)
            $graphics.DrawImage($source, [Drawing.Rectangle]::new(
                [int](($size - $width) / 2), [int](($size - $height) / 2), $width, $height
            ))
            $bitmap.Save($stream, [Drawing.Imaging.ImageFormat]::Png)
            $bytes = $stream.ToArray()
            if ($size -eq 64 -and $FaviconDestination) {
                [IO.File]::WriteAllBytes($FaviconDestination, $bytes)
            }
            @{ Size = $size; Bytes = $bytes }
        } finally {
            $stream.Dispose()
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }
} finally {
    $source.Dispose()
}

$writer = [IO.BinaryWriter]::new([IO.File]::Create($Destination))
try {
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$frames.Count)
    $offset = 6 + 16 * $frames.Count
    foreach ($frame in $frames) {
        $dimension = [byte]($frame.Size % 256)
        $writer.Write([byte[]]($dimension, $dimension, 0, 0))
        $writer.Write([uint16]1)
        $writer.Write([uint16]32)
        $writer.Write([uint32]$frame.Bytes.Length)
        $writer.Write([uint32]$offset)
        $offset += $frame.Bytes.Length
    }
    foreach ($frame in $frames) { $writer.Write([byte[]]$frame.Bytes) }
} finally {
    $writer.Dispose()
}

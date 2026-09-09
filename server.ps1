# ============================================================
#  CPAC work book — เว็บเซิร์ฟเวอร์ในเครื่อง (ไม่ต้องใช้ Python)
#  ใช้ PowerShell ที่มากับ Windows ทุกเครื่อง
# ============================================================
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8765

try {
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
  $listener.Start()
} catch {
  Write-Host ""
  Write-Host "  [!] เปิดพอร์ต $port ไม่ได้ (อาจมีโปรแกรมอื่นใช้อยู่ หรือเปิดซ้ำ)"
  Write-Host "      ลองปิดหน้าต่างเก่าทั้งหมดแล้วเปิดใหม่อีกครั้ง"
  Read-Host "  กด Enter เพื่อปิด"
  exit
}

Write-Host ""
Write-Host "  ============================================"
Write-Host "   CPAC work book - ระบบกำลังทำงาน"
Write-Host "   http://localhost:$port/index.html"
Write-Host "   *** อย่าปิดหน้าต่างนี้ขณะใช้งาน ***"
Write-Host "   ใช้เสร็จแล้วปิดหน้าต่างนี้เพื่อหยุดระบบ"
Write-Host "  ============================================"
Write-Host ""

# เปิดเบราว์เซอร์หลังเซิร์ฟเวอร์พร้อมแล้ว
Start-Process "http://localhost:$port/index.html"

$mime = @{
  '.html'='text/html; charset=utf-8'; '.htm'='text/html; charset=utf-8';
  '.js'='application/javascript; charset=utf-8'; '.jsx'='application/javascript; charset=utf-8';
  '.css'='text/css; charset=utf-8'; '.json'='application/json; charset=utf-8';
  '.png'='image/png'; '.jpg'='image/jpeg'; '.jpeg'='image/jpeg'; '.gif'='image/gif';
  '.svg'='image/svg+xml'; '.ico'='image/x-icon'; '.webp'='image/webp';
  '.woff'='font/woff'; '.woff2'='font/woff2'; '.ttf'='font/ttf';
  '.txt'='text/plain; charset=utf-8'; '.gs'='text/plain; charset=utf-8'
}

while ($true) {
  $client = $listener.AcceptTcpClient()
  try {
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $requestLine = $reader.ReadLine()
    if ($requestLine) {
      $rawUrl = ($requestLine -split ' ')[1]
      $qi = $rawUrl.IndexOf('?'); if ($qi -ge 0) { $rawUrl = $rawUrl.Substring(0, $qi) }
      $rel = [System.Uri]::UnescapeDataString($rawUrl.TrimStart('/'))
      if ([string]::IsNullOrEmpty($rel)) { $rel = 'index.html' }
      $rel = $rel.Replace('/', '\')
      $path = Join-Path $root $rel
      if (Test-Path $path -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $ext = [System.IO.Path]::GetExtension($path).ToLower()
        $ct = 'application/octet-stream'
        if ($mime.ContainsKey($ext)) { $ct = $mime[$ext] }
        $header = "HTTP/1.0 200 OK`r`nContent-Type: $ct`r`nContent-Length: $($bytes.Length)`r`nAccess-Control-Allow-Origin: *`r`nConnection: close`r`n`r`n"
        $hb = [System.Text.Encoding]::ASCII.GetBytes($header)
        $stream.Write($hb, 0, $hb.Length)
        $stream.Write($bytes, 0, $bytes.Length)
      } else {
        $body = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
        $header = "HTTP/1.0 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
        $hb = [System.Text.Encoding]::ASCII.GetBytes($header)
        $stream.Write($hb, 0, $hb.Length)
        $stream.Write($body, 0, $body.Length)
      }
      $stream.Flush()
    }
  } catch {
  } finally {
    $client.Close()
  }
}

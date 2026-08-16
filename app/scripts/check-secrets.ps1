$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$patterns = @(
  "AIza[0-9A-Za-z_\-]{20,}",
  "K[0-9]{12,}",
  "OCR_SPACE_API_KEY\s*=\s*\S+",
  "GEMINI_API_KEY\s*=\s*\S+",
  "PEXELS_API_KEY\s*=\s*\S+"
)

$ignoredPathParts = @(
  "\node_modules\",
  "\dist\",
  "\src-tauri\target\",
  "\data\",
  "\.git\"
)

$allowedPlaceholderPatterns = @(
  'OCR_SPACE_API_KEY=""',
  'GEMINI_API_KEY=""',
  'PEXELS_API_KEY=""',
  'OCR_SPACE_API_KEY=',
  'GEMINI_API_KEY=',
  'PEXELS_API_KEY=',
  '$env:OCR_SPACE_API_KEY="sua-chave"',
  '$env:GEMINI_API_KEY="sua-chave"',
  '$env:PEXELS_API_KEY="sua-chave"'
)

$findings = New-Object System.Collections.Generic.List[string]

Get-ChildItem -LiteralPath $root -Recurse -File -Force |
  Where-Object {
    $path = $_.FullName
    -not ($ignoredPathParts | Where-Object { $path.Contains($_) })
  } |
  ForEach-Object {
    $file = $_.FullName
    $lines = Get-Content -LiteralPath $file -ErrorAction SilentlyContinue
    for ($index = 0; $index -lt $lines.Count; $index++) {
      $line = $lines[$index]
      foreach ($pattern in $patterns) {
        if ($line -match $pattern) {
          $isAllowed = $false
          foreach ($allowed in $allowedPlaceholderPatterns) {
            if ($line.Contains($allowed)) {
              $isAllowed = $true
              break
            }
          }

          if (-not $isAllowed) {
            $relative = Resolve-Path -LiteralPath $file -Relative
            $findings.Add("${relative}:$($index + 1): $line")
          }
        }
      }
    }
  }

if ($findings.Count -gt 0) {
  Write-Error "Possivel segredo encontrado:`n$($findings -join "`n")"
}

Write-Host "Nenhuma chave real aparente encontrada."

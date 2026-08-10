$ErrorActionPreference = "Stop"

$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
$vcvars = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"

if (-not (Test-Path $cargoBin)) {
  throw "Rust/Cargo nao encontrado em $cargoBin. Instale o Rust com rustup antes de rodar o Tauri."
}

if (-not (Test-Path $vcvars)) {
  throw "Visual Studio Build Tools nao encontrado. Instale o workload de C++ para compilar apps Tauri no Windows."
}

$listeners = Get-NetTCPConnection -LocalPort 1420 -State Listen -ErrorAction SilentlyContinue
foreach ($listener in $listeners) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
  if ($process -and $process.CommandLine -like "*Projeto Novo\app*") {
    Write-Host "Encerrando servidor antigo na porta 1420 (PID $($listener.OwningProcess))."
    Stop-Process -Id $listener.OwningProcess -Force
  } elseif ($process) {
    throw "A porta 1420 esta em uso pelo processo $($listener.OwningProcess): $($process.CommandLine)"
  }
}

$command = "call `"$vcvars`" && set PATH=$cargoBin;%PATH% && npx tauri dev"
cmd /c $command

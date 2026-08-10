$ErrorActionPreference = "Stop"

$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
$vcvars = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"

if (-not (Test-Path $cargoBin)) {
  throw "Rust/Cargo nao encontrado em $cargoBin. Instale o Rust com rustup antes de rodar o Tauri."
}

if (-not (Test-Path $vcvars)) {
  throw "Visual Studio Build Tools nao encontrado. Instale o workload de C++ para compilar apps Tauri no Windows."
}

$srcTauri = Join-Path $PSScriptRoot "..\src-tauri"
$command = "call `"$vcvars`" && set PATH=$cargoBin;%PATH% && cd /d `"$srcTauri`" && cargo check"
cmd /c $command

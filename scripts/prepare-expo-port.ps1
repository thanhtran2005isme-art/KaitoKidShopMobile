param(
    [ValidateRange(1, 65535)]
    [int]$Port = 8081
)

$ErrorActionPreference = 'Stop'

function Get-ListenerProcessIds {
    param([int]$TargetPort)

    return @(
        Get-NetTCPConnection -State Listen -LocalPort $TargetPort -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty OwningProcess -Unique
    )
}

$listenerProcessIds = @(Get-ListenerProcessIds -TargetPort $Port)
if ($listenerProcessIds.Count -eq 0) {
    Write-Host "[EXPO] Port $Port is free." -ForegroundColor Green
    exit 0
}

foreach ($ownerProcessId in $listenerProcessIds) {
    $cimProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $ownerProcessId" -ErrorAction SilentlyContinue
    $fallbackProcess = Get-Process -Id $ownerProcessId -ErrorAction SilentlyContinue

    if ($cimProcess) {
        $processName = [string]$cimProcess.Name
        $commandLine = [string]$cimProcess.CommandLine
    }
    elseif ($fallbackProcess) {
        $processName = [string]$fallbackProcess.ProcessName
        $commandLine = ''
    }
    else {
        $processName = 'unknown'
        $commandLine = ''
    }

    $isNode = $processName -match '^(?i:node)(\.exe)?$'
    $isExpoLike = $commandLine -match '(?i)(expo|metro|react-native)'

    if ($isNode -and $isExpoLike) {
        Write-Host "[EXPO] Stop stale Expo/Metro on port $Port (PID $ownerProcessId)." -ForegroundColor Yellow
        Stop-Process -Id $ownerProcessId -Force -ErrorAction Stop
        continue
    }

    $summary = if ([string]::IsNullOrWhiteSpace($commandLine)) {
        $processName
    }
    else {
        "$processName - $commandLine"
    }

    Write-Error "Port $Port is occupied by PID $ownerProcessId ($summary). Refusing to stop a non-Expo process automatically."
    exit 1
}

for ($attempt = 0; $attempt -lt 30; $attempt++) {
    if (@(Get-ListenerProcessIds -TargetPort $Port).Count -eq 0) {
        Write-Host "[EXPO] Port $Port is ready." -ForegroundColor Green
        exit 0
    }
    Start-Sleep -Milliseconds 100
}

Write-Error "Port $Port is still occupied after stopping the stale Expo/Metro process."
exit 1

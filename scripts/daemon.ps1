<#
.SYNOPSIS
    OmniRouter Windows Desktop Daemon Manager.
.DESCRIPTION
    Controls the background OmniRouter service: start, stop, status, restart, and Windows login auto-start.
.PARAMETER Action
    Command to run: start, stop, status, restart, autostart
.PARAMETER Option
    Additional parameter for autostart: enable, disable, status
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [ValidateSet("start", "stop", "status", "restart", "autostart")]
    [string]$Action = "status",

    [Parameter(Position = 1)]
    [string]$Option = ""
)

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$PidFile = Join-Path $RootDir ".omnirouter.pid"
$NotifyScript = Join-Path $ScriptDir "notify.ps1"
$ServerScript = Join-Path $RootDir "dist\server.js"
$RegPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
$RegName = "OmniRouterGateway"

function Get-RunningProcess {
    if (Test-Path $PidFile) {
        $savedPid = Get-Content $PidFile -ErrorAction SilentlyContinue
        if ($savedPid -match '^\d+$') {
            $proc = Get-Process -Id ([int]$savedPid) -ErrorAction SilentlyContinue
            if ($proc) {
                return $proc
            }
        }
        # Stale PID file
        Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
    }
    return $null
}

switch ($Action) {
    "start" {
        $existing = Get-RunningProcess
        if ($existing) {
            Write-Host "OmniRouter is already running (PID: $($existing.Id))" -ForegroundColor Yellow
            Write-Host "Dashboard: http://127.0.0.1:3000/" -ForegroundColor Cyan
            exit 0
        }

        # Check if build output exists, if not build it
        if (-not (Test-Path $ServerScript)) {
            Write-Host "Building OmniRouter..." -ForegroundColor Cyan
            Push-Location $RootDir
            try {
                & npm.cmd run build
            } finally {
                Pop-Location
            }
        }

        Write-Host "Starting OmniRouter gateway in the background..." -ForegroundColor Cyan
        $proc = Start-Process -FilePath "node" `
                              -ArgumentList "dist/server.js" `
                              -WorkingDirectory $RootDir `
                              -WindowStyle Hidden `
                              -PassThru

        if ($proc -and -not $proc.HasExited) {
            Set-Content -Path $PidFile -Value $proc.Id
            Start-Sleep -Milliseconds 1200

            if ($proc.HasExited) {
                Write-Host "ERROR: OmniRouter failed to stay running. Check logs or start directly with 'npm run start'." -ForegroundColor Red
                Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
                exit 1
            }

            Write-Host "OmniRouter started successfully (PID: $($proc.Id))" -ForegroundColor Green
            Write-Host "Dashboard: http://127.0.0.1:3000/" -ForegroundColor Green
            Write-Host "API:       http://127.0.0.1:3000/v1" -ForegroundColor Green

            if (Test-Path $NotifyScript) {
                & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $NotifyScript -Title "OmniRouter Gateway" -Message "Daemon active (PID: $($proc.Id)) at http://127.0.0.1:3000" -Type "Info"
            }
        } else {
            Write-Host "ERROR: Failed to launch background process." -ForegroundColor Red
            exit 1
        }
    }

    "stop" {
        $existing = Get-RunningProcess
        if ($existing) {
            Write-Host "Stopping OmniRouter (PID: $($existing.Id))..." -ForegroundColor Cyan
            Stop-Process -Id $existing.Id -Force -ErrorAction SilentlyContinue
            if (Test-Path $PidFile) {
                Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
            }
            Write-Host "OmniRouter stopped successfully." -ForegroundColor Green
            if (Test-Path $NotifyScript) {
                & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $NotifyScript -Title "OmniRouter Gateway" -Message "Gateway stopped" -Type "Warning"
            }
        } else {
            Write-Host "OmniRouter is not currently running." -ForegroundColor Yellow
            if (Test-Path $PidFile) {
                Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
            }
        }
    }

    "status" {
        $existing = Get-RunningProcess
        if ($existing) {
            Write-Host "==========================================" -ForegroundColor Cyan
            Write-Host "  OmniRouter Gateway: ONLINE" -ForegroundColor Green
            Write-Host "==========================================" -ForegroundColor Cyan
            Write-Host "PID:            $($existing.Id)"
            Write-Host "Memory:         $([math]::Round($existing.WorkingSet64 / 1MB, 2)) MB"
            Write-Host "Dashboard URL:  http://127.0.0.1:3000/"
            Write-Host "OpenAI Base:    http://127.0.0.1:3000/v1"
            
            # Query health check
            try {
                $health = Invoke-RestMethod -Uri "http://127.0.0.1:3000/health" -Method Get -TimeoutSec 3 -ErrorAction Stop
                Write-Host "Health:         $($health.status)" -ForegroundColor Green
                Write-Host "Providers:      $(($health.providers | Get-Member -MemberType NoteProperty).Name -join ', ')"
            } catch {
                Write-Host "Health:         Waiting for response ($($_.Exception.Message))" -ForegroundColor Yellow
            }
            Write-Host "==========================================" -ForegroundColor Cyan
        } else {
            Write-Host "==========================================" -ForegroundColor Yellow
            Write-Host "  OmniRouter Gateway: OFFLINE" -ForegroundColor Red
            Write-Host "==========================================" -ForegroundColor Yellow
            Write-Host "Run 'npm run gateway:start' to launch."
        }
    }

    "restart" {
        Write-Host "Restarting OmniRouter..." -ForegroundColor Cyan
        & $MyInvocation.MyCommand.Path stop
        Start-Sleep -Seconds 1
        & $MyInvocation.MyCommand.Path start
    }

    "autostart" {
        $cmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$ScriptDir\daemon.ps1`" start"
        
        switch ($Option.ToLower()) {
            "enable" {
                Set-ItemProperty -Path $RegPath -Name $RegName -Value $cmd
                Write-Host "Windows login auto-start ENABLED." -ForegroundColor Green
                Write-Host "OmniRouter will launch silently when you log into Windows."
            }
            "disable" {
                Remove-ItemProperty -Path $RegPath -Name $RegName -ErrorAction SilentlyContinue
                Write-Host "Windows login auto-start DISABLED." -ForegroundColor Yellow
            }
            default {
                $current = Get-ItemProperty -Path $RegPath -Name $RegName -ErrorAction SilentlyContinue
                if ($current) {
                    Write-Host "Windows login auto-start: ENABLED ($($current.$RegName))" -ForegroundColor Green
                } else {
                    Write-Host "Windows login auto-start: DISABLED" -ForegroundColor Yellow
                }
                Write-Host "Usage: .\scripts\daemon.ps1 autostart enable|disable"
            }
        }
    }
}

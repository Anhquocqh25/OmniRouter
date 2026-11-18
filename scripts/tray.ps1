<#
.SYNOPSIS
    OmniRouter Windows System Tray Applet.
.DESCRIPTION
    Runs a lightweight system tray icon in the Windows notification area,
    providing quick access to the dashboard, gateway controls, and health status.
#>

[CmdletBinding()]
param()

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DaemonScript = Join-Path $ScriptDir "daemon.ps1"

# Create Tray NotifyIcon
$trayIcon = New-Object System.Windows.Forms.NotifyIcon
$trayIcon.Text = "OmniRouter Gateway"
$trayIcon.Icon = [System.Drawing.SystemIcons]::Application
$trayIcon.Visible = $true

# Create Context Menu
$contextMenu = New-Object System.Windows.Forms.ContextMenuStrip

# Header Title
$headerItem = New-Object System.Windows.Forms.ToolStripMenuItem
$headerItem.Text = "OmniRouter Gateway"
$headerItem.Enabled = $false
$contextMenu.Items.Add($headerItem) | Out-Null
$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

# Open Dashboard
$dashItem = New-Object System.Windows.Forms.ToolStripMenuItem
$dashItem.Text = "Open Dashboard"
$dashItem.Font = New-Object System.Drawing.Font($dashItem.Font, [System.Drawing.FontStyle]::Bold)
$dashItem.Add_Click({
    Start-Process "http://127.0.0.1:3000/"
})
$contextMenu.Items.Add($dashItem) | Out-Null

# Open API Models
$modelsItem = New-Object System.Windows.Forms.ToolStripMenuItem
$modelsItem.Text = "View Models (/v1/models)"
$modelsItem.Add_Click({
    Start-Process "http://127.0.0.1:3000/v1/models"
})
$contextMenu.Items.Add($modelsItem) | Out-Null

# Check Status / Health
$statusItem = New-Object System.Windows.Forms.ToolStripMenuItem
$statusItem.Text = "Check Health Status"
$statusItem.Add_Click({
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:3000/health" -Method Get -TimeoutSec 2
        $trayIcon.ShowBalloonTip(3000, "OmniRouter Health", "Status: $($res.status)`nActive on http://127.0.0.1:3000", [System.Windows.Forms.ToolTipIcon]::Info)
    } catch {
        $trayIcon.ShowBalloonTip(3000, "OmniRouter Status", "Gateway is OFFLINE or unreachable.", [System.Windows.Forms.ToolTipIcon]::Warning)
    }
})
$contextMenu.Items.Add($statusItem) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

# Start Gateway
$startItem = New-Object System.Windows.Forms.ToolStripMenuItem
$startItem.Text = "Start Gateway"
$startItem.Add_Click({
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $DaemonScript start
})
$contextMenu.Items.Add($startItem) | Out-Null

# Stop Gateway
$stopItem = New-Object System.Windows.Forms.ToolStripMenuItem
$stopItem.Text = "Stop Gateway"
$stopItem.Add_Click({
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $DaemonScript stop
})
$contextMenu.Items.Add($stopItem) | Out-Null

# Restart Gateway
$restartItem = New-Object System.Windows.Forms.ToolStripMenuItem
$restartItem.Text = "Restart Gateway"
$restartItem.Add_Click({
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $DaemonScript restart
})
$contextMenu.Items.Add($restartItem) | Out-Null

$contextMenu.Items.Add((New-Object System.Windows.Forms.ToolStripSeparator)) | Out-Null

# Exit Tray Applet
$exitItem = New-Object System.Windows.Forms.ToolStripMenuItem
$exitItem.Text = "Exit System Tray"
$exitItem.Add_Click({
    $trayIcon.Visible = $false
    $trayIcon.Dispose()
    [System.Windows.Forms.Application]::Exit()
})
$contextMenu.Items.Add($exitItem) | Out-Null

$trayIcon.ContextMenuStrip = $contextMenu

# Double-click tray icon to open dashboard
$trayIcon.Add_DoubleClick({
    Start-Process "http://127.0.0.1:3000/"
})

# Show startup balloon notification
$trayIcon.ShowBalloonTip(2000, "OmniRouter Tray", "OmniRouter is running in system tray. Double-click to open dashboard.", [System.Windows.Forms.ToolTipIcon]::Info)

# Run Application Loop
[System.Windows.Forms.Application]::Run()

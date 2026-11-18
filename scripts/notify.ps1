<#
.SYNOPSIS
    Displays a native Windows desktop notification for OmniRouter.
.PARAMETER Title
    Title of the notification.
.PARAMETER Message
    Message body of the notification.
.PARAMETER Type
    Notification type: Info, Warning, or Error.
#>

[CmdletBinding()]
param(
    [string]$Title = "OmniRouter Gateway",
    [string]$Message = "OmniRouter is active and ready on http://127.0.0.1:3000",
    [ValidateSet("Info", "Warning", "Error")]
    [string]$Type = "Info"
)

$ErrorActionPreference = "SilentlyContinue"

# Strategy 1: Windows 10/11 WinRT Toast Notification
try {
    [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
    [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null

    $safeTitle = [System.Security.SecurityElement]::Escape($Title)
    $safeMessage = [System.Security.SecurityElement]::Escape($Message)

    $toastXml = @"
<toast>
    <visual>
        <binding template="ToastGeneric">
            <text>$safeTitle</text>
            <text>$safeMessage</text>
        </binding>
    </visual>
</toast>
"@

    $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
    $xml.LoadXml($toastXml)
    $toast = [Windows.UI.Notifications.ToastNotification]::new($xml)

    # Use standard Windows PowerShell AppUserModelId
    $appId = "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe"
    $notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId)
    $notifier.Show($toast)
    exit 0
} catch {
    # Fallback to Strategy 2
}

# Strategy 2: Windows Forms NotifyIcon Balloon Tip
try {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $notifyIcon = New-Object System.Windows.Forms.NotifyIcon
    switch ($Type) {
        "Warning" {
            $notifyIcon.Icon = [System.Drawing.SystemIcons]::Warning
            $tipIcon = [System.Windows.Forms.ToolTipIcon]::Warning
        }
        "Error" {
            $notifyIcon.Icon = [System.Drawing.SystemIcons]::Error
            $tipIcon = [System.Windows.Forms.ToolTipIcon]::Error
        }
        default {
            $notifyIcon.Icon = [System.Drawing.SystemIcons]::Information
            $tipIcon = [System.Windows.Forms.ToolTipIcon]::Info
        }
    }

    $notifyIcon.BalloonTipTitle = $Title
    $notifyIcon.BalloonTipText = $Message
    $notifyIcon.BalloonTipIcon = $tipIcon
    $notifyIcon.Visible = $true
    $notifyIcon.ShowBalloonTip(3000)
    Start-Sleep -Milliseconds 600
    $notifyIcon.Dispose()
    exit 0
} catch {
    # Non-blocking console output fallback
    Write-Output "[$Type] ${Title} - $Message"
    exit 0
}

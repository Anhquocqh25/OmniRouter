# Implementation Plan: Windows Desktop Daemon and System Tray Launcher

**Feature ID:** 006-windows-desktop-tray  
**Status:** In Progress  

## 1. Architecture & Windows Integration

```
+-------------------------------------------------------------+
|                      Windows 10/11 OS                       |
|                                                             |
|  +------------------------+      +------------------------+  |
|  |   System Tray Icon     |      |  Auto-Start Registry   |  |
|  |  (Windows Forms/WPF)   |      |  (HKCU:\...\Run)       |  |
|  +-----------+------------+      +-----------+------------+  |
|              |                               |               |
|              +---------------+---------------+               |
|                              |                               |
|                              v                               |
|  +--------------------------------------------------------+  |
|  |             scripts/daemon.ps1 Manager                 |  |
|  |  - start: Start-Process -WindowStyle Hidden            |  |
|  |  - stop: Stop-Process -Id (reads .omnirouter.pid)      |  |
|  |  - status: Verifies process & queries /health          |  |
|  |  - autostart: Registry helper                          |  |
|  +---------------------------+----------------------------+  |
|                              |                               |
|                              v                               |
|  +--------------------------------------------------------+  |
|  |         OmniRouter Fastify Gateway Process             |  |
|  |                  (Port 3000)                           |  |
|  |  - Native Windows Toast Notification upon listening     |  |
|  |  - Serves Dashboard & OpenAI API endpoints             |  |
|  +--------------------------------------------------------+  |
+-------------------------------------------------------------+
```

## 2. File Deliverables
- `scripts/daemon.ps1`: Core PowerShell daemon lifecycle manager (start, stop, status, restart, autostart).
- `scripts/tray.ps1`: Windows Forms NotifyIcon script for system tray applet.
- `scripts/notify.ps1`: Windows native toast notification sender.
- `omnirouter.cmd`: Root batch launcher for Windows.
- `src/utils/notifications.ts`: Native Windows notification helper invoked by Fastify on startup/failover.
- `package.json`: Scripts: `gateway:start`, `gateway:stop`, `gateway:status`, `gateway:tray`, `gateway:autostart`.

## 3. Verification Strategy
- Test daemon PID creation and cleanup.
- Verify status endpoint and process check.
- Test notification script execution without throwing.
- Vitest integration tests for daemon and notification utilities in `tests/windows.integration.test.ts`.

# Feature Specification: Windows Desktop Daemon and System Tray Launcher

**Feature ID:** 006-windows-desktop-tray  
**Status:** In Progress  
**Created:** 2026-11-19  

## 1. Overview & Objectives
Milestone 6 finalizes OmniRouter's local Windows workstation experience by providing:
1. **Windows Background Daemon**: Start/Stop/Status scripts that run OmniRouter in the background without keeping terminal windows open.
2. **PID & Health Lifecycle Management**: Reliable process management via `.omnirouter.pid`.
3. **Windows Startup Auto-Launch**: One-command configuration to start OmniRouter on user login.
4. **Windows System Tray Applet**: Native Windows Taskbar System Tray icon with right-click menu (Open Dashboard, View Status, Restart, Exit).
5. **Windows Native Notifications**: Toast notifications for server startup, failover triggers, and quota alerts.
6. **One-Click Launcher (`omnirouter.cmd`)**: Convenient batch script for instant launch.

## 2. Requirements & User Stories

### User Story 1 (US1): Background Process Management (P1)
- As a Windows user, I can run `npm run gateway:start` (or `.\scripts\daemon.ps1 start`) to launch OmniRouter silently in the background.
- I can run `npm run gateway:status` to check process ID, uptime, and configured providers.
- I can run `npm run gateway:stop` to gracefully shut down the gateway.

### User Story 2 (US2): Windows System Tray Applet (P1)
- As a user, I can launch `npm run gateway:tray` to keep OmniRouter accessible in the Windows notification area (System Tray).
- Right-clicking the tray icon presents:
  - "Open Dashboard" -> Opens default browser to `http://127.0.0.1:3000/`.
  - "Health Status" -> Shows provider status tooltip.
  - "Restart Gateway" -> Restarts background worker.
  - "Exit" -> Gracefully stops gateway and removes tray icon.

### User Story 3 (US3): Windows Auto-Start on Login (P2)
- As a user, I can enable automatic background startup on Windows login:
  - `.\scripts\daemon.ps1 autostart enable`
  - `.\scripts\daemon.ps1 autostart disable`

### User Story 4 (US4): Windows Native Toast Notifications (P2)
- On startup and critical failovers, OmniRouter triggers Windows toast notifications informing the user of gateway readiness and failover events.

## 3. Technology & Architecture
- Windows PowerShell with Windows Forms / WPF WinRT for System Tray and Toast Notifications.
- Windows Command Script (`omnirouter.cmd`) for quick execution.
- Tests to verify daemon lifecycle scripts, PID management, and notification scripts.

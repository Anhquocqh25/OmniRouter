# Tasks: Windows Desktop Daemon and System Tray Launcher

**Feature:** 006-windows-desktop-tray  
**Status:** Completed  

## Phase 1: Notification & Daemon Core
- [x] T001 Implement `src/utils/notifications.ts` (Windows Toast notification helper with graceful non-blocking fallback)
- [x] T002 Implement `scripts/notify.ps1` (PowerShell toast notification script using Windows WinRT / Balloon fallback)
- [x] T003 Implement `scripts/daemon.ps1` (start, stop, status, restart, autostart lifecycle manager)

## Phase 2: System Tray & Convenience Launcher
- [x] T004 Implement `scripts/tray.ps1` (Windows Forms System Tray NotifyIcon applet with menu)
- [x] T005 Implement `omnirouter.cmd` (root batch script for quick launch)
- [x] T006 Add Windows management scripts to `package.json` (`gateway:start`, `gateway:stop`, `gateway:status`, `gateway:tray`, `gateway:autostart`)

## Phase 3: Integration & Notifications Wiring
- [x] T007 Wire `notifyOnStartup` in `src/server.ts` when server binds and starts listening
- [x] T008 Write integration tests in `tests/windows.integration.test.ts` for daemon lifecycle, PID verification, and notifications

## Phase 4: Verification & Documentation
- [x] T009 Run `npm.cmd run typecheck` and `npm.cmd test` to ensure 100% pass rate
- [x] T010 Update `docs/ROADMAP.md` to reflect Milestone 6 completion
- [x] T011 Commit changes and present summary

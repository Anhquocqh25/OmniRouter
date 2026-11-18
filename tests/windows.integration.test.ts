import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { sendWindowsNotification } from "../src/utils/notifications.js";

describe("Windows Desktop & Daemon Integration", () => {
  const rootDir = process.cwd();
  const pidFilePath = path.join(rootDir, ".omnirouter.pid");

  beforeEach(() => {
    delete process.env.OMNIROUTER_DISABLE_NOTIFICATIONS;
  });

  afterEach(() => {
    delete process.env.OMNIROUTER_DISABLE_NOTIFICATIONS;
    // Clean up any test pid file
    if (fs.existsSync(pidFilePath)) {
      try {
        fs.unlinkSync(pidFilePath);
      } catch {
        // ignore
      }
    }
  });

  describe("File Deliverables Verification", () => {
    it("should have daemon.ps1, notify.ps1, tray.ps1, and omnirouter.cmd present", () => {
      expect(fs.existsSync(path.join(rootDir, "scripts", "daemon.ps1"))).toBe(true);
      expect(fs.existsSync(path.join(rootDir, "scripts", "notify.ps1"))).toBe(true);
      expect(fs.existsSync(path.join(rootDir, "scripts", "tray.ps1"))).toBe(true);
      expect(fs.existsSync(path.join(rootDir, "omnirouter.cmd"))).toBe(true);
    });
  });

  describe("sendWindowsNotification Utility", () => {
    it("should return false when OMNIROUTER_DISABLE_NOTIFICATIONS=1", () => {
      process.env.OMNIROUTER_DISABLE_NOTIFICATIONS = "1";
      const result = sendWindowsNotification({
        title: "Test Notification",
        message: "Should be skipped",
      });
      expect(result).toBe(false);
    });

    it("should return false when custom script path does not exist", () => {
      const result = sendWindowsNotification(
        {
          title: "Test Notification",
          message: "Non-existent script",
        },
        path.join(rootDir, "scripts", "non_existent.ps1")
      );
      expect(result).toBe(false);
    });

    it("should succeed and return true with valid notify.ps1 script", () => {
      const notifyPath = path.join(rootDir, "scripts", "notify.ps1");
      const result = sendWindowsNotification(
        {
          title: "OmniRouter Test",
          message: "Integration test message",
          type: "Info",
        },
        notifyPath
      );
      expect(result).toBe(true);
    });
  });

  describe("daemon.ps1 Script Execution", () => {
    it("should report status correctly via powershell", () => {
      if (process.platform !== "win32") {
        return;
      }

      const scriptPath = path.join(rootDir, "scripts", "daemon.ps1");
      const output = execSync(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" status`,
        { encoding: "utf-8" }
      );

      expect(output).toContain("OmniRouter Gateway");
    });

    it("should handle autostart status query without error", () => {
      if (process.platform !== "win32") {
        return;
      }

      const scriptPath = path.join(rootDir, "scripts", "daemon.ps1");
      const output = execSync(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" autostart`,
        { encoding: "utf-8" }
      );

      expect(output).toContain("Windows login auto-start");
    });

    it("should clean up stale PID files on status check", () => {
      if (process.platform !== "win32") {
        return;
      }

      // Write a non-existent PID (e.g. 999999)
      fs.writeFileSync(pidFilePath, "999999", "utf-8");
      expect(fs.existsSync(pidFilePath)).toBe(true);

      const scriptPath = path.join(rootDir, "scripts", "daemon.ps1");
      const output = execSync(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -File "${scriptPath}" status`,
        { encoding: "utf-8" }
      );

      expect(output).toContain("OFFLINE");
      // Stale PID file should have been cleaned up
      expect(fs.existsSync(pidFilePath)).toBe(false);
    });
  });
});

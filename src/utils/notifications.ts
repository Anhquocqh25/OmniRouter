import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";

export interface NotificationOptions {
  title: string;
  message: string;
  type?: "Info" | "Warning" | "Error";
}

/**
 * Sends a native Windows toast notification via scripts/notify.ps1.
 * Non-blocking, fails gracefully on non-Windows platforms or in test environments.
 */
export function sendWindowsNotification(
  options: NotificationOptions,
  customScriptPath?: string
): boolean {
  if (process.env.OMNIROUTER_DISABLE_NOTIFICATIONS === "1") {
    return false;
  }

  // Find notify.ps1 script
  const scriptPath =
    customScriptPath ||
    path.resolve(process.cwd(), "scripts", "notify.ps1");

  if (!fs.existsSync(scriptPath)) {
    return false;
  }

  // Only spawn powershell on win32 or when explicitly running
  if (process.platform !== "win32" && !customScriptPath) {
    return false;
  }

  try {
    const child = spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        scriptPath,
        "-Title",
        options.title,
        "-Message",
        options.message,
        "-Type",
        options.type || "Info",
      ],
      {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }
    );

    // Prevent parent process from waiting for notification script
    child.unref();
    return true;
  } catch {
    return false;
  }
}

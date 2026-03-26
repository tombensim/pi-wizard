import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

let logFile: string | null = null;

/**
 * Initialize wizard logging. Call once at startup.
 * Logs to .wizard/wizard.log in the given directory.
 */
export function initLog(cwd: string) {
	const dir = join(cwd, ".wizard");
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	logFile = join(dir, "wizard.log");
}

/**
 * Log a message with timestamp and level.
 */
export function wizardLog(level: "info" | "warn" | "error" | "debug", message: string) {
	if (!logFile) return;
	const ts = new Date().toISOString();
	const line = `[${ts}] [${level.toUpperCase()}] ${message}\n`;
	try {
		appendFileSync(logFile, line);
	} catch {
		// Silent fail — logging should never break the wizard
	}
}

/**
 * Get the log file path.
 */
export function getLogPath(): string | null {
	return logFile;
}

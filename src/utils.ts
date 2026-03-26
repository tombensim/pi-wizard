import type { WizardTheme } from "./types";

const SENSITIVE_KEY_PATTERN =
	/(pass(word)?|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|credential|session|cookie|bearer|auth)/i;

export function horizontalLine(width: number, theme: WizardTheme): string {
	return theme.fg("accent", "─".repeat(width));
}

export function renderStepIndicator(
	totalSteps: number,
	currentIndex: number,
	theme: WizardTheme,
): string {
	const dots = [];
	for (let i = 0; i < totalSteps; i++) {
		if (i < currentIndex) {
			dots.push(theme.fg("success", "●"));
		} else if (i === currentIndex) {
			dots.push(theme.fg("accent", "●"));
		} else {
			dots.push(theme.fg("dim", "○"));
		}
	}
	return " " + dots.join(" ");
}

export function renderProgressBar(
	progress: number,
	width: number,
	theme: WizardTheme,
): string {
	const pctText = ` ${Math.round(progress * 100)}%`;
	const barWidth = Math.max(10, width - pctText.length - 2);
	const filled = Math.round(progress * barWidth);
	const empty = barWidth - filled;
	const bar =
		theme.fg("accent", "━".repeat(filled)) +
		theme.fg("dim", "━".repeat(empty));
	return ` ${bar}${theme.fg("text", pctText)}`;
}

export function wrapText(text: string, width: number): string[] {
	const lines: string[] = [];
	for (const raw of text.split("\n")) {
		if (raw.length === 0) {
			lines.push("");
			continue;
		}
		let remaining = raw;
		while (remaining.length > width) {
			let breakAt = remaining.lastIndexOf(" ", width);
			if (breakAt <= 0) breakAt = width;
			lines.push(remaining.slice(0, breakAt));
			remaining = remaining.slice(breakAt).trimStart();
		}
		if (remaining.length > 0) lines.push(remaining);
	}
	return lines;
}

export function maskPassword(value: string, showLast = 4): string {
	if (value.length <= showLast) return "•".repeat(value.length);
	return "•".repeat(value.length - showLast) + value.slice(-showLast);
}

export function formatFieldValue(
	fieldType: string,
	value: any,
): string {
	if (value === undefined || value === null || value === "") return "";
	if (fieldType === "password") return maskPassword(String(value));
	if (fieldType === "confirm") return value ? "Yes" : "No";
	return String(value);
}

export function isSensitiveKey(key: string): boolean {
	return SENSITIVE_KEY_PATTERN.test(key);
}

export function safeDisplayValue(key: string, value: unknown): string {
	if (value === undefined || value === null || value === "") return "(empty)";
	if (isSensitiveKey(key)) return "[redacted]";
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (typeof value === "number" || typeof value === "bigint") return String(value);
	if (typeof value === "string") return value;
	if (Array.isArray(value)) return value.length === 0 ? "(empty)" : `[${value.length} item(s)]`;
	return "[complex value]";
}

export function listPublicDataEntries(data: Record<string, unknown>): Array<[string, string]> {
	return Object.entries(data)
		.filter(([key]) => !key.startsWith("__"))
		.map(([key, value]) => [key, safeDisplayValue(key, value)]);
}

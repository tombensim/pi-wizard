import { Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";
import type { InfoStep, StepContext, StepRenderer } from "../types";
import { wrapText } from "../utils";

export function createInfoRenderer(stepCtx: StepContext): StepRenderer {
	const step = stepCtx.step as InfoStep;
	const { theme, onNext, onBack, onPause, refresh } = stepCtx;
	let cachedLines: string[] | undefined;

	return {
		render(width: number): string[] {
			if (cachedLines) return cachedLines;

			const lines: string[] = [];
			const contentWidth = width - 2;

			// Render body with basic formatting
			for (const raw of step.body.split("\n")) {
				if (raw.startsWith("# ")) {
					lines.push(" " + theme.fg("accent", theme.bold(raw.slice(2))));
				} else if (raw.startsWith("- ")) {
					lines.push(" " + theme.fg("text", "  • " + raw.slice(2)));
				} else if (raw.trim() === "") {
					lines.push("");
				} else {
					for (const wrapped of wrapText(raw, contentWidth)) {
						lines.push(" " + theme.fg("text", wrapped));
					}
				}
			}

			lines.push("");
			lines.push(
				" " + theme.fg("dim", "Enter to continue • Esc to go back • ? for help"),
			);

			cachedLines = lines.map((l) => truncateToWidth(l, width));
			return cachedLines;
		},

		handleInput(data: string) {
			if (data === "?") {
				onPause();
				return;
			}
			if (matchesKey(data, Key.enter) || matchesKey(data, Key.right)) {
				onNext();
			} else if (matchesKey(data, Key.escape) || matchesKey(data, Key.left) || matchesKey(data, Key.shift("tab"))) {
				onBack();
			}
		},

		invalidate() {
			cachedLines = undefined;
		},
	};
}

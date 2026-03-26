import { Key, matchesKey, truncateToWidth } from "@mariozechner/pi-tui";
import type { SummaryStep, StepContext, StepRenderer, WizardStep } from "../types";
import { formatFieldValue } from "../utils";

export function createSummaryRenderer(stepCtx: StepContext): StepRenderer {
	const step = stepCtx.step as SummaryStep;
	const { state, theme, onNext, onBack, onPause } = stepCtx;
	let cachedLines: string[] | undefined;

	// Compute field metadata once at creation time
	const fieldMeta = new Map<string, { label: string; type: string }>();
	for (const s of (state.data.__wizardSteps as WizardStep[] | undefined) ?? []) {
		if (s.type === "form") {
			for (const f of s.fields) {
				fieldMeta.set(f.id, { label: f.label, type: f.type });
			}
		}
	}

	return {
		render(width: number): string[] {
			if (cachedLines) return cachedLines;

			const lines: string[] = [];

			// Use custom format function if provided
			if (step.format) {
				const formatted = step.format(state.data);
				const maxLabel = Math.max(...formatted.map((f) => f.label.length), 0);
				for (const { label, value } of formatted) {
					const padded = label.padEnd(maxLabel);
					lines.push(
						" " +
							theme.fg("muted", padded + ":  ") +
							theme.fg("text", value),
					);
				}
			} else {
				// Auto-generate from collected data
				const entries: { label: string; value: string; type: string }[] = [];
				const fieldsFilter = step.fields
					? new Set(step.fields)
					: null;

				for (const [key, value] of Object.entries(state.data)) {
					if (key.startsWith("__")) continue;
					if (fieldsFilter && !fieldsFilter.has(key)) continue;

					const fm = fieldMeta.get(key);
					const label = fm?.label ?? key;
					const type = fm?.type ?? "text";
					entries.push({ label, value: formatFieldValue(type, value), type });
				}

				if (entries.length === 0) {
					lines.push(" " + theme.fg("dim", "No data collected."));
				} else {
					const maxLabel = Math.max(...entries.map((e) => e.label.length), 0);
					for (const { label, value } of entries) {
						const padded = label.padEnd(maxLabel);
						lines.push(
							" " +
								theme.fg("muted", padded + ":  ") +
								theme.fg("text", value || theme.fg("dim", "(empty)")),
						);
					}
				}
			}

			lines.push("");
			lines.push(
				" " + theme.fg("dim", "Enter to confirm • Esc to go back • ? for help"),
			);

			cachedLines = lines.map((l) => truncateToWidth(l, width));
			return cachedLines;
		},

		handleInput(data: string) {
			if (data === "?") {
				onPause();
				return;
			}
			if (matchesKey(data, Key.enter)) {
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

import { truncateToWidth } from "@mariozechner/pi-tui";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { ActionStep, StepContext, StepRenderer, WizardDefinition, WizardResult, WizardState, WizardTheme, WizardTui } from "./types";
import { horizontalLine, renderStepIndicator } from "./utils";
import { wizardLog } from "./log";
import { createInfoRenderer } from "./steps/info";
import { createFormRenderer } from "./steps/form";
import { createActionRenderer } from "./steps/action";
import { createSummaryRenderer } from "./steps/summary";

function createStepRenderer(stepCtx: StepContext): StepRenderer {
	switch (stepCtx.step.type) {
		case "info":
			return createInfoRenderer(stepCtx);
		case "form":
			return createFormRenderer(stepCtx);
		case "action":
			return createActionRenderer(stepCtx);
		case "summary":
			return createSummaryRenderer(stepCtx);
	}
}

export function createWizardComponent(
	definition: WizardDefinition,
	state: WizardState,
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	tui: WizardTui,
	theme: WizardTheme,
	done: (result: WizardResult) => void,
) {
	let currentRenderer: StepRenderer | null = null;
	let cachedLines: string[] | undefined;

	// Store step definitions in state for summary to read field metadata
	state.data.__wizardSteps = definition.steps;

	function refresh() {
		cachedLines = undefined;
		tui.requestRender();
	}

	function buildResult(): WizardResult {
		const taskResults: Record<string, any> = {};
		for (const [key, status] of state.taskStatuses) {
			taskResults[key] = {
				success: status.state === "done",
				output: status.output,
				error: status.error,
			};
		}
		// Clean internal keys from data
		const data = { ...state.data };
		delete data.__wizardSteps;
		const currentStep = definition.steps[state.currentStepIndex];
		// Collect pending tasks if pausing on a delegated action step
		let pendingTasks: { id: string; label: string; description?: string }[] | undefined;
		if (state.paused && currentStep?.type === "action") {
			const isDelegated = currentStep.mode === "delegated" || currentStep.tasks.every((t) => !t.run);
			if (isDelegated) {
				pendingTasks = currentStep.tasks
					.filter((t) => {
						const s = state.taskStatuses.get(t.id);
						return s?.state === "pending" || s?.state === "failed";
					})
					.map((t) => ({ id: t.id, label: t.label, description: t.description }));
			}
		}

		return {
			completed: state.completed,
			cancelled: state.cancelled,
			paused: state.paused,
			pauseReason: state.pauseReason,
			wizardTitle: definition.title,
			wizardDescription: definition.description,
			currentStepId: currentStep?.id,
			currentStepTitle: currentStep?.title,
			currentStepIndex: state.currentStepIndex,
			totalSteps: definition.steps.length,
			allSteps: definition.steps.map((s) => ({ id: s.id, title: s.title, type: s.type })),
			pendingTasks,
			data,
			taskResults,
		};
	}

	function goToStep(index: number) {
		if (index < 0) {
			// Cancel on first step
			state.cancelled = true;
			done(buildResult());
			return;
		}
		if (index >= definition.steps.length) {
			// Completed
			state.completed = true;
			done(buildResult());
			return;
		}

		state.navigationHistory.push(state.currentStepIndex);
		state.currentStepIndex = index;
		wizardLog("info", `Navigate to step ${index}: "${definition.steps[index].title}" (${definition.steps[index].type})`);
		currentRenderer = createStepRenderer(makeStepCtx());
		refresh();
	}

	function goBack() {
		if (state.navigationHistory.length > 0) {
			state.currentStepIndex = state.navigationHistory.pop()!;
			currentRenderer = createStepRenderer(makeStepCtx());
			refresh();
		} else {
			// Cancel if at the beginning
			state.cancelled = true;
			done(buildResult());
		}
	}

	function onNext() {
		goToStep(state.currentStepIndex + 1);
	}

	function onCancel() {
		state.cancelled = true;
		done(buildResult());
	}

	function onPause(reason?: string) {
		state.paused = true;
		state.pauseReason = reason;
		done(buildResult());
	}

	function makeStepCtx(): StepContext {
		return {
			state,
			step: definition.steps[state.currentStepIndex],
			theme,
			tui,
			onNext,
			onBack: goBack,
			onCancel,
			onPause,
			refresh,
			pi,
			ctx,
		};
	}

	// Initialize first step renderer
	currentRenderer = createStepRenderer(makeStepCtx());

	return {
		render(width: number): string[] {
			if (cachedLines) return cachedLines;

			const lines: string[] = [];
			const add = (s: string) => lines.push(truncateToWidth(s, width));

			// Top border
			add(horizontalLine(width, theme));

			// Title
			add(" " + theme.fg("text", theme.bold(definition.title)));

			// Step indicator
			add(renderStepIndicator(definition.steps.length, state.currentStepIndex, theme));

			lines.push("");

			// Current step title
			const currentStep = definition.steps[state.currentStepIndex];
			add(
				" " +
					theme.fg("accent", theme.bold(currentStep.title)) +
					theme.fg("dim", ` (${state.currentStepIndex + 1}/${definition.steps.length})`),
			);
			add(horizontalLine(width, theme));
			lines.push("");

			// Step content
			if (currentRenderer) {
				for (const line of currentRenderer.render(width)) {
					lines.push(line);
				}
			}

			lines.push("");
			// Bottom border
			add(horizontalLine(width, theme));

			cachedLines = lines;
			return cachedLines;
		},

		handleInput(data: string) {
			if (currentRenderer) {
				currentRenderer.handleInput(data);
			}
		},

		invalidate() {
			cachedLines = undefined;
			if (currentRenderer) currentRenderer.invalidate();
		},
	};
}

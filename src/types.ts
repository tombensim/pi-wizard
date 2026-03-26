import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

// ── Field Types ──

export interface TextField {
	type: "text";
	id: string;
	label: string;
	placeholder?: string;
	required?: boolean;
	default?: string;
	validate?: (value: string, data: WizardData) => string | null;
}

export interface SelectField {
	type: "select";
	id: string;
	label: string;
	options: SelectOption[];
	default?: string;
}

export interface SelectOption {
	value: string;
	label: string;
	description?: string;
}

export interface PasswordField {
	type: "password";
	id: string;
	label: string;
	required?: boolean;
}

export interface ConfirmField {
	type: "confirm";
	id: string;
	label: string;
	default?: boolean;
}

export type FormField = TextField | SelectField | PasswordField | ConfirmField;

// ── Step Types ──

export interface InfoStep {
	type: "info";
	id: string;
	title: string;
	body: string;
}

export interface FormStep {
	type: "form";
	id: string;
	title: string;
	fields: FormField[];
}

export interface ActionTask {
	id: string;
	label: string;
	/** Description of what the LLM should do for this task */
	description?: string;
	/** Optional: shell command or function for self-executing tasks (developer API) */
	run?: string | ((data: WizardData, ctx: ExtensionContext) => Promise<ActionTaskResult>);
	weight?: number;
}

export interface ActionTaskResult {
	success: boolean;
	output?: string;
	error?: string;
}

export interface ActionStep {
	type: "action";
	id: string;
	title: string;
	tasks: ActionTask[];
	/**
	 * Execution mode:
	 * - "auto": tasks with `run` execute automatically (default for backward compat)
	 * - "delegated": always pause and let the LLM execute tasks
	 */
	mode?: "auto" | "delegated";
}

export interface SummaryStep {
	type: "summary";
	id: string;
	title: string;
	fields?: string[];
	format?: (data: WizardData) => { label: string; value: string }[];
}

export type WizardStep = InfoStep | FormStep | ActionStep | SummaryStep;

// ── Wizard Definition ──

export interface WizardDefinition {
	title: string;
	description?: string;
	steps: WizardStep[];
}

// ── Minimal UI interfaces (structural subset of pi-tui) ──

export interface WizardTheme {
	fg(color: string, text: string): string;
	bold(text: string): string;
}

export interface WizardTui {
	requestRender(): void;
}

// ── State ──

export type WizardData = Record<string, unknown>;

export type TaskState = "pending" | "running" | "done" | "failed";

export interface TaskStatus {
	id: string;
	label: string;
	state: TaskState;
	output?: string;
	error?: string;
}

export interface WizardState {
	currentStepIndex: number;
	data: WizardData;
	taskStatuses: Map<string, TaskStatus>;
	navigationHistory: number[];
	completed: boolean;
	cancelled: boolean;
	paused: boolean;
	pauseReason?: string;
}

// ── Result ──

export interface WizardResult {
	completed: boolean;
	cancelled: boolean;
	paused: boolean;
	pauseReason?: string;
	wizardTitle?: string;
	wizardDescription?: string;
	currentStepId?: string;
	currentStepTitle?: string;
	currentStepIndex?: number;
	totalSteps?: number;
	allSteps?: { id: string; title: string; type: string }[];
	/** Tasks the LLM needs to execute (only set when paused on a delegated action step) */
	pendingTasks?: { id: string; label: string; description?: string }[];
	data: WizardData;
	taskResults: Record<string, ActionTaskResult>;
}

// ── Renderer interfaces ──

export interface StepRenderer {
	render(width: number): string[];
	handleInput(data: string): void;
	invalidate(): void;
}

export interface StepContext {
	state: WizardState;
	step: WizardStep;
	theme: WizardTheme;
	tui: WizardTui;
	onNext: () => void;
	onBack: () => void;
	onCancel: () => void;
	onPause: (reason?: string) => void;
	refresh: () => void;
	pi: ExtensionAPI;
	ctx: ExtensionContext;
}

import { Type } from "@sinclair/typebox";

const SelectOptionSchema = Type.Object({
	value: Type.String({ description: "The value returned when selected" }),
	label: Type.String({ description: "Display label" }),
	description: Type.Optional(Type.String({ description: "Optional description" })),
});

const TextFieldSchema = Type.Object({
	type: Type.Literal("text"),
	id: Type.String({ description: "Unique field identifier" }),
	label: Type.String({ description: "Display label" }),
	placeholder: Type.Optional(Type.String()),
	required: Type.Optional(Type.Boolean()),
	default: Type.Optional(Type.String()),
});

const SelectFieldSchema = Type.Object({
	type: Type.Literal("select"),
	id: Type.String(),
	label: Type.String(),
	options: Type.Array(SelectOptionSchema),
	default: Type.Optional(Type.String()),
});

const PasswordFieldSchema = Type.Object({
	type: Type.Literal("password"),
	id: Type.String(),
	label: Type.String(),
	required: Type.Optional(Type.Boolean()),
});

const ConfirmFieldSchema = Type.Object({
	type: Type.Literal("confirm"),
	id: Type.String(),
	label: Type.String(),
	default: Type.Optional(Type.Boolean()),
});

const FormFieldSchema = Type.Union([
	TextFieldSchema,
	SelectFieldSchema,
	PasswordFieldSchema,
	ConfirmFieldSchema,
]);

const InfoStepSchema = Type.Object({
	type: Type.Literal("info"),
	id: Type.String(),
	title: Type.String(),
	body: Type.String({ description: "Information text to display" }),
});

const FormStepSchema = Type.Object({
	type: Type.Literal("form"),
	id: Type.String(),
	title: Type.String(),
	fields: Type.Array(FormFieldSchema),
});

const LLMTaskSchema = Type.Object({
	id: Type.String(),
	label: Type.String({ description: "Human-readable task label" }),
	description: Type.Optional(Type.String({ description: "Detailed description of what to do" })),
	weight: Type.Optional(Type.Number({ description: "Relative weight for progress (default 1)" })),
});

const ActionStepSchema = Type.Object({
	type: Type.Literal("action"),
	id: Type.String(),
	title: Type.String(),
	tasks: Type.Array(LLMTaskSchema),
	mode: Type.Optional(Type.Literal("delegated")),
});

const SummaryStepSchema = Type.Object({
	type: Type.Literal("summary"),
	id: Type.String(),
	title: Type.String(),
	fields: Type.Optional(Type.Array(Type.String(), { description: "Field IDs to display; omit for all" })),
});

const WizardStepSchema = Type.Union([
	InfoStepSchema,
	FormStepSchema,
	ActionStepSchema,
	SummaryStepSchema,
]);

export const WizardToolParams = Type.Object({
	title: Type.String({ description: "Wizard title displayed at the top" }),
	description: Type.Optional(Type.String({ description: "Description of what this wizard does" })),
	steps: Type.Array(WizardStepSchema, {
		description: "Ordered list of wizard steps. Types: info, form, action (delegated to LLM), summary.",
	}),
});

export const WizardUpdateParams = Type.Object({
	wizard: Type.String({ description: "Wizard title (identifies the session)" }),
	taskId: Type.String({ description: "The task ID to report results for" }),
	success: Type.Boolean({ description: "Whether the task succeeded" }),
	output: Type.Optional(Type.String({ description: "Task output or result description" })),
	error: Type.Optional(Type.String({ description: "Error message if failed" })),
});

export const WizardAddStepsParams = Type.Object({
	wizard: Type.String({ description: "Wizard title (identifies the session)" }),
	steps: Type.Array(WizardStepSchema, {
		description: "New steps to append to the wizard.",
	}),
});

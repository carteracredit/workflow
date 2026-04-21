import type { Meta, StoryObj } from "@storybook/nextjs";
import { VariableTemplateInput } from "@/components/workflow/variable-picker/variable-template-input";
import type { TemplateSegment } from "@/components/workflow/variable-picker/variable-template-input";
import type { VariableSourceNode } from "@/components/workflow/variable-picker/types";

const mockSources: VariableSourceNode[] = [
	{
		id: "coapplicantForm",
		name: "Coapplicant Form",
		variables: [
			{ name: "phone", path: "coapplicantForm.phone", type: "string" },
			{ name: "email", path: "coapplicantForm.email", type: "string" },
		],
	},
	{
		id: "checkCredit",
		name: "Check Credit",
		variables: [
			{ name: "score", path: "checkCredit.score", type: "number" },
			{ name: "approved", path: "checkCredit.approved", type: "boolean" },
		],
	},
];

const emptySegments: TemplateSegment[] = [];

const segmentsWithVariable: TemplateSegment[] = [
	{ id: "1", type: "text", value: "Hola, " },
	{
		id: "2",
		type: "variable",
		value: "phone",
		variablePath: "coapplicantForm.phone",
		variableType: "string",
		nodeName: "Coapplicant Form",
		nodeId: "coapplicantForm",
	},
];

const segmentsWithOrphan: TemplateSegment[] = [
	{ id: "1", type: "text", value: "Score: " },
	{
		id: "2",
		type: "variable",
		value: "value",
		variablePath: "deletedNode.value",
		variableType: "number",
		nodeName: undefined,
		nodeId: undefined,
		orphan: true,
	},
];

const meta: Meta<typeof VariableTemplateInput> = {
	title: "Components/Workflow/VariableTemplateInput",
	component: VariableTemplateInput,
	parameters: {
		layout: "padded",
	},
	args: {
		nodes: mockSources,
		onChange: () => {},
	},
};

export default meta;
type Story = StoryObj<typeof VariableTemplateInput>;

export const Empty: Story = {
	args: {
		value: emptySegments,
		placeholder: "Escribe texto o agrega variables...",
	},
};

export const WithTextAndVariable: Story = {
	name: "Con texto y variable (alias camelCase)",
	args: {
		value: segmentsWithVariable,
	},
};

export const WithOrphanedVariable: Story = {
	name: "Con variable huérfana (alias no resuelto)",
	args: {
		value: segmentsWithOrphan,
	},
};

export const MultipleVariables: Story = {
	name: "Múltiples variables y texto",
	args: {
		value: [
			{ id: "1", type: "text", value: "Tel: " },
			{
				id: "2",
				type: "variable",
				value: "phone",
				variablePath: "coapplicantForm.phone",
				variableType: "string",
				nodeName: "Coapplicant Form",
				nodeId: "coapplicantForm",
			},
			{ id: "3", type: "text", value: " | Score: " },
			{
				id: "4",
				type: "variable",
				value: "score",
				variablePath: "checkCredit.score",
				variableType: "number",
				nodeName: "Check Credit",
				nodeId: "checkCredit",
			},
		],
	},
};

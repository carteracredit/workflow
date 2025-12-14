import type { Meta, StoryObj } from "@storybook/nextjs";
import { ValidationTray } from "@/components/workflow/validation-tray";
import type { ValidationError } from "@/lib/workflow/types";

const mockErrors: ValidationError[] = [
	{
		nodeId: "node-1",
		message: 'El nodo "Formulario" debe tener al menos un rol asignado',
		severity: "error",
	},
	{
		nodeId: "node-2",
		message: 'El nodo "Decisión" debe tener dos salidas conectadas',
		severity: "error",
	},
	{
		message: "El flujo debe tener al menos un nodo de finalización",
		severity: "warning",
	},
];

const meta: Meta<typeof ValidationTray> = {
	title: "Components/Workflow/ValidationTray",
	component: ValidationTray,
	parameters: {
		layout: "padded",
	},
	args: {
		errors: mockErrors,
		onClose: () => {},
		onSelectNode: () => {},
	},
	decorators: [
		(Story) => (
			<div style={{ height: "200px", position: "relative" }}>
				<Story />
			</div>
		),
	],
};

export default meta;
type Story = StoryObj<typeof ValidationTray>;

export const Default: Story = {};

export const SingleError: Story = {
	args: {
		errors: [mockErrors[0]],
	},
};

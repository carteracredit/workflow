import type { Meta, StoryObj } from "@storybook/nextjs";
import { PropertiesPanel } from "@/components/workflow/properties-panel";
import type {
	WorkflowNode,
	WorkflowEdge,
	WorkflowMetadata,
} from "@/lib/workflow/types";

const mockMetadata: WorkflowMetadata = {
	name: "Flujo de Crédito",
	description: "Flujo de aprobación de créditos",
	version: "1.0.0",
	author: "Juan Pérez",
	tags: ["crédito", "aprobación"],
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
};

const mockNode: WorkflowNode = {
	id: "node-1",
	type: "Form",
	title: "Formulario de Solicitud",
	description: "Captura de datos del solicitante",
	roles: ["Solicitante", "Vendedor"],
	config: { formId: "form-1" },
	staleTimeout: null,
	position: { x: 100, y: 200 },
	groupId: null,
};

const mockEdge: WorkflowEdge = {
	id: "edge-1",
	from: "node-1",
	to: "node-2",
	label: "Siguiente",
	thickness: 2,
};

const meta: Meta<typeof PropertiesPanel> = {
	title: "Components/Workflow/PropertiesPanel",
	component: PropertiesPanel,
	parameters: {
		layout: "padded",
	},
	args: {
		onUpdateNode: () => {},
		onUpdateEdge: () => {},
		onUpdateMetadata: () => {},
		onAddEdge: () => {},
		onDeleteEdge: () => {},
		workflowMetadata: mockMetadata,
		nodes: [],
		edges: [],
		flags: [],
		showWorkflowProperties: false,
		onCloseWorkflowProperties: () => {},
	},
	decorators: [
		(Story) => (
			<div style={{ height: "600px", display: "flex" }}>
				<Story />
			</div>
		),
	],
};

export default meta;
type Story = StoryObj<typeof PropertiesPanel>;

export const NoSelection: Story = {
	args: {
		selectedNode: undefined,
		selectedEdge: undefined,
	},
};

export const NodeSelected: Story = {
	args: {
		selectedNode: mockNode,
		selectedEdge: undefined,
	},
};

export const EdgeSelected: Story = {
	args: {
		selectedNode: undefined,
		selectedEdge: mockEdge,
	},
};

import type { Meta, StoryObj } from "@storybook/react";

import { JSONModal } from "@/components/workflow/json-modal";
import type { WorkflowEdge, WorkflowNode } from "@/lib/workflow/types";

const SAMPLE_NODES: WorkflowNode[] = [
	{
		id: "node-start",
		type: "Start",
		title: "Inicio",
		description: "Punto de partida",
		roles: [],
		config: {},
		staleTimeout: null,
		position: { x: 0, y: 0 },
		groupId: null,
	},
	{
		id: "node-form",
		type: "Form",
		title: "Formulario",
		description: "Captura de datos",
		roles: ["Solicitante"],
		config: {},
		staleTimeout: null,
		position: { x: 220, y: 0 },
		groupId: null,
	},
];

const SAMPLE_EDGES: WorkflowEdge[] = [
	{ id: "edge-01", from: "node-start", to: "node-form", label: "Siguiente" },
];

const meta = {
	title: "Components/Workflow/JSONModal",
	component: JSONModal,
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof JSONModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ExportMode: Story = {
	args: {
		mode: "export",
		workflow: { nodes: SAMPLE_NODES, edges: SAMPLE_EDGES },
		onClose: () => {},
		onImport: () => {},
	},
	render: (args) => (
		<div className="bg-background p-6">
			<JSONModal {...args} />
		</div>
	),
};

export const ImportMode: Story = {
	args: {
		...ExportMode.args,
		mode: "import" as const,
	},
	render: ExportMode.render,
};

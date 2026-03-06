import type { Meta, StoryObj } from "@storybook/react";

import { PreviewModal } from "@/components/workflow/preview-modal";
import type { WorkflowEdge, WorkflowNode } from "@/lib/workflow/types";

const PREVIEW_NODES: WorkflowNode[] = [
	{
		id: "start",
		type: "Start",
		title: "Inicio",
		description: "Se detecta nueva solicitud",
		roles: [],
		config: {},
		staleTimeout: null,
		position: { x: 0, y: 0 },
		groupId: null,
	},
	{
		id: "decision",
		type: "Decision",
		title: "Motor de riesgo",
		description: "Evalúa score y buró",
		roles: ["Agente de Crédito"],
		config: {},
		staleTimeout: null,
		position: { x: 220, y: 0 },
		groupId: null,
	},
	{
		id: "end",
		type: "End",
		title: "Aprobado",
		description: "Fin del flujo",
		roles: [],
		config: {},
		staleTimeout: null,
		position: { x: 440, y: 0 },
		groupId: null,
	},
];

const PREVIEW_EDGES: WorkflowEdge[] = [
	{ id: "edge-start", from: "start", to: "decision", label: "Continuar" },
	{ id: "edge-end", from: "decision", to: "end", label: "Aprobado" },
];

const meta = {
	title: "Components/Workflow/PreviewModal",
	component: PreviewModal,
	parameters: {
		layout: "fullscreen",
	},
} satisfies Meta<typeof PreviewModal>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
	args: {
		nodes: PREVIEW_NODES,
		edges: PREVIEW_EDGES,
		onClose: () => {},
	},
	render: (args) => (
		<div className="bg-background p-6">
			<PreviewModal {...args} />
		</div>
	),
};

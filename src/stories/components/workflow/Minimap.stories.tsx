import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs";
import { Minimap } from "@/components/workflow/minimap";
import type { WorkflowNode, WorkflowEdge } from "@/lib/workflow/types";

const sampleNodes: WorkflowNode[] = [
	{
		id: "start",
		type: "Start",
		title: "Inicio",
		description: "",
		roles: [],
		config: {},
		staleTimeout: null,
		groupId: null,
		position: { x: 120, y: 120 },
	},
	{
		id: "form",
		type: "Form",
		title: "Formulario",
		description: "Captura de datos",
		roles: [],
		config: {},
		staleTimeout: null,
		groupId: null,
		position: { x: 500, y: 280 },
	},
	{
		id: "decision",
		type: "Decision",
		title: "Evaluación",
		description: "Reglas de aprobación",
		roles: [],
		config: {},
		staleTimeout: null,
		groupId: null,
		position: { x: 940, y: 520 },
	},
	{
		id: "end",
		type: "End",
		title: "Final",
		description: "",
		roles: [],
		config: {},
		staleTimeout: null,
		groupId: null,
		position: { x: 1340, y: 520 },
	},
];

const sampleEdges: WorkflowEdge[] = [
	{ id: "edge-1", from: "start", to: "form", label: null },
	{ id: "edge-2", from: "form", to: "decision", label: null },
	{ id: "edge-3", from: "decision", to: "end", label: null },
];

const meta: Meta<typeof Minimap> = {
	title: "Components/Workflow/Minimap",
	component: Minimap,
	args: {
		nodes: sampleNodes,
		edges: sampleEdges,
		zoom: 1,
		pan: { x: 200, y: 150 },
		viewportSize: { width: 1200, height: 800 },
		onUpdatePan: () => {},
	},
	parameters: {
		layout: "padded",
	},
};

export default meta;
type Story = StoryObj<typeof Minimap>;

export const Default: Story = {
	render: (args) => {
		const [pan, setPan] = useState(args.pan);

		return (
			<div className="space-y-3">
				<Minimap
					{...args}
					pan={pan}
					onUpdatePan={(nextPan) => {
						setPan(nextPan);
					}}
				/>
				<div className="text-xs text-muted-foreground">
					Pan actual: ({Math.round(pan.x)}, {Math.round(pan.y)})
				</div>
			</div>
		);
	},
};

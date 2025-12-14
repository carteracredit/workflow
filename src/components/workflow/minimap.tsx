import type { WorkflowNode, WorkflowEdge } from "@/lib/workflow/types";

interface MinimapProps {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
	zoom: number;
	pan: { x: number; y: number };
	onUpdatePan: (pan: { x: number; y: number }) => void;
}

export function Minimap({ nodes }: MinimapProps) {
	if (nodes.length === 0) return null;

	const scale = 0.1;
	const width = 200;
	const height = 150;

	return (
		<div className="rounded border border-border bg-card p-2 shadow-lg">
			<svg width={width} height={height} className="overflow-hidden rounded">
				<rect width={width} height={height} fill="var(--canvas-bg)" />

				{nodes.map((node) => (
					<rect
						key={node.id}
						x={node.position.x * scale}
						y={node.position.y * scale}
						width={200 * scale}
						height={100 * scale}
						fill="var(--primary)"
						opacity={0.6}
						rx={4}
					/>
				))}
			</svg>
		</div>
	);
}

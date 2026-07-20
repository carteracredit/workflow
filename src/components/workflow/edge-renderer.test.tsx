import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { EdgeRenderer } from "./edge-renderer";
import type { WorkflowEdge, WorkflowNode } from "@/lib/workflow/types";

const createNode = (overrides: Partial<WorkflowNode>): WorkflowNode => ({
	id: "node",
	type: "Form",
	title: "Nodo",
	description: "",
	roles: [],
	config: {},
	position: { x: 0, y: 0 },
	groupId: null,
	...overrides,
});

const noop = () => {};

describe("EdgeRenderer horizontal layout", () => {
	it("builds a horizontal curve from right to left connectors", () => {
		const source = createNode({ id: "source", position: { x: 300, y: 100 } });
		const target = createNode({ id: "target", position: { x: 700, y: 150 } });
		const edge: WorkflowEdge = {
			id: "edge-1",
			from: "source",
			to: "target",
			label: null,
		};

		const { container } = render(
			<svg>
				<EdgeRenderer
					edge={edge}
					nodes={[source, target]}
					edges={[edge]}
					selected={false}
					onSelect={noop}
					onDelete={noop}
				/>
			</svg>,
		);

		const visiblePath = container.querySelector(
			"path[marker-end]",
		) as SVGPathElement | null;
		expect(visiblePath).toBeTruthy();
		expect(visiblePath?.getAttribute("d")).toBe(
			"M 480 130 C 584 130, 584 180, 688 180",
		);
	});

	it("distributes join inputs vertically along the left edge", () => {
		const topSource = createNode({
			id: "source-a",
			position: { x: 300, y: 100 },
		});
		const bottomSource = createNode({
			id: "source-b",
			position: { x: 300, y: 260 },
		});
		const joinNode = createNode({
			id: "join",
			type: "Join",
			position: { x: 800, y: 200 },
		});

		const edges: WorkflowEdge[] = [
			{ id: "edge-1", from: "source-a", to: "join", label: null },
			{ id: "edge-2", from: "source-b", to: "join", label: null },
		];

		const { container } = render(
			<svg>
				{edges.map((edge) => (
					<EdgeRenderer
						key={edge.id}
						edge={edge}
						nodes={[topSource, bottomSource, joinNode]}
						edges={edges}
						selected={false}
						onSelect={noop}
						onDelete={noop}
					/>
				))}
			</svg>,
		);

		const visiblePaths = Array.from(
			container.querySelectorAll("path[marker-end]"),
		);
		expect(visiblePaths).toHaveLength(2);
		expect(visiblePaths[0].getAttribute("d")).toBe(
			"M 480 130 C 634 130, 634 206, 788 206",
		);
		expect(visiblePaths[1].getAttribute("d")).toBe(
			"M 480 290 C 634 290, 634 254, 788 254",
		);
	});
});

describe("EdgeRenderer dual green/red output colors", () => {
	it("colors the 'top' (positive) edge green and the 'bottom' (negative) edge red for a Challenge source", () => {
		const source = createNode({
			id: "source",
			type: "Challenge",
			position: { x: 300, y: 100 },
		});
		const target = createNode({ id: "target", position: { x: 700, y: 150 } });
		const topEdge: WorkflowEdge = {
			id: "edge-top",
			from: "source",
			to: "target",
			fromPort: "top",
			label: null,
		};
		const bottomEdge: WorkflowEdge = {
			id: "edge-bottom",
			from: "source",
			to: "target",
			fromPort: "bottom",
			label: null,
		};

		const { container } = render(
			<svg>
				<EdgeRenderer
					edge={topEdge}
					nodes={[source, target]}
					edges={[topEdge, bottomEdge]}
					selected={false}
					onSelect={noop}
					onDelete={noop}
				/>
				<EdgeRenderer
					edge={bottomEdge}
					nodes={[source, target]}
					edges={[topEdge, bottomEdge]}
					selected={false}
					onSelect={noop}
					onDelete={noop}
				/>
			</svg>,
		);

		const visiblePaths = Array.from(
			container.querySelectorAll("path[marker-end]"),
		);
		expect(visiblePaths).toHaveLength(2);
		expect(visiblePaths[0].getAttribute("stroke")).toBe("rgb(34, 197, 94)");
		expect(visiblePaths[1].getAttribute("stroke")).toBe("rgb(239, 68, 68)");
	});

	it("colors the 'top'/'bottom' edges green/red for an ExternalLink source in challenge mode", () => {
		const source = createNode({
			id: "source",
			type: "ExternalLink",
			config: { mode: "challenge" },
			position: { x: 300, y: 100 },
		});
		const target = createNode({ id: "target", position: { x: 700, y: 150 } });
		const topEdge: WorkflowEdge = {
			id: "edge-top",
			from: "source",
			to: "target",
			fromPort: "top",
			label: null,
		};
		const bottomEdge: WorkflowEdge = {
			id: "edge-bottom",
			from: "source",
			to: "target",
			fromPort: "bottom",
			label: null,
		};

		const { container } = render(
			<svg>
				<EdgeRenderer
					edge={topEdge}
					nodes={[source, target]}
					edges={[topEdge, bottomEdge]}
					selected={false}
					onSelect={noop}
					onDelete={noop}
				/>
				<EdgeRenderer
					edge={bottomEdge}
					nodes={[source, target]}
					edges={[topEdge, bottomEdge]}
					selected={false}
					onSelect={noop}
					onDelete={noop}
				/>
			</svg>,
		);

		const visiblePaths = Array.from(
			container.querySelectorAll("path[marker-end]"),
		);
		expect(visiblePaths).toHaveLength(2);
		expect(visiblePaths[0].getAttribute("stroke")).toBe("rgb(34, 197, 94)");
		expect(visiblePaths[1].getAttribute("stroke")).toBe("rgb(239, 68, 68)");
	});

	it("does NOT apply dual green/red colors for an ExternalLink source NOT in challenge mode", () => {
		const source = createNode({
			id: "source",
			type: "ExternalLink",
			config: { mode: "form" },
			position: { x: 300, y: 100 },
		});
		const target = createNode({ id: "target", position: { x: 700, y: 150 } });
		const edge: WorkflowEdge = {
			id: "edge-1",
			from: "source",
			to: "target",
			label: null,
		};

		const { container } = render(
			<svg>
				<EdgeRenderer
					edge={edge}
					nodes={[source, target]}
					edges={[edge]}
					selected={false}
					onSelect={noop}
					onDelete={noop}
				/>
			</svg>,
		);

		const visiblePath = container.querySelector("path[marker-end]");
		expect(visiblePath?.getAttribute("stroke")).toBe("var(--muted-foreground)");
	});
});

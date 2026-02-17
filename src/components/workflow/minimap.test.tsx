import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import type { WorkflowNode } from "@/lib/workflow/types";
import { Minimap } from "./minimap";
import {
	getViewportWorldRect,
	getWorkflowBounds,
	getMinimapTransform,
} from "./minimap";

const createNode = (overrides: Partial<WorkflowNode>): WorkflowNode => ({
	id: "node-id",
	type: "Form",
	title: "Nodo",
	description: "",
	roles: [],
	config: {},
	staleTimeout: null,
	groupId: null,
	position: { x: 0, y: 0 },
	...overrides,
});

describe("getViewportWorldRect", () => {
	it("returns null when viewport has no size", () => {
		const result = getViewportWorldRect({
			pan: { x: 0, y: 0 },
			zoom: 1,
			viewportSize: { width: 0, height: 0 },
		});

		expect(result).toBeNull();
	});

	it("translates pan/zoom into world coordinates", () => {
		const result = getViewportWorldRect({
			pan: { x: 150, y: -300 },
			zoom: 1.5,
			viewportSize: { width: 900, height: 600 },
		});

		expect(result).toMatchObject({
			x: -100,
			y: 200,
			width: 600,
			height: 400,
		});
	});
});

describe("getWorkflowBounds", () => {
	it("encompasses nodes and viewport with padding", () => {
		const nodes = [
			createNode({
				id: "a",
				position: { x: 100, y: 120 },
				title: "Inicio",
			}),
			createNode({
				id: "b",
				position: { x: 820, y: 640 },
				title: "Formulario extendido",
				description: "Con descripción",
			}),
		];
		const viewportWorld = { x: -200, y: -100, width: 400, height: 320 };

		const bounds = getWorkflowBounds(nodes, viewportWorld);

		expect(bounds.minX).toBeLessThan(viewportWorld.x);
		expect(bounds.minY).toBeLessThan(viewportWorld.y);
		expect(bounds.maxX).toBeGreaterThan(nodes[1].position.x);
		expect(bounds.maxY).toBeGreaterThan(viewportWorld.y + viewportWorld.height);
	});
});

describe("getMinimapTransform", () => {
	it("maps bound extremes to the padded minimap space", () => {
		const bounds = { minX: -100, minY: -50, maxX: 900, maxY: 450 };

		const { scale, offsetX, offsetY } = getMinimapTransform({
			bounds,
			width: 220,
			height: 160,
			padding: 10,
		});

		const mappedMinX = bounds.minX * scale + offsetX;
		const mappedMinY = bounds.minY * scale + offsetY;
		const mappedMaxX = bounds.maxX * scale + offsetX;
		const mappedMaxY = bounds.maxY * scale + offsetY;

		expect(mappedMinX).toBeCloseTo(10);
		expect(mappedMinY).toBeCloseTo(10);
		expect(mappedMaxX).toBeCloseTo(210);
		expect(mappedMaxY).toBeLessThanOrEqual(150); // Limited by available height
	});
});

describe("Minimap", () => {
	it("renders minimap with nodes and edges", () => {
		const nodes = [
			createNode({ id: "n1", position: { x: 0, y: 0 }, title: "Node 1" }),
			createNode({ id: "n2", position: { x: 200, y: 100 }, title: "Node 2" }),
		];
		const edges = [{ id: "e1", from: "n1", to: "n2", label: null }];
		const { container } = render(
			<Minimap
				nodes={nodes}
				edges={edges}
				zoom={1}
				pan={{ x: 0, y: 0 }}
				viewportSize={{ width: 800, height: 600 }}
				onUpdatePan={vi.fn()}
			/>,
		);
		const svg = container.querySelector("svg");
		expect(svg).toBeInTheDocument();
		expect(container.querySelectorAll("rect").length).toBeGreaterThan(2); // nodes + viewport
		expect(container.querySelectorAll("line").length).toBe(1); // edge
	});

	it("returns null when nodes array is empty", () => {
		const { container } = render(
			<Minimap
				nodes={[]}
				edges={[]}
				zoom={1}
				pan={{ x: 0, y: 0 }}
				viewportSize={{ width: 800, height: 600 }}
				onUpdatePan={vi.fn()}
			/>,
		);
		expect(container.querySelector("svg")).not.toBeInTheDocument();
	});

	it("calls onUpdatePan when minimap is clicked", () => {
		const onUpdatePan = vi.fn();
		const nodes = [
			createNode({ id: "n1", position: { x: 100, y: 100 }, title: "Node" }),
		];
		const { container } = render(
			<Minimap
				nodes={nodes}
				edges={[]}
				zoom={1}
				pan={{ x: 0, y: 0 }}
				viewportSize={{ width: 800, height: 600 }}
				onUpdatePan={onUpdatePan}
			/>,
		);
		const minimapDiv = container.querySelector("div[style*='cursor']");
		expect(minimapDiv).toBeInTheDocument();
		fireEvent.pointerDown(minimapDiv!, { clientX: 50, clientY: 50 });
		expect(onUpdatePan).toHaveBeenCalled();
	});

	it("calls onUpdatePan on pointer move when pointer is down", () => {
		const onUpdatePan = vi.fn();
		const nodes = [
			createNode({ id: "n1", position: { x: 100, y: 100 }, title: "Node" }),
		];
		const { container } = render(
			<Minimap
				nodes={nodes}
				edges={[]}
				zoom={1}
				pan={{ x: 0, y: 0 }}
				viewportSize={{ width: 800, height: 600 }}
				onUpdatePan={onUpdatePan}
			/>,
		);
		const minimapDiv = container.querySelector("div[style*='cursor']")!;
		fireEvent.pointerDown(minimapDiv, { clientX: 50, clientY: 50 });
		fireEvent.pointerMove(minimapDiv, { clientX: 60, clientY: 60 });
		expect(onUpdatePan).toHaveBeenCalledTimes(2);
	});

	it("stops updating pan on pointer up", () => {
		const onUpdatePan = vi.fn();
		const nodes = [
			createNode({ id: "n1", position: { x: 100, y: 100 }, title: "Node" }),
		];
		const { container } = render(
			<Minimap
				nodes={nodes}
				edges={[]}
				zoom={1}
				pan={{ x: 0, y: 0 }}
				viewportSize={{ width: 800, height: 600 }}
				onUpdatePan={onUpdatePan}
			/>,
		);
		const minimapDiv = container.querySelector("div[style*='cursor']")!;
		fireEvent.pointerDown(minimapDiv, { clientX: 50, clientY: 50 });
		fireEvent.pointerUp(minimapDiv);
		onUpdatePan.mockClear();
		fireEvent.pointerMove(minimapDiv, { clientX: 70, clientY: 70 });
		expect(onUpdatePan).not.toHaveBeenCalled();
	});

	it("stops updating pan on pointer leave", () => {
		const onUpdatePan = vi.fn();
		const nodes = [
			createNode({ id: "n1", position: { x: 100, y: 100 }, title: "Node" }),
		];
		const { container } = render(
			<Minimap
				nodes={nodes}
				edges={[]}
				zoom={1}
				pan={{ x: 0, y: 0 }}
				viewportSize={{ width: 800, height: 600 }}
				onUpdatePan={onUpdatePan}
			/>,
		);
		const minimapDiv = container.querySelector("div[style*='cursor']")!;
		fireEvent.pointerDown(minimapDiv, { clientX: 50, clientY: 50 });
		fireEvent.pointerLeave(minimapDiv);
		onUpdatePan.mockClear();
		fireEvent.pointerMove(minimapDiv, { clientX: 80, clientY: 80 });
		expect(onUpdatePan).not.toHaveBeenCalled();
	});

	it("renders viewport indicator when viewportWorld is available", () => {
		const nodes = [
			createNode({ id: "n1", position: { x: 0, y: 0 }, title: "Node" }),
		];
		const { container } = render(
			<Minimap
				nodes={nodes}
				edges={[]}
				zoom={1}
				pan={{ x: 0, y: 0 }}
				viewportSize={{ width: 800, height: 600 }}
				onUpdatePan={vi.fn()}
			/>,
		);
		// Viewport indicator is a rect with stroke
		const rects = container.querySelectorAll("rect[stroke]");
		expect(rects.length).toBeGreaterThan(0);
	});

	it("renders checkpoint safe node with custom color", () => {
		const nodes = [
			createNode({
				id: "cp1",
				type: "Checkpoint",
				checkpointType: "safe",
				title: "Safe CP",
				position: { x: 0, y: 0 },
			}),
		];
		const { container } = render(
			<Minimap
				nodes={nodes}
				edges={[]}
				zoom={1}
				pan={{ x: 0, y: 0 }}
				viewportSize={{ width: 800, height: 600 }}
				onUpdatePan={vi.fn()}
			/>,
		);
		// Safe checkpoint gets special color
		const nodeRects = container.querySelectorAll("rect[fill]");
		expect(nodeRects.length).toBeGreaterThan(0);
	});

	it("does not update pan when viewportSize is zero", () => {
		const onUpdatePan = vi.fn();
		const nodes = [
			createNode({ id: "n1", position: { x: 100, y: 100 }, title: "Node" }),
		];
		const { container } = render(
			<Minimap
				nodes={nodes}
				edges={[]}
				zoom={1}
				pan={{ x: 0, y: 0 }}
				viewportSize={{ width: 0, height: 0 }}
				onUpdatePan={onUpdatePan}
			/>,
		);
		const minimapDiv = container.querySelector("div");
		if (minimapDiv) {
			fireEvent.pointerDown(minimapDiv, { clientX: 50, clientY: 50 });
		}
		expect(onUpdatePan).not.toHaveBeenCalled();
	});
});

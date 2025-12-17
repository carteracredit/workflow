import { describe, it, expect } from "vitest";
import type { WorkflowNode } from "@/lib/workflow/types";
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

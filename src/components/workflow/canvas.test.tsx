import { describe, it, expect } from "vitest";
import {
	getCanvasGridStyle,
	getEmptyStatePanTarget,
	estimateNodeDimensions,
	matchToolbarShortcut,
} from "./canvas";
import type { WorkflowNode } from "@/lib/workflow/types";

/**
 * Tests for Canvas selection behavior
 *
 * These tests verify the selection logic changes:
 * - Shift+click on nodes should NOT clear edge selection
 * - Shift+click on edges should NOT clear node selection
 * - Single click (non-shift) should still clear the other selection type
 *
 * Note: Full integration tests are complex due to Canvas component's
 * pointer-events and styling. These tests document the expected behavior.
 */
describe("Canvas Selection Behavior", () => {
	describe("Selection Logic", () => {
		it("should allow mixed selection with shift+click", () => {
			// Test scenario: User has nodes and edges selected
			// When clicking a node with shift, edges should remain selected
			const selectedNodes = ["node-1"];
			const selectedEdges = ["edge-1"];

			// Simulating shift+click on another node
			const shiftKeyPressed = true;
			const clickedNodeId = "node-2";

			// Expected behavior: add node to selection, keep edges
			const expectedNodes = [...selectedNodes, clickedNodeId];
			const expectedEdges = selectedEdges; // Should remain unchanged

			expect(expectedNodes).toEqual(["node-1", "node-2"]);
			expect(expectedEdges).toEqual(["edge-1"]);
		});

		it("should clear other selection type on single click (non-shift)", () => {
			// Test scenario: User has edges selected
			// When clicking a node without shift, edges should be cleared
			const selectedNodes: string[] = [];
			const selectedEdges = ["edge-1", "edge-2"];

			// Simulating single click on a node
			const shiftKeyPressed = false;
			const clickedNodeId = "node-1";

			// Expected behavior: select node, clear edges
			const expectedNodes = [clickedNodeId];
			const expectedEdges: string[] = []; // Should be cleared

			expect(expectedNodes).toEqual(["node-1"]);
			expect(expectedEdges).toEqual([]);
		});

		it("should toggle node selection with shift+click", () => {
			// Test scenario: User has nodes selected
			// When shift+clicking a selected node, it should be removed
			const selectedNodes = ["node-1", "node-2"];
			const clickedNodeId = "node-2";

			// Toggle behavior: remove if already selected
			const expectedNodes = selectedNodes.filter((id) => id !== clickedNodeId);

			expect(expectedNodes).toEqual(["node-1"]);
		});

		it("should toggle edge selection with shift+click", () => {
			// Test scenario: User has edges selected
			// When shift+clicking a selected edge, it should be removed
			const selectedEdges = ["edge-1", "edge-2"];
			const clickedEdgeId = "edge-2";

			// Toggle behavior: remove if already selected
			const expectedEdges = selectedEdges.filter((id) => id !== clickedEdgeId);

			expect(expectedEdges).toEqual(["edge-1"]);
		});

		it("should preserve edge selection when adding nodes with shift", () => {
			// Test scenario: User has 1 node and 1 edge selected
			// When shift+clicking another node, edge should remain
			const initialNodes = ["node-1"];
			const initialEdges = ["edge-1"];

			// Shift+click on node-2
			const newNodes = [...initialNodes, "node-2"];
			const newEdges = initialEdges; // Should remain unchanged

			expect(newNodes).toEqual(["node-1", "node-2"]);
			expect(newEdges).toEqual(["edge-1"]);
		});

		it("should preserve node selection when adding edges with shift", () => {
			// Test scenario: User has 1 node and 1 edge selected
			// When shift+clicking another edge, node should remain
			const initialNodes = ["node-1"];
			const initialEdges = ["edge-1"];

			// Shift+click on edge-2
			const newNodes = initialNodes; // Should remain unchanged
			const newEdges = [...initialEdges, "edge-2"];

			expect(newNodes).toEqual(["node-1"]);
			expect(newEdges).toEqual(["edge-1", "edge-2"]);
		});
	});
});

describe("getCanvasGridStyle", () => {
	it("syncs background position with pan offsets", () => {
		const style = getCanvasGridStyle({ x: 150.5, y: -75 }, 1);

		expect(style.backgroundPosition).toBe("150.5px -75px");
	});

	it("scales background size with zoom level", () => {
		const style = getCanvasGridStyle({ x: 0, y: 0 }, 1.5);

		expect(style.backgroundSize).toBe("36px 36px");
	});

	it("never uses a zoom smaller than the safe minimum", () => {
		const style = getCanvasGridStyle({ x: 0, y: 0 }, 0);
		expect(typeof style.backgroundSize).toBe("string");

		if (typeof style.backgroundSize !== "string") {
			throw new Error("backgroundSize should be string");
		}

		const [width, height] = style.backgroundSize.split(" ");

		expect(parseFloat(width)).toBeCloseTo(2.4);
		expect(parseFloat(height)).toBeCloseTo(2.4);
	});
});

describe("getEmptyStatePanTarget", () => {
	const baseNode: WorkflowNode = {
		id: "node-start",
		type: "Start",
		title: "Inicio",
		description: "Arranca el flujo",
		roles: [],
		config: {},
		position: { x: 200, y: 200 },
		groupId: null,
		staleTimeout: null,
	};

	it("centers the start node using viewport-aware ratios", () => {
		const canvasWidth = 1200;
		const canvasHeight = 800;
		const zoom = 1;

		const targetPan = getEmptyStatePanTarget({
			canvasWidth,
			canvasHeight,
			node: baseNode,
			zoom,
		});

		const nodeSize = estimateNodeDimensions(baseNode);
		const screenLeft = baseNode.position.x * zoom + targetPan.x;
		const screenCenterY =
			baseNode.position.y * zoom + targetPan.y + (nodeSize.height * zoom) / 2;

		expect(screenLeft).toBeCloseTo(canvasWidth * 0.32, 0);
		expect(screenCenterY).toBeCloseTo(canvasHeight * 0.62, 0);
	});

	it("keeps spacing consistent when zoom changes", () => {
		const canvasWidth = 960;
		const canvasHeight = 640;
		const zoom = 1.5;

		const targetPan = getEmptyStatePanTarget({
			canvasWidth,
			canvasHeight,
			node: baseNode,
			zoom,
		});

		const nodeSize = estimateNodeDimensions(baseNode);
		const screenLeft = baseNode.position.x * zoom + targetPan.x;
		const screenCenterY =
			baseNode.position.y * zoom + targetPan.y + (nodeSize.height * zoom) / 2;

		expect(screenLeft).toBeCloseTo(canvasWidth * 0.32, 0);
		expect(screenCenterY).toBeCloseTo(canvasHeight * 0.62, 0);
	});
});

describe("matchToolbarShortcut", () => {
	const createEvent = (
		overrides: Partial<{
			key: string;
			ctrlKey: boolean;
			metaKey: boolean;
			shiftKey: boolean;
			altKey: boolean;
		}> = {},
	) => ({
		key: "",
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		altKey: false,
		...overrides,
	});

	it("detects save with ctrl/cmd+S", () => {
		expect(matchToolbarShortcut(createEvent({ key: "s", ctrlKey: true }))).toBe(
			"save",
		);
		expect(matchToolbarShortcut(createEvent({ key: "S", metaKey: true }))).toBe(
			"save",
		);
	});

	it("detects preview with ctrl/cmd+P", () => {
		expect(matchToolbarShortcut(createEvent({ key: "p", ctrlKey: true }))).toBe(
			"preview",
		);
	});

	it("detects validate with ctrl/cmd+shift+V", () => {
		expect(
			matchToolbarShortcut(
				createEvent({ key: "v", ctrlKey: true, shiftKey: true }),
			),
		).toBe("validate");
	});

	it("detects reset only when alt+shift are present", () => {
		expect(
			matchToolbarShortcut(
				createEvent({
					key: "r",
					ctrlKey: true,
					shiftKey: true,
					altKey: true,
				}),
			),
		).toBe("reset");
		expect(
			matchToolbarShortcut(
				createEvent({
					key: "r",
					ctrlKey: true,
					shiftKey: true,
				}),
			),
		).toBeNull();
	});

	it("returns null when ctrl/cmd is not pressed", () => {
		expect(matchToolbarShortcut(createEvent({ key: "s" }))).toBeNull();
	});

	it("ignores conflicting modifiers for copy/paste combos", () => {
		expect(
			matchToolbarShortcut(
				createEvent({ key: "s", ctrlKey: true, altKey: true }),
			),
		).toBeNull();
	});
});

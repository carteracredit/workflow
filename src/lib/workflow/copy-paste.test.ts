import { describe, it, expect } from "vitest";
import {
	serializeSelection,
	deserializeSelection,
	calculatePasteOffset,
	type CopiedSelection,
} from "./copy-paste";
import type { WorkflowNode, WorkflowEdge } from "./types";

describe("copy-paste", () => {
	describe("serializeSelection", () => {
		it("should return null for empty selection", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const result = serializeSelection([], [], nodes, edges);
			expect(result).toBeNull();
		});

		it("should filter out Start nodes from selection", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start-1",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "form-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const result = serializeSelection(
				["start-1", "form-1"],
				[],
				nodes,
				edges,
			);
			expect(result).not.toBeNull();
			expect(result?.nodes).toHaveLength(1);
			expect(result?.nodes[0].id).toBe("form-1");
			expect(result?.nodes[0].type).toBe("Form");
		});

		it("should include only edges where both nodes are selected", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "node-2",
					type: "Decision",
					title: "Decision 1",
					description: "",
					roles: [],
					config: { condition: "true" },
					position: { x: 200, y: 0 },
					groupId: null,
				},
				{
					id: "node-3",
					type: "End",
					title: "End",
					description: "",
					roles: [],
					config: {},
					position: { x: 400, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{
					id: "edge-1",
					from: "node-1",
					to: "node-2",
					label: null,
				},
				{
					id: "edge-2",
					from: "node-2",
					to: "node-3",
					label: null,
				},
			];

			// Select only node-1 and node-2
			const result = serializeSelection(["node-1", "node-2"], [], nodes, edges);
			expect(result).not.toBeNull();
			expect(result?.nodes).toHaveLength(2);
			expect(result?.edges).toHaveLength(1);
			expect(result?.edges[0].id).toBe("edge-1");
		});

		it("should include explicitly selected edges if both nodes are selected", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "node-2",
					type: "Decision",
					title: "Decision 1",
					description: "",
					roles: [],
					config: { condition: "true" },
					position: { x: 200, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{
					id: "edge-1",
					from: "node-1",
					to: "node-2",
					label: null,
				},
			];

			const result = serializeSelection(
				["node-1", "node-2"],
				["edge-1"],
				nodes,
				edges,
			);
			expect(result).not.toBeNull();
			expect(result?.edges).toHaveLength(1);
			expect(result?.edges[0].id).toBe("edge-1");
		});

		it("should not include edges where one node is not selected", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "node-2",
					type: "Decision",
					title: "Decision 1",
					description: "",
					roles: [],
					config: { condition: "true" },
					position: { x: 200, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{
					id: "edge-1",
					from: "node-1",
					to: "node-2",
					label: null,
				},
			];

			// Select only node-1
			const result = serializeSelection(["node-1"], [], nodes, edges);
			expect(result).not.toBeNull();
			expect(result?.nodes).toHaveLength(1);
			expect(result?.edges).toHaveLength(0);
		});
	});

	describe("deserializeSelection", () => {
		it("should regenerate IDs for nodes and edges", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "node-1",
						type: "Form",
						title: "Form 1",
						description: "",
						roles: [],
						config: {},
						position: { x: 0, y: 0 },
						groupId: null,
					},
				],
				edges: [],
			};

			const result = deserializeSelection(copiedSelection, []);
			expect(result.nodes).toHaveLength(1);
			expect(result.nodes[0].id).not.toBe("node-1");
			expect(result.nodes[0].id).toMatch(/^node-\d+-\d+$/);
		});

		it("should update edge references to new node IDs", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "node-1",
						type: "Form",
						title: "Form 1",
						description: "",
						roles: [],
						config: {},
						position: { x: 0, y: 0 },
						groupId: null,
					},
					{
						id: "node-2",
						type: "Decision",
						title: "Decision 1",
						description: "",
						roles: [],
						config: { condition: "true" },
						position: { x: 200, y: 0 },
						groupId: null,
					},
				],
				edges: [
					{
						id: "edge-1",
						from: "node-1",
						to: "node-2",
						label: null,
					},
				],
			};

			const result = deserializeSelection(copiedSelection, []);
			expect(result.nodes).toHaveLength(2);
			expect(result.edges).toHaveLength(1);

			const newFromId = result.nodes[0].id;
			const newToId = result.nodes[1].id;
			expect(result.edges[0].from).toBe(newFromId);
			expect(result.edges[0].to).toBe(newToId);
			expect(result.edges[0].id).not.toBe("edge-1");
		});

		it("should apply offset to node positions", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "node-1",
						type: "Form",
						title: "Form 1",
						description: "",
						roles: [],
						config: {},
						position: { x: 100, y: 200 },
						groupId: null,
					},
				],
				edges: [],
			};

			const result = deserializeSelection(copiedSelection, []);
			expect(result.nodes[0].position.x).toBe(150); // 100 + 50 offset
			expect(result.nodes[0].position.y).toBe(250); // 200 + 50 offset
		});

		it("should use custom offset if provided", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "node-1",
						type: "Form",
						title: "Form 1",
						description: "",
						roles: [],
						config: {},
						position: { x: 100, y: 200 },
						groupId: null,
					},
				],
				edges: [],
			};

			const customOffset = { x: 100, y: 150 };
			const result = deserializeSelection(copiedSelection, [], customOffset);
			expect(result.nodes[0].position.x).toBe(200); // 100 + 100 offset
			expect(result.nodes[0].position.y).toBe(350); // 200 + 150 offset
		});

		it("should resolve API node checkpoint dependency", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "api-1",
						type: "API",
						title: "API Call",
						description: "",
						roles: [],
						config: {
							failureHandling: {
								onFailure: "return-to-checkpoint",
								maxRetries: 0,
								retryCount: 0,
								cacheStrategy: "always-execute",
								timeout: 30000,
								checkpointId: "checkpoint-1", // Referenced checkpoint not in selection
							},
						},
						position: { x: 0, y: 0 },
						groupId: null,
					},
				],
				edges: [],
			};

			const result = deserializeSelection(copiedSelection, []);
			expect(result.nodes).toHaveLength(1);
			const failureHandling = result.nodes[0].config.failureHandling as any;
			expect(failureHandling.onFailure).toBe("stop");
			expect(failureHandling.checkpointId).toBeUndefined();
		});

		it("should preserve API node checkpoint if checkpoint is in selection", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "checkpoint-1",
						type: "Checkpoint",
						title: "Checkpoint",
						description: "",
						roles: [],
						config: {},
						position: { x: 0, y: 0 },
						groupId: null,
					},
					{
						id: "api-1",
						type: "API",
						title: "API Call",
						description: "",
						roles: [],
						config: {
							failureHandling: {
								onFailure: "return-to-checkpoint",
								maxRetries: 0,
								retryCount: 0,
								cacheStrategy: "always-execute",
								timeout: 30000,
								checkpointId: "checkpoint-1",
							},
						},
						position: { x: 200, y: 0 },
						groupId: null,
					},
				],
				edges: [],
			};

			const result = deserializeSelection(copiedSelection, []);
			expect(result.nodes).toHaveLength(2);

			// Find the API node after ID regeneration
			const apiNode = result.nodes.find((n) => n.type === "API");
			const checkpointNode = result.nodes.find((n) => n.type === "Checkpoint");

			expect(apiNode).toBeDefined();
			expect(checkpointNode).toBeDefined();

			const failureHandling = apiNode?.config.failureHandling as any;
			expect(failureHandling.onFailure).toBe("return-to-checkpoint");
			// The checkpointId should be updated to the new checkpoint ID
			expect(failureHandling.checkpointId).toBe(checkpointNode?.id);
		});

		it("should disable allowRetry for Reject node if checkpoint not in selection", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "reject-1",
						type: "Reject",
						title: "Reject",
						description: "",
						roles: [],
						config: {
							allowRetry: true,
							maxRetries: 1,
						},
						position: { x: 0, y: 0 },
						groupId: null,
					},
				],
				edges: [],
			};

			const result = deserializeSelection(copiedSelection, []);
			expect(result.nodes).toHaveLength(1);
			expect(result.nodes[0].config.allowRetry).toBe(false);
		});

		it("should preserve allowRetry for Reject node if checkpoint edge exists", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "checkpoint-1",
						type: "Checkpoint",
						title: "Checkpoint",
						description: "",
						roles: [],
						config: {},
						position: { x: 0, y: 0 },
						groupId: null,
					},
					{
						id: "reject-1",
						type: "Reject",
						title: "Reject",
						description: "",
						roles: [],
						config: {
							allowRetry: true,
							maxRetries: 1,
						},
						position: { x: 200, y: 0 },
						groupId: null,
					},
				],
				edges: [
					{
						id: "edge-1",
						from: "reject-1",
						to: "checkpoint-1",
						label: "Reintento",
						color: "rgb(234, 179, 8)",
						thickness: 3,
					},
				],
			};

			const result = deserializeSelection(copiedSelection, []);
			expect(result.nodes).toHaveLength(2);
			const rejectNode = result.nodes.find((n) => n.type === "Reject");
			expect(rejectNode?.config.allowRetry).toBe(true);
			expect(result.edges).toHaveLength(1);
		});

		it("should filter out retry edges when allowRetry is disabled", () => {
			const copiedSelection: CopiedSelection = {
				nodes: [
					{
						id: "reject-1",
						type: "Reject",
						title: "Reject",
						description: "",
						roles: [],
						config: {
							allowRetry: true,
							maxRetries: 1,
						},
						position: { x: 0, y: 0 },
						groupId: null,
					},
				],
				edges: [
					{
						id: "edge-1",
						from: "reject-1",
						to: "external-checkpoint", // External checkpoint not in selection
						label: "Reintento",
						color: "rgb(234, 179, 8)",
						thickness: 3,
					},
				],
			};

			const result = deserializeSelection(copiedSelection, []);
			expect(result.nodes).toHaveLength(1);
			expect(result.nodes[0].config.allowRetry).toBe(false);
			// The retry edge should be filtered out
			expect(result.edges).toHaveLength(0);
		});
	});

	describe("calculatePasteOffset", () => {
		it("should return default offset for empty copied nodes", () => {
			const offset = calculatePasteOffset([], []);
			expect(offset.x).toBe(50);
			expect(offset.y).toBe(50);
		});

		it("should return default offset when no overlap", () => {
			const existingNodes: WorkflowNode[] = [
				{
					id: "node-1",
					type: "Form",
					title: "Form",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];
			const copiedNodes: WorkflowNode[] = [
				{
					id: "node-2",
					type: "Decision",
					title: "Decision",
					description: "",
					roles: [],
					config: {},
					position: { x: 500, y: 500 },
					groupId: null,
				},
			];

			const offset = calculatePasteOffset(existingNodes, copiedNodes);
			expect(offset.x).toBe(50);
			expect(offset.y).toBe(50);
		});

		it("should return larger offset when overlap detected", () => {
			const existingNodes: WorkflowNode[] = [
				{
					id: "node-1",
					type: "Form",
					title: "Form",
					description: "",
					roles: [],
					config: {},
					position: { x: 60, y: 60 }, // Would overlap with default offset
					groupId: null,
				},
			];
			const copiedNodes: WorkflowNode[] = [
				{
					id: "node-2",
					type: "Decision",
					title: "Decision",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];

			const offset = calculatePasteOffset(existingNodes, copiedNodes);
			expect(offset.x).toBeGreaterThan(50);
			expect(offset.y).toBeGreaterThan(50);
		});
	});
});

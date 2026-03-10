import { describe, it, expect } from "vitest";
import {
	findNearestPreviousCheckpoint,
	findAllNearestPreviousCheckpoints,
	getCheckpointNode,
	findUpstreamNodes,
	buildVariableSourceNodes,
} from "./graph-utils";
import type { WorkflowNode, WorkflowEdge } from "./types";

describe("graph-utils", () => {
	describe("findNearestPreviousCheckpoint", () => {
		it("should find checkpoint directly connected", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "checkpoint-1",
					type: "Checkpoint",
					title: "Checkpoint 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "checkpoint-1", to: "node-1", label: null },
			];

			const result = findNearestPreviousCheckpoint("node-1", nodes, edges);
			expect(result).toBe("checkpoint-1");
		});

		it("should find checkpoint through intermediate nodes", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "checkpoint-1",
					type: "Checkpoint",
					title: "Checkpoint 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
				{
					id: "node-2",
					type: "Decision",
					title: "Decision 1",
					description: "",
					roles: [],
					config: { condition: "test" },
					position: { x: 200, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "checkpoint-1", to: "node-1", label: null },
				{ id: "edge-2", from: "node-1", to: "node-2", label: null },
			];

			const result = findNearestPreviousCheckpoint("node-2", nodes, edges);
			expect(result).toBe("checkpoint-1");
		});

		it("should return null when no checkpoint exists", () => {
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
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "start-1", to: "node-1", label: null },
			];

			const result = findNearestPreviousCheckpoint("node-1", nodes, edges);
			expect(result).toBeNull();
		});

		it("should stop at Start node", () => {
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
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "start-1", to: "node-1", label: null },
			];

			const result = findNearestPreviousCheckpoint("node-1", nodes, edges);
			expect(result).toBeNull();
		});

		it("should handle cycles gracefully", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "checkpoint-1",
					type: "Checkpoint",
					title: "Checkpoint 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "checkpoint-1", to: "node-1", label: null },
				{ id: "edge-2", from: "node-1", to: "checkpoint-1", label: null },
			];

			const result = findNearestPreviousCheckpoint("node-1", nodes, edges);
			expect(result).toBe("checkpoint-1");
		});
	});

	describe("findAllNearestPreviousCheckpoints", () => {
		it("should find single checkpoint", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "checkpoint-1",
					type: "Checkpoint",
					title: "Checkpoint 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "checkpoint-1", to: "node-1", label: null },
			];

			const result = findAllNearestPreviousCheckpoints("node-1", nodes, edges);
			expect(result).toEqual(["checkpoint-1"]);
		});

		it("should find multiple checkpoints at same distance", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "checkpoint-1",
					type: "Checkpoint",
					title: "Checkpoint 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
				{
					id: "checkpoint-2",
					type: "Checkpoint",
					title: "Checkpoint 2",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 100 },
					groupId: null,
				},
				{
					id: "join-1",
					type: "Join",
					title: "Join 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 50 },
					groupId: null,
				},
				{
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 200, y: 50 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "checkpoint-1", to: "join-1", label: null },
				{ id: "edge-2", from: "checkpoint-2", to: "join-1", label: null },
				{ id: "edge-3", from: "join-1", to: "node-1", label: null },
			];

			const result = findAllNearestPreviousCheckpoints("node-1", nodes, edges);
			expect(result).toContain("checkpoint-1");
			expect(result).toContain("checkpoint-2");
			expect(result.length).toBe(2);
		});

		it("should return empty array when no checkpoint exists", () => {
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
					id: "node-1",
					type: "Form",
					title: "Form 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "start-1", to: "node-1", label: null },
			];

			const result = findAllNearestPreviousCheckpoints("node-1", nodes, edges);
			expect(result).toEqual([]);
		});
	});

	describe("findUpstreamNodes", () => {
		it("should return all upstream nodes excluding the target node itself", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start",
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
				{
					id: "api-1",
					type: "API",
					title: "API 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 200, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "e1", from: "start", to: "form-1", label: null },
				{ id: "e2", from: "form-1", to: "api-1", label: null },
			];

			const result = findUpstreamNodes("api-1", nodes, edges);
			const ids = result.map((n) => n.id);
			expect(ids).toContain("start");
			expect(ids).toContain("form-1");
			expect(ids).not.toContain("api-1");
		});

		it("should return empty array for start node", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "start",
					type: "Start",
					title: "Start",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];
			const result = findUpstreamNodes("start", nodes, []);
			expect(result).toEqual([]);
		});

		it("should handle disconnected upstream (no incoming edges)", () => {
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
			const result = findUpstreamNodes("node-1", nodes, []);
			expect(result).toEqual([]);
		});
	});

	describe("buildVariableSourceNodes", () => {
		it("should skip nodes without outputSchema", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "api-1",
					type: "API",
					title: "My API",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];
			const result = buildVariableSourceNodes(nodes);
			expect(result).toEqual([]);
		});

		it("should convert a flat outputSchema to VariableSourceNode", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "api-1",
					type: "API",
					title: "My API",
					description: "",
					roles: [],
					config: {
						outputSchema: {
							name: "APIOutput",
							properties: [
								{ id: "p1", name: "status", type: "number" },
								{ id: "p2", name: "message", type: "string" },
							],
						},
					},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];

			const result = buildVariableSourceNodes(nodes);
			expect(result).toHaveLength(1);
			expect(result[0].id).toBe("api-1");
			expect(result[0].name).toBe("My API");
			expect(result[0].variables).toHaveLength(2);

			const status = result[0].variables.find((v) => v.name === "status");
			expect(status?.type).toBe("number");
			expect(status?.path).toBe("api-1.status");

			const message = result[0].variables.find((v) => v.name === "message");
			expect(message?.type).toBe("string");
			expect(message?.path).toBe("api-1.message");
		});

		it("should convert nested object properties", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "api-1",
					type: "API",
					title: "My API",
					description: "",
					roles: [],
					config: {
						outputSchema: {
							name: "APIOutput",
							properties: [
								{
									id: "p1",
									name: "data",
									type: "object",
									properties: [
										{ id: "p1a", name: "id", type: "number" },
										{ id: "p1b", name: "name", type: "string" },
									],
								},
							],
						},
					},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];

			const result = buildVariableSourceNodes(nodes);
			expect(result).toHaveLength(1);

			const dataVar = result[0].variables.find((v) => v.name === "data");
			expect(dataVar?.type).toBe("object");
			expect(dataVar?.children).toHaveLength(2);
			expect(dataVar?.children?.[0].path).toBe("api-1.data.id");
		});

		it("should map enum type to string for variable picker", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "api-1",
					type: "API",
					title: "My API",
					description: "",
					roles: [],
					config: {
						outputSchema: {
							name: "APIOutput",
							properties: [
								{
									id: "p1",
									name: "status",
									type: "enum",
									enumValues: ["ACTIVE", "INACTIVE"],
								},
							],
						},
					},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];

			const result = buildVariableSourceNodes(nodes);
			const statusVar = result[0].variables.find((v) => v.name === "status");
			expect(statusVar?.type).toBe("string");
		});
	});

	describe("getCheckpointNode", () => {
		it("should return checkpoint node when found", () => {
			const nodes: WorkflowNode[] = [
				{
					id: "checkpoint-1",
					type: "Checkpoint",
					title: "Checkpoint 1",
					description: "",
					roles: [],
					config: {},
					position: { x: 0, y: 0 },
					groupId: null,
				},
			];

			const result = getCheckpointNode("checkpoint-1", nodes);
			expect(result).not.toBeNull();
			expect(result?.id).toBe("checkpoint-1");
			expect(result?.type).toBe("Checkpoint");
		});

		it("should return null when checkpoint not found", () => {
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

			const result = getCheckpointNode("checkpoint-1", nodes);
			expect(result).toBeNull();
		});

		it("should return null when id is null", () => {
			const nodes: WorkflowNode[] = [];
			const result = getCheckpointNode(null, nodes);
			expect(result).toBeNull();
		});

		it("should return null when node exists but is not a checkpoint", () => {
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

			const result = getCheckpointNode("node-1", nodes);
			expect(result).toBeNull();
		});
	});
});

import { describe, it, expect } from "vitest";
import {
	findNearestPreviousCheckpoint,
	findAllNearestPreviousCheckpoints,
	getCheckpointNode,
	type WorkflowNode,
	type WorkflowEdge,
} from "./graph-utils";

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

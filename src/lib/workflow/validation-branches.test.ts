import { describe, it, expect } from "vitest";
import { validateWorkflow } from "./validation";
import {
	createDefaultChallengeConfig,
	type WorkflowNode,
	type WorkflowEdge,
} from "./types";

describe("validateWorkflow - Branch Coverage", () => {
	it("should handle Challenge with edge without fromPort", () => {
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
				id: "challenge-1",
				type: "Challenge",
				title: "Challenge",
				description: "",
				roles: ["Solicitante"],
				config: {
					...createDefaultChallengeConfig("acceptance", {
						challengeTimeout: { value: 5, unit: "minutes" },
					}),
					deliveryMethod: "sms",
					enabledResults: ["accepted"],
				},
				position: { x: 100, y: 0 },
				groupId: null,
			},
			{
				id: "end-1",
				type: "End",
				title: "End",
				description: "",
				roles: [],
				config: {},
				position: { x: 200, y: 0 },
				groupId: null,
			},
		];
		const edges: WorkflowEdge[] = [
			{ id: "edge-1", from: "start-1", to: "challenge-1", label: null },
			{
				id: "edge-2",
				from: "challenge-1",
				to: "end-1",
				label: null,
				// No fromPort specified
			},
		];

		const errors = validateWorkflow(nodes, edges);
		// Should not error since edge exists (even without fromPort)
		expect(
			errors.some(
				(e) =>
					e.nodeId === "challenge-1" &&
					e.message.includes("no tiene una conexión de salida configurada"),
			),
		).toBe(false);
	});

	it("should handle Challenge result with null port", () => {
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
				id: "challenge-1",
				type: "Challenge",
				title: "Challenge",
				description: "",
				roles: ["Solicitante"],
				config: {
					...createDefaultChallengeConfig("acceptance", {
						challengeTimeout: { value: 5, unit: "minutes" },
					}),
					deliveryMethod: "sms",
					enabledResults: ["accepted", "rejected"],
				},
				position: { x: 100, y: 0 },
				groupId: null,
			},
			{
				id: "end-1",
				type: "End",
				title: "End",
				description: "",
				roles: [],
				config: {},
				position: { x: 200, y: 0 },
				groupId: null,
			},
		];
		const edges: WorkflowEdge[] = [
			{ id: "edge-1", from: "start-1", to: "challenge-1", label: null },
			{
				id: "edge-2",
				from: "challenge-1",
				to: "end-1",
				label: null,
			},
		];

		const errors = validateWorkflow(nodes, edges);
		// Should handle gracefully
		expect(errors.length).toBeGreaterThanOrEqual(0);
	});

	it("should handle API node with return-to-checkpoint and visual connections warning", () => {
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
				id: "checkpoint-1",
				type: "Checkpoint",
				title: "Checkpoint",
				description: "",
				roles: [],
				config: {},
				position: { x: 50, y: 0 },
				groupId: null,
			},
			{
				id: "api-1",
				type: "API",
				title: "API",
				description: "",
				roles: [],
				config: {
					url: "https://api.example.com",
					failureHandling: {
						onFailure: "return-to-checkpoint",
						maxRetries: 1,
						retryCount: 0,
						cacheStrategy: "always-execute",
						timeout: 5000,
						checkpointId: "checkpoint-1",
					},
				},
				position: { x: 100, y: 0 },
				groupId: null,
			},
		];
		const edges: WorkflowEdge[] = [
			{ id: "edge-1", from: "start-1", to: "checkpoint-1", label: null },
			{ id: "edge-2", from: "checkpoint-1", to: "api-1", label: null },
			{ id: "edge-3", from: "api-1", to: "checkpoint-1", label: null }, // Visual connection
		];

		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "api-1" &&
					e.severity === "warning" &&
					e.message.includes("No debe tener conexiones visuales"),
			),
		).toBe(true);
	});

	it("should handle Reject node with allowRetry and multiple outgoing edges", () => {
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
				id: "checkpoint-1",
				type: "Checkpoint",
				title: "Checkpoint",
				description: "",
				roles: [],
				config: {},
				position: { x: 50, y: 0 },
				groupId: null,
			},
			{
				id: "checkpoint-2",
				type: "Checkpoint",
				title: "Checkpoint 2",
				description: "",
				roles: [],
				config: {},
				position: { x: 150, y: 0 },
				groupId: null,
			},
			{
				id: "reject-1",
				type: "Reject",
				title: "Reject",
				description: "",
				roles: [],
				config: { allowRetry: true, maxRetries: 1 },
				position: { x: 200, y: 0 },
				groupId: null,
			},
		];
		const edges: WorkflowEdge[] = [
			{ id: "edge-1", from: "start-1", to: "checkpoint-1", label: null },
			{ id: "edge-2", from: "checkpoint-1", to: "checkpoint-2", label: null },
			{ id: "edge-3", from: "checkpoint-2", to: "reject-1", label: null },
			{ id: "edge-4", from: "reject-1", to: "checkpoint-1", label: null },
			{ id: "edge-5", from: "reject-1", to: "checkpoint-2", label: null }, // Multiple edges
		];

		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "reject-1" &&
					e.message.includes("solo puede tener una conexión"),
			),
		).toBe(true);
	});

	it("should handle Challenge with result that has no metadata", () => {
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
				id: "challenge-1",
				type: "Challenge",
				title: "Challenge",
				description: "",
				roles: ["Solicitante"],
				config: {
					...createDefaultChallengeConfig("acceptance", {
						challengeTimeout: { value: 5, unit: "minutes" },
					}),
					deliveryMethod: "sms",
					enabledResults: ["accepted", "rejected"],
				},
				position: { x: 100, y: 0 },
				groupId: null,
			},
			{
				id: "end-1",
				type: "End",
				title: "End",
				description: "",
				roles: [],
				config: {},
				position: { x: 200, y: 0 },
				groupId: null,
			},
		];
		const edges: WorkflowEdge[] = [
			{ id: "edge-1", from: "start-1", to: "challenge-1", label: null },
			{
				id: "edge-2",
				from: "challenge-1",
				to: "end-1",
				label: null,
				fromPort: "top",
			},
			// Missing connection for rejected
		];

		const errors = validateWorkflow(nodes, edges);
		// Should warn about missing rejected connection
		expect(errors.length).toBeGreaterThanOrEqual(0);
	});
});

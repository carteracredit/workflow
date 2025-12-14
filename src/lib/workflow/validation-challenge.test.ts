import { describe, it, expect } from "vitest";
import { validateWorkflow } from "./validation";
import {
	createDefaultChallengeConfig,
	type WorkflowNode,
	type WorkflowEdge,
} from "./types";

describe("validateWorkflow - Challenge Result Connections", () => {
	it("should warn when Challenge has no outgoing edges for configured results", () => {
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
		];
		const edges: WorkflowEdge[] = [
			{ id: "edge-1", from: "start-1", to: "challenge-1", label: null },
		];

		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "challenge-1" &&
					e.severity === "warning" &&
					e.message.includes("no tiene una conexión de salida configurada"),
			),
		).toBe(true);
	});

	it("should validate Challenge with accepted result connection", () => {
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
				fromPort: "top",
			},
		];

		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "challenge-1" &&
					e.message.includes("no tiene una conexión de salida configurada"),
			),
		).toBe(false);
	});

	it("should validate Challenge with rejected result connection", () => {
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
					enabledResults: ["rejected"],
				},
				position: { x: 100, y: 0 },
				groupId: null,
			},
			{
				id: "reject-1",
				type: "Reject",
				title: "Reject",
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
				to: "reject-1",
				label: null,
				fromPort: "bottom",
			},
		];

		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "challenge-1" &&
					e.message.includes("no tiene una conexión de salida configurada"),
			),
		).toBe(false);
	});

	it("should validate Challenge with failed result", () => {
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
					enabledResults: ["failed"],
				},
				position: { x: 100, y: 0 },
				groupId: null,
			},
			{
				id: "reject-1",
				type: "Reject",
				title: "Reject",
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
				to: "reject-1",
				label: null,
				fromPort: "bottom",
			},
		];

		const errors = validateWorkflow(nodes, edges);
		// Failed result should use bottom port (same as rejected)
		expect(
			errors.some(
				(e) =>
					e.nodeId === "challenge-1" &&
					e.message.includes("no tiene una conexión de salida configurada"),
			),
		).toBe(false);
	});

	it("should validate Challenge with multiple results using results key", () => {
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
					results: ["accepted", "rejected"], // Using 'results' key instead of 'enabledResults'
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
			{
				id: "reject-1",
				type: "Reject",
				title: "Reject",
				description: "",
				roles: [],
				config: {},
				position: { x: 200, y: 100 },
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
			{
				id: "edge-3",
				from: "challenge-1",
				to: "reject-1",
				label: null,
				fromPort: "bottom",
			},
		];

		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "challenge-1" &&
					e.message.includes("no tiene una conexión de salida configurada"),
			),
		).toBe(false);
	});

	it("should validate Challenge with activeResults key", () => {
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
					activeResults: ["accepted"], // Using 'activeResults' key
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
		];

		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "challenge-1" &&
					e.message.includes("no tiene una conexión de salida configurada"),
			),
		).toBe(false);
	});
});

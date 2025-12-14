import { describe, it, expect } from "vitest";
import { validateWorkflow } from "./validation";
import {
	createDefaultChallengeConfig,
	type WorkflowNode,
	type WorkflowEdge,
} from "./types";

describe("validateWorkflow - Extended", () => {
	describe("API node failure handling validation", () => {
		it("should error when API node has negative maxRetries", () => {
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
					id: "api-1",
					type: "API",
					title: "API",
					description: "",
					roles: [],
					config: {
						url: "https://api.example.com",
						failureHandling: {
							onFailure: "retry",
							maxRetries: -1,
							retryCount: 0,
							cacheStrategy: "always-execute",
							timeout: 5000,
						},
					},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "api-1" &&
						e.message.includes("número de reintentos no puede ser negativo"),
				),
			).toBe(true);
		});

		it("should error when API node with return-to-checkpoint has no checkpoint", () => {
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
						},
					},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "start-1", to: "api-1", label: null },
			];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "api-1" &&
						e.message.includes("checkpoint anterior para regresar"),
				),
			).toBe(true);
		});

		it("should warn when API node timeout is out of range", () => {
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
					id: "api-1",
					type: "API",
					title: "API",
					description: "",
					roles: [],
					config: {
						url: "https://api.example.com",
						failureHandling: {
							onFailure: "continue",
							maxRetries: 0,
							retryCount: 0,
							cacheStrategy: "always-execute",
							timeout: 4000, // Less than 5000
						},
					},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "api-1" &&
						e.severity === "warning" &&
						e.message.includes("timeout debe estar entre 5 y 300 segundos"),
				),
			).toBe(true);
		});

		it("should error when API node with return-to-checkpoint has wrong checkpointId", () => {
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
					title: "Checkpoint 1",
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
							checkpointId: "wrong-checkpoint",
						},
					},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "start-1", to: "checkpoint-1", label: null },
				{ id: "edge-2", from: "checkpoint-1", to: "api-1", label: null },
			];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "api-1" &&
						e.severity === "warning" &&
						e.message.includes("checkpoint configurado no es el más próximo"),
				),
			).toBe(true);
		});
	});

	describe("Challenge node retry validation", () => {
		it("should error when Challenge retry maxRetries is out of range", () => {
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
						retries: {
							maxRetries: 10, // Exceeds MAX_CHALLENGE_RETRIES (5)
							roles: ["Admin"],
						},
					},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "challenge-1" &&
						e.message.includes("número de reintentos debe estar entre 1 y"),
				),
			).toBe(true);
		});

		it("should error when Challenge retry has no roles", () => {
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
						retries: {
							maxRetries: 2,
							roles: [],
						},
					},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "challenge-1" &&
						e.message.includes("Selecciona al menos un rol responsable"),
				),
			).toBe(true);
		});

		it("should error when Challenge retry has invalid roles", () => {
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
						retries: {
							maxRetries: 2,
							roles: [""], // Empty string
						},
					},
					position: { x: 100, y: 0 },
					groupId: null,
				},
			];
			const edges: WorkflowEdge[] = [];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "challenge-1" &&
						e.message.includes("Los roles de reintento deben ser válidos"),
				),
			).toBe(true);
		});
	});

	describe("Reject node retry validation", () => {
		it("should error when Reject with allowRetry connects to wrong checkpoint", () => {
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
					title: "Checkpoint 1",
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
				{ id: "edge-4", from: "reject-1", to: "checkpoint-1", label: null }, // Should connect to checkpoint-2
			];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "reject-1" &&
						e.message.includes(
							"debe conectarse al checkpoint anterior más próximo",
						),
				),
			).toBe(true);
		});

		it("should error when Reject with allowRetry connects to non-checkpoint", () => {
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
					title: "Form",
					description: "",
					roles: ["Solicitante"],
					config: { formId: "form-1" },
					position: { x: 100, y: 0 },
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
				{ id: "edge-1", from: "start-1", to: "form-1", label: null },
				{ id: "edge-2", from: "form-1", to: "reject-1", label: null },
				{ id: "edge-3", from: "reject-1", to: "form-1", label: null },
			];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "reject-1" &&
						e.message.includes("solo puede conectarse a un checkpoint"),
				),
			).toBe(true);
		});
	});

	describe("StaleTimeout validation", () => {
		it("should warn when node with staleTimeout has no safe checkpoint ahead", () => {
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
					title: "Form",
					description: "",
					roles: ["Solicitante"],
					config: { formId: "form-1" },
					position: { x: 100, y: 0 },
					groupId: null,
					staleTimeout: { value: 1, unit: "hours" },
				},
			];
			const edges: WorkflowEdge[] = [
				{ id: "edge-1", from: "start-1", to: "form-1", label: null },
			];

			const errors = validateWorkflow(nodes, edges);
			expect(
				errors.some(
					(e) =>
						e.nodeId === "form-1" &&
						e.severity === "warning" &&
						e.message.includes("staleTimeout"),
				),
			).toBe(true);
		});
	});
});

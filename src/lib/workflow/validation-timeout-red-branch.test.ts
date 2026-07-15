import { describe, it, expect } from "vitest";
import { validateWorkflow } from "./validation";
import {
	createDefaultChallengeConfig,
	type WorkflowNode,
	type WorkflowEdge,
} from "./types";

/**
 * Un `challengeTimeout` vencido se normaliza al mismo camino que el
 * resultado "rejected"/"failed" (rama roja/bottom port) — ver
 * `waitForEventDurable` en code-generator.ts. Si esa rama no está
 * conectada, la instancia se queda sin ruta a seguir cuando se cumple el
 * tiempo límite. Estas pruebas cubren la advertencia dedicada que avisa de
 * ese riesgo en el editor.
 */
describe("validateWorkflow - Challenge timeout + rama roja desconectada", () => {
	const buildChallengeNodes = (
		challengeTimeout: { value: number; unit: "minutes" | "hours" | "days" },
		bottomEdge: boolean,
	): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } => {
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
				title: "Firma del contrato",
				description: "",
				roles: ["client"],
				config: {
					...createDefaultChallengeConfig("acceptance", { challengeTimeout }),
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
			...(bottomEdge
				? [
						{
							id: "edge-3",
							from: "challenge-1",
							to: "reject-1",
							label: null,
							fromPort: "bottom" as const,
						},
					]
				: []),
		];
		return { nodes, edges };
	};

	it("warns explicitly that the challengeTimeout leads to the disconnected red branch", () => {
		const { nodes, edges } = buildChallengeNodes(
			{ value: 30, unit: "minutes" },
			false,
		);
		const errors = validateWorkflow(nodes, edges);
		const redBranchWarning = errors.find(
			(e) =>
				e.nodeId === "challenge-1" &&
				e.severity === "warning" &&
				e.message.includes("no tiene una conexión de salida configurada"),
		);
		expect(redBranchWarning).toBeDefined();
		expect(redBranchWarning?.message).toContain("timeout de challenge");
		expect(redBranchWarning?.message).toContain("30 minutos");
	});

	it("does NOT warn when the red branch (rejected) is connected", () => {
		const { nodes, edges } = buildChallengeNodes(
			{ value: 30, unit: "minutes" },
			true,
		);
		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "challenge-1" &&
					e.message.includes("no tiene una conexión de salida configurada"),
			),
		).toBe(false);
	});

	it("uses the generic message (no timeout mention) when challengeTimeout is invalid", () => {
		const { nodes, edges } = buildChallengeNodes(
			{ value: 0, unit: "minutes" },
			false,
		);
		const errors = validateWorkflow(nodes, edges);
		const redBranchWarning = errors.find(
			(e) =>
				e.nodeId === "challenge-1" &&
				e.severity === "warning" &&
				e.message.includes("no tiene una conexión de salida configurada"),
		);
		expect(redBranchWarning).toBeDefined();
		expect(redBranchWarning?.message).not.toContain("timeout de challenge");
	});
});

describe("validateWorkflow - ExternalLink (modo challenge) timeout + rama roja desconectada", () => {
	const buildExternalLinkNodes = (
		timeout: { value: number; unit: "minutes" | "hours" | "days" },
		bottomEdge: boolean,
	): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } => {
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
				id: "extlink-1",
				type: "ExternalLink",
				title: "Firma vía enlace externo",
				description: "",
				roles: ["client"],
				config: {
					mode: "challenge",
					channels: ["email"],
					recipient: { emailExpression: "{{client.email}}" },
					emailConfig: { templateName: "signature-request" },
					challengeConfig: { timeout },
					linkTtl: { value: 72, unit: "hours" },
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
			{ id: "edge-1", from: "start-1", to: "extlink-1", label: null },
			{
				id: "edge-2",
				from: "extlink-1",
				to: "end-1",
				label: null,
				fromPort: "top",
			},
			...(bottomEdge
				? [
						{
							id: "edge-3",
							from: "extlink-1",
							to: "reject-1",
							label: null,
							fromPort: "bottom" as const,
						},
					]
				: []),
		];
		return { nodes, edges };
	};

	it("warns explicitly that the challenge timeout leads to the disconnected red branch", () => {
		const { nodes, edges } = buildExternalLinkNodes(
			{ value: 2, unit: "days" },
			false,
		);
		const errors = validateWorkflow(nodes, edges);
		const redBranchWarning = errors.find(
			(e) =>
				e.nodeId === "extlink-1" &&
				e.severity === "warning" &&
				e.message.includes("no tiene una conexión de salida configurada"),
		);
		expect(redBranchWarning).toBeDefined();
		expect(redBranchWarning?.message).toContain("timeout de challenge");
		expect(redBranchWarning?.message).toContain("2 días");
	});

	it("does NOT warn when the red branch (rejected) is connected", () => {
		const { nodes, edges } = buildExternalLinkNodes(
			{ value: 2, unit: "days" },
			true,
		);
		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "extlink-1" &&
					e.message.includes("no tiene una conexión de salida configurada"),
			),
		).toBe(false);
	});

	it("does NOT warn when there is a single edge without an explicit fromPort (legacy single-output wiring)", () => {
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
				id: "extlink-1",
				type: "ExternalLink",
				title: "Firma vía enlace externo",
				description: "",
				roles: ["client"],
				config: {
					mode: "challenge",
					channels: ["email"],
					recipient: { emailExpression: "{{client.email}}" },
					emailConfig: { templateName: "signature-request" },
					challengeConfig: { timeout: { value: 2, unit: "days" } },
					linkTtl: { value: 72, unit: "hours" },
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
			{ id: "edge-1", from: "start-1", to: "extlink-1", label: null },
			{ id: "edge-2", from: "extlink-1", to: "end-1", label: null },
		];

		const errors = validateWorkflow(nodes, edges);
		expect(
			errors.some(
				(e) =>
					e.nodeId === "extlink-1" &&
					e.message.includes("no tiene una conexión de salida configurada"),
			),
		).toBe(false);
	});
});

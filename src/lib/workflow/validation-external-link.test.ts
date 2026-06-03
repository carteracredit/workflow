import { describe, it, expect } from "vitest";
import { validateWorkflow } from "./validation";
import {
	createDefaultExternalLinkConfig,
	type WorkflowNode,
	type WorkflowEdge,
	type ExternalLinkNodeConfig,
} from "./types";

function makeMinimalWorkflow(elConfig: Partial<ExternalLinkNodeConfig>): {
	nodes: WorkflowNode[];
	edges: WorkflowEdge[];
} {
	const config = { ...createDefaultExternalLinkConfig(), ...elConfig };
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
			id: "el",
			type: "ExternalLink",
			title: "External Link",
			description: "",
			roles: [],
			config,
			position: { x: 200, y: 0 },
			groupId: null,
		},
		{
			id: "end",
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
		{ id: "e1", from: "start", to: "el", label: null },
		{ id: "e2", from: "el", to: "end", label: null },
	];
	return { nodes, edges };
}

describe("validateWorkflow - ExternalLink node", () => {
	it("should error when no channels are selected", () => {
		const { nodes, edges } = makeMinimalWorkflow({
			channels: [],
			recipient: { source: "variable", emailExpression: "x" },
			emailConfig: { templateName: "tpl", subject: "", mergeVars: [] },
		});
		const errors = validateWorkflow(nodes, edges);
		const elErrors = errors.filter((e) => e.nodeId === "el");
		expect(elErrors.some((e) => e.message.includes("canal"))).toBe(true);
	});

	it("should error when email channel active but no emailExpression", () => {
		const { nodes, edges } = makeMinimalWorkflow({
			channels: ["email"],
			recipient: { source: "variable" },
			emailConfig: { templateName: "tpl", subject: "", mergeVars: [] },
		});
		const errors = validateWorkflow(nodes, edges);
		const elErrors = errors.filter((e) => e.nodeId === "el");
		expect(elErrors.some((e) => e.message.includes("email"))).toBe(true);
	});

	it("should error when email channel active but no templateName", () => {
		const { nodes, edges } = makeMinimalWorkflow({
			channels: ["email"],
			recipient: { source: "variable", emailExpression: "${start.email}" },
			emailConfig: { templateName: "", subject: "", mergeVars: [] },
		});
		const errors = validateWorkflow(nodes, edges);
		const elErrors = errors.filter((e) => e.nodeId === "el");
		expect(elErrors.some((e) => e.message.includes("template"))).toBe(true);
	});

	it("should error when sms channel active but no phoneExpression", () => {
		const { nodes, edges } = makeMinimalWorkflow({
			channels: ["sms"],
			recipient: { source: "variable" },
		});
		const errors = validateWorkflow(nodes, edges);
		const elErrors = errors.filter((e) => e.nodeId === "el");
		expect(elErrors.some((e) => e.message.includes("teléfono"))).toBe(true);
	});

	it("should error when form mode but no formId", () => {
		const { nodes, edges } = makeMinimalWorkflow({
			mode: "form",
			channels: ["email"],
			recipient: { source: "variable", emailExpression: "${start.email}" },
			emailConfig: { templateName: "tpl", subject: "", mergeVars: [] },
			formConfig: { formId: "" },
		});
		const errors = validateWorkflow(nodes, edges);
		const elErrors = errors.filter((e) => e.nodeId === "el");
		expect(elErrors.some((e) => e.message.includes("formulario"))).toBe(true);
	});

	it("should error when challenge mode but no valid timeout", () => {
		const { nodes, edges } = makeMinimalWorkflow({
			mode: "challenge",
			channels: ["email"],
			recipient: { source: "variable", emailExpression: "${start.email}" },
			emailConfig: { templateName: "tpl", subject: "", mergeVars: [] },
			challengeConfig: {
				challengeType: "acceptance",
				timeout: { value: 0, unit: "minutes" },
			},
		});
		const errors = validateWorkflow(nodes, edges);
		const elErrors = errors.filter((e) => e.nodeId === "el");
		expect(elErrors.some((e) => e.message.includes("timeout"))).toBe(true);
	});

	it("should error when link TTL is out of range", () => {
		const { nodes, edges } = makeMinimalWorkflow({
			channels: ["email"],
			recipient: { source: "variable", emailExpression: "${start.email}" },
			emailConfig: { templateName: "tpl", subject: "", mergeVars: [] },
			linkTtl: { value: 800, unit: "hours" },
		});
		const errors = validateWorkflow(nodes, edges);
		const elErrors = errors.filter((e) => e.nodeId === "el");
		expect(elErrors.some((e) => e.message.includes("TTL"))).toBe(true);
	});

	it("should pass with valid form mode config", () => {
		const { nodes, edges } = makeMinimalWorkflow({
			mode: "form",
			channels: ["email"],
			recipient: { source: "variable", emailExpression: "${start.email}" },
			emailConfig: {
				templateName: "my-template",
				subject: "Hello",
				mergeVars: [],
			},
			formConfig: { formId: "form-123" },
			linkTtl: { value: 72, unit: "hours" },
		});
		const errors = validateWorkflow(nodes, edges);
		const elErrors = errors.filter((e) => e.nodeId === "el");
		expect(elErrors.length).toBe(0);
	});

	it("should pass with valid challenge mode config", () => {
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
				id: "el",
				type: "ExternalLink",
				title: "External Link",
				description: "",
				roles: [],
				config: {
					mode: "challenge",
					channels: ["email"],
					recipient: {
						source: "variable",
						emailExpression: "${start.email}",
					},
					emailConfig: {
						templateName: "my-template",
						subject: "Approve?",
						mergeVars: [],
					},
					challengeConfig: {
						challengeType: "acceptance",
						timeout: { value: 5, unit: "minutes" },
					},
					linkTtl: { value: 72, unit: "hours" },
				} as ExternalLinkNodeConfig,
				position: { x: 200, y: 0 },
				groupId: null,
			},
			{
				id: "end",
				type: "End",
				title: "End",
				description: "",
				roles: [],
				config: {},
				position: { x: 400, y: 0 },
				groupId: null,
			},
			{
				id: "reject",
				type: "Reject",
				title: "Rejected",
				description: "",
				roles: [],
				config: {},
				position: { x: 400, y: 200 },
				groupId: null,
			},
		];
		const edges: WorkflowEdge[] = [
			{ id: "e1", from: "start", to: "el", label: null },
			{
				id: "e2",
				from: "el",
				to: "end",
				label: "accepted",
				fromPort: "top",
			},
			{
				id: "e3",
				from: "el",
				to: "reject",
				label: "rejected",
				fromPort: "bottom",
			},
		];
		const errors = validateWorkflow(nodes, edges);
		const elErrors = errors.filter((e) => e.nodeId === "el");
		expect(elErrors.length).toBe(0);
	});
});

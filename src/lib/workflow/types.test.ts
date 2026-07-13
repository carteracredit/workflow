import { describe, it, expect } from "vitest";
import {
	createDefaultChallengeConfig,
	isChallengeNode,
	isExternalLinkNode,
	createDefaultExternalLinkConfig,
	isMessageNode,
	isGeneratePdfNode,
	createDefaultGeneratePdfConfig,
	type WorkflowNode,
	type ChallengeNodeConfig,
	type ExternalLinkNodeConfig,
} from "./types";

describe("workflow types", () => {
	describe("createDefaultChallengeConfig", () => {
		it("should create default config with acceptance type", () => {
			const config = createDefaultChallengeConfig("acceptance");
			expect(config.challengeType).toBe("acceptance");
			expect(config.challengeTimeout.value).toBe(5);
			expect(config.challengeTimeout.unit).toBe("minutes");
			expect(config.deliveryMethod).toBe("none");
		});

		it("should create default config with signature type", () => {
			const config = createDefaultChallengeConfig("signature");
			expect(config.challengeType).toBe("signature");
			expect(config.challengeTimeout.value).toBe(5);
			expect(config.challengeTimeout.unit).toBe("minutes");
			expect(config.deliveryMethod).toBe("none");
		});

		it("should use custom timeout when provided", () => {
			const config = createDefaultChallengeConfig("acceptance", {
				challengeTimeout: { value: 10, unit: "hours" },
			});
			expect(config.challengeTimeout.value).toBe(10);
			expect(config.challengeTimeout.unit).toBe("hours");
		});

		it("should default to acceptance when no type provided", () => {
			const config = createDefaultChallengeConfig();
			expect(config.challengeType).toBe("acceptance");
		});
	});

	describe("isChallengeNode", () => {
		it("should return true for Challenge node", () => {
			const node: WorkflowNode = {
				id: "node-1",
				type: "Challenge",
				title: "Test Challenge",
				description: "",
				roles: [],
				config: createDefaultChallengeConfig("acceptance"),
				position: { x: 0, y: 0 },
				groupId: null,
			};
			expect(isChallengeNode(node)).toBe(true);
		});

		it("should return false for non-Challenge node", () => {
			const node: WorkflowNode = {
				id: "node-1",
				type: "Form",
				title: "Test Form",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			};
			expect(isChallengeNode(node)).toBe(false);
		});

		it("should narrow type correctly", () => {
			const node: WorkflowNode = {
				id: "node-1",
				type: "Challenge",
				title: "Test Challenge",
				description: "",
				roles: [],
				config: createDefaultChallengeConfig("acceptance"),
				position: { x: 0, y: 0 },
				groupId: null,
			};

			if (isChallengeNode(node)) {
				expect(node.type).toBe("Challenge");
				expect(node.config.challengeType).toBe("acceptance");
			}
		});
	});

	describe("isExternalLinkNode", () => {
		it("should return true for ExternalLink node", () => {
			const node: WorkflowNode = {
				id: "node-1",
				type: "ExternalLink",
				title: "External",
				description: "",
				roles: [],
				config: createDefaultExternalLinkConfig(),
				position: { x: 0, y: 0 },
				groupId: null,
			};
			expect(isExternalLinkNode(node)).toBe(true);
		});

		it("should return false for non-ExternalLink node", () => {
			const node: WorkflowNode = {
				id: "node-1",
				type: "Form",
				title: "Form",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			};
			expect(isExternalLinkNode(node)).toBe(false);
		});
	});

	describe("createDefaultExternalLinkConfig", () => {
		it("should create default config with form mode", () => {
			const config = createDefaultExternalLinkConfig();
			expect(config.mode).toBe("form");
			expect(config.channels).toEqual(["email"]);
			expect(config.linkTtl).toEqual({ value: 72, unit: "hours" });
			expect(config.recipient).toEqual({ source: "variable" });
			expect(config.emailConfig).toEqual({
				templateName: "",
				subject: "",
				mergeVars: [],
			});
			expect(config.formConfig).toEqual({ formId: "" });
		});
	});

	describe("isMessageNode", () => {
		it("should return true for Message node", () => {
			const node: WorkflowNode = {
				id: "node-1",
				type: "Message",
				title: "Msg",
				description: "",
				roles: [],
				config: { channel: "email" },
				position: { x: 0, y: 0 },
				groupId: null,
			};
			expect(isMessageNode(node)).toBe(true);
		});

		it("should return false for non-Message node", () => {
			const node: WorkflowNode = {
				id: "node-1",
				type: "Form",
				title: "Form",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			};
			expect(isMessageNode(node)).toBe(false);
		});
	});

	describe("createDefaultGeneratePdfConfig", () => {
		it("should create an empty config with no template and no field mappings", () => {
			const config = createDefaultGeneratePdfConfig();
			expect(config.pdfTemplateId).toBeUndefined();
			expect(config.pdfTemplateName).toBeUndefined();
			expect(config.fieldMappings).toEqual([]);
		});
	});

	describe("isGeneratePdfNode", () => {
		it("should return true for GeneratePDF node", () => {
			const node: WorkflowNode = {
				id: "node-1",
				type: "GeneratePDF",
				title: "Generate PDF",
				description: "",
				roles: [],
				config: createDefaultGeneratePdfConfig(),
				position: { x: 0, y: 0 },
				groupId: null,
			};
			expect(isGeneratePdfNode(node)).toBe(true);
		});

		it("should return false for non-GeneratePDF node", () => {
			const node: WorkflowNode = {
				id: "node-1",
				type: "Form",
				title: "Form",
				description: "",
				roles: [],
				config: {},
				position: { x: 0, y: 0 },
				groupId: null,
			};
			expect(isGeneratePdfNode(node)).toBe(false);
		});

		it("should narrow type correctly", () => {
			const node: WorkflowNode = {
				id: "node-1",
				type: "GeneratePDF",
				title: "Generate PDF",
				description: "",
				roles: [],
				config: createDefaultGeneratePdfConfig(),
				position: { x: 0, y: 0 },
				groupId: null,
			};

			if (isGeneratePdfNode(node)) {
				expect(node.type).toBe("GeneratePDF");
				expect(node.config.fieldMappings).toEqual([]);
			}
		});
	});
});

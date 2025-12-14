import { describe, it, expect } from "vitest";
import {
	createDefaultChallengeConfig,
	isChallengeNode,
	type WorkflowNode,
	type ChallengeNodeConfig,
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
});

import { describe, it, expect } from "vitest";
import { estimateNodeDimensions } from "./node-metrics";
import type { WorkflowNode } from "@/lib/workflow/types";

const baseNode: WorkflowNode = {
	id: "n1",
	type: "Start",
	title: "Start",
	description: "",
	roles: [],
	config: {},
	position: { x: 0, y: 0 },
	groupId: null,
	staleTimeout: null,
};

describe("estimateNodeDimensions", () => {
	it("returns minimum width and height for minimal Start node", () => {
		const { width, height } = estimateNodeDimensions(baseNode);
		expect(width).toBe(180);
		expect(height).toBe(60);
	});

	it("increases width with longer title", () => {
		const longTitle = "A".repeat(30);
		const { width } = estimateNodeDimensions({
			...baseNode,
			title: longTitle,
		});
		expect(width).toBeGreaterThan(180);
		expect(width).toBeLessThanOrEqual(320);
	});

	it("caps width at MAX_NODE_WIDTH (320)", () => {
		const veryLongTitle = "A".repeat(100);
		const { width } = estimateNodeDimensions({
			...baseNode,
			title: veryLongTitle,
		});
		expect(width).toBe(320);
	});

	it("adds height when node has description", () => {
		const withoutDesc = estimateNodeDimensions(baseNode);
		const withDesc = estimateNodeDimensions({
			...baseNode,
			description: "Some description text",
		});
		expect(withDesc.height).toBe(withoutDesc.height + 22);
	});

	it("adds height for roles", () => {
		const withRoles = estimateNodeDimensions({
			...baseNode,
			roles: ["client", "seller", "org_manager"],
		});
		expect(withRoles.height).toBeGreaterThan(60);
	});

	it("adds height for Challenge type (special badge)", () => {
		const challengeNode: WorkflowNode = {
			...baseNode,
			type: "Challenge",
			config: {
				challengeType: "acceptance",
				challengeTimeout: { value: 5, unit: "minutes" },
				deliveryMethod: "none",
			},
		};
		const { height } = estimateNodeDimensions(challengeNode);
		expect(height).toBeGreaterThan(60);
	});

	it("adds height for FlagChange with flagChanges", () => {
		const flagChangeNode: WorkflowNode = {
			...baseNode,
			type: "FlagChange",
			config: {
				flagChanges: [
					{ flagId: "f1", optionId: "o1" },
					{ flagId: "f2", optionId: "o2" },
				],
			},
		};
		const { width, height } = estimateNodeDimensions(flagChangeNode);
		expect(width).toBeGreaterThanOrEqual(180);
		expect(height).toBeGreaterThan(60);
	});

	it("adds height for Reject with allowRetry", () => {
		const rejectNode: WorkflowNode = {
			...baseNode,
			type: "Reject",
			config: { allowRetry: true },
		};
		const { height } = estimateNodeDimensions(rejectNode);
		expect(height).toBeGreaterThan(60);
	});

	it("adds height for API with failureHandling", () => {
		const apiNode: WorkflowNode = {
			...baseNode,
			type: "API",
			config: {
				failureHandling: {
					onFailure: "stop",
					maxRetries: 0,
					retryCount: 0,
					cacheStrategy: "always-execute",
					timeout: 30000,
				},
			},
		};
		const { height } = estimateNodeDimensions(apiNode);
		expect(height).toBeGreaterThan(60);
	});
});

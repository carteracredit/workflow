import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getWorkflowServiceUrl } from "./config";

describe("workflow-api config", () => {
	const originalUrl = process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL;

	beforeEach(() => {
		delete process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL;
	});

	afterEach(() => {
		if (originalUrl !== undefined) {
			process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL = originalUrl;
		}
	});

	describe("getWorkflowServiceUrl", () => {
		it("returns default dev URL when env is not set", () => {
			expect(getWorkflowServiceUrl()).toBe(
				"https://workflow-svc.carteracredit.workers.dev",
			);
		});

		it("returns env value when NEXT_PUBLIC_WORKFLOW_SERVICE_URL is set", () => {
			process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL = "http://localhost:8791";
			expect(getWorkflowServiceUrl()).toBe("http://localhost:8791");
		});

		it("returns custom production URL when configured", () => {
			process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL =
				"https://workflow-svc.carteracredit.com";
			expect(getWorkflowServiceUrl()).toBe(
				"https://workflow-svc.carteracredit.com",
			);
		});
	});
});

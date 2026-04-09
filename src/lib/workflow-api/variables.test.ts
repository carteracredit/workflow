import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	listVariables,
	createVariable,
	updateVariable,
	deleteVariable,
	rotateSecret,
	syncAllVariables,
} from "./variables";
import type { WorkflowVariable } from "./types";

const BASE_URL = "https://workflow-svc.carteracredit.workers.dev";
const WORKFLOW_ID = "00000000-0000-0000-0000-000000000001";
const VAR_ID = "00000000-0000-0000-0002-000000000001";

const mockVariable: WorkflowVariable = {
	id: VAR_ID,
	workflow_id: WORKFLOW_ID,
	name: "API_BASE_URL",
	value: "https://api.example.com",
	is_secret: false,
	environment: "all",
	description: "Base URL for the external API",
	created_at: "2026-01-01T00:00:00.000Z",
	updated_at: "2026-01-01T00:00:00.000Z",
};

const mockSecret: WorkflowVariable = {
	id: "00000000-0000-0000-0002-000000000002",
	workflow_id: WORKFLOW_ID,
	name: "API_SECRET_KEY",
	value: null,
	is_secret: true,
	environment: "all",
	description: null,
	created_at: "2026-01-01T00:00:00.000Z",
	updated_at: "2026-01-01T00:00:00.000Z",
};

function mockFetch(body: unknown, status = 200) {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({
			ok: status >= 200 && status < 300,
			status,
			statusText: status === 200 ? "OK" : "Error",
			headers: { get: () => "application/json" },
			json: () => Promise.resolve(body),
			text: () => Promise.resolve(""),
		}),
	);
}

describe("variables API functions", () => {
	beforeEach(() => {
		delete process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("listVariables", () => {
		it("fetches variables from the correct URL", async () => {
			mockFetch({ success: true, result: [mockVariable, mockSecret] });

			const result = await listVariables(WORKFLOW_ID, { jwt: "test-token" });

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows/${WORKFLOW_ID}/variables`,
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer test-token",
					}),
				}),
			);
			expect(result).toHaveLength(2);
			expect(result[0].name).toBe("API_BASE_URL");
			expect(result[1].is_secret).toBe(true);
			expect(result[1].value).toBeNull();
		});

		it("returns empty array when no variables exist", async () => {
			mockFetch({ success: true, result: [] });
			const result = await listVariables(WORKFLOW_ID);
			expect(result).toEqual([]);
		});
	});

	describe("createVariable", () => {
		it("POSTs a non-secret variable to the correct URL", async () => {
			mockFetch({ success: true, result: mockVariable }, 201);

			const payload = {
				name: "API_BASE_URL",
				value: "https://api.example.com",
				is_secret: false,
				environment: "all" as const,
			};
			const result = await createVariable(WORKFLOW_ID, payload, {
				jwt: "test-token",
			});

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows/${WORKFLOW_ID}/variables`,
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						"content-type": "application/json",
					}),
					body: JSON.stringify(payload),
				}),
			);
			expect(result.name).toBe("API_BASE_URL");
			expect(result.value).toBe("https://api.example.com");
		});

		it("POSTs a secret variable with null value", async () => {
			mockFetch({ success: true, result: mockSecret }, 201);

			const payload = {
				name: "API_SECRET_KEY",
				is_secret: true,
				environment: "all" as const,
			};
			const result = await createVariable(WORKFLOW_ID, payload, {
				jwt: "test-token",
			});

			expect(result.is_secret).toBe(true);
			expect(result.value).toBeNull();
		});
	});

	describe("updateVariable", () => {
		it("PUTs an updated variable to the correct URL", async () => {
			const updated = { ...mockVariable, value: "https://new.example.com" };
			mockFetch({ success: true, result: updated });

			const payload = { value: "https://new.example.com" };
			const result = await updateVariable(WORKFLOW_ID, VAR_ID, payload, {
				jwt: "test-token",
			});

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows/${WORKFLOW_ID}/variables/${VAR_ID}`,
				expect.objectContaining({
					method: "PUT",
					body: JSON.stringify(payload),
				}),
			);
			expect(result.value).toBe("https://new.example.com");
		});

		it("can update environment and description", async () => {
			const updated = {
				...mockVariable,
				environment: "production" as const,
				description: "Updated desc",
			};
			mockFetch({ success: true, result: updated });

			const payload = {
				environment: "production" as const,
				description: "Updated desc",
			};
			const result = await updateVariable(WORKFLOW_ID, VAR_ID, payload);

			expect(result.environment).toBe("production");
			expect(result.description).toBe("Updated desc");
		});
	});

	describe("deleteVariable", () => {
		it("DELETEs a variable at the correct URL", async () => {
			mockFetch({ success: true, result: { deleted: true } });

			await deleteVariable(WORKFLOW_ID, VAR_ID, { jwt: "test-token" });

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows/${WORKFLOW_ID}/variables/${VAR_ID}`,
				expect.objectContaining({
					method: "DELETE",
				}),
			);
		});
	});

	describe("rotateSecret", () => {
		it("POSTs to the rotate-secrets endpoint with correct payload", async () => {
			const rotateResult = {
				secret: "API_SECRET_KEY",
				synced: ["workflow-credit-dev-v1", "workflow-credit-dev-v2"],
				failed: [],
			};
			mockFetch({ success: true, result: rotateResult });

			const result = await rotateSecret(
				WORKFLOW_ID,
				{ name: "API_SECRET_KEY", value: "new-secret-value" },
				{ jwt: "test-token" },
			);

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows/${WORKFLOW_ID}/variables/rotate-secrets`,
				expect.objectContaining({
					method: "POST",
					body: JSON.stringify({
						name: "API_SECRET_KEY",
						value: "new-secret-value",
					}),
				}),
			);
			expect(result.synced).toHaveLength(2);
			expect(result.failed).toHaveLength(0);
		});

		it("returns failed workers list on partial failure", async () => {
			mockFetch({
				success: true,
				result: {
					secret: "API_SECRET_KEY",
					synced: ["workflow-credit-dev-v1"],
					failed: ["workflow-credit-dev-v2"],
				},
			});

			const result = await rotateSecret(WORKFLOW_ID, {
				name: "API_SECRET_KEY",
				value: "new-value",
			});

			expect(result.synced).toHaveLength(1);
			expect(result.failed).toHaveLength(1);
		});
	});

	describe("syncAllVariables", () => {
		it("POSTs to the sync endpoint with empty body (no secrets needed)", async () => {
			mockFetch({
				success: true,
				result: {
					synced: ["workflow-credit-dev-v1"],
					failed: [],
					variableCount: 2,
				},
			});

			const result = await syncAllVariables(WORKFLOW_ID, { jwt: "test-token" });

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows/${WORKFLOW_ID}/variables/sync`,
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						"content-type": "application/json",
					}),
					body: JSON.stringify({}),
				}),
			);
			expect(result.synced).toHaveLength(1);
			expect(result.failed).toHaveLength(0);
			expect(result.variableCount).toBe(2);
		});

		it("returns 0 synced on no deployments (message present)", async () => {
			mockFetch({
				success: true,
				result: {
					synced: [],
					failed: [],
					message: "No active deployments found for this workflow",
				},
			});

			const result = await syncAllVariables(WORKFLOW_ID);
			expect(result.synced).toHaveLength(0);
		});

		it("passes JWT header when provided", async () => {
			mockFetch({
				success: true,
				result: { synced: [], failed: [], variableCount: 0 },
			});

			await syncAllVariables(WORKFLOW_ID, { jwt: "bearer-token" });

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({
						Authorization: "Bearer bearer-token",
					}),
				}),
			);
		});
	});
});

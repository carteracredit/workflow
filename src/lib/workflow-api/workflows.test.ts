import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	listWorkflows,
	createWorkflow,
	getWorkflow,
	updateWorkflow,
	deleteWorkflow,
} from "./workflows";
import { ApiError } from "./http";

const BASE_URL = "https://workflow-svc.carteracredit.workers.dev";

const mockWorkflow = {
	id: 1,
	name: "Credit App",
	slug: "credit-app",
	description: "Credit application workflow",
	github_repo_url: "https://github.com/carteracredit/credit-app",
	class_name: "CreditApp",
	current_major_version: 1,
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

describe("workflow API functions", () => {
	beforeEach(() => {
		delete process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("listWorkflows", () => {
		it("fetches workflows from correct URL", async () => {
			mockFetch({ success: true, result: [mockWorkflow] });

			const result = await listWorkflows();

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows`,
				expect.objectContaining({ headers: expect.any(Object) }),
			);
			expect(result).toEqual([mockWorkflow]);
		});

		it("appends search param when provided", async () => {
			mockFetch({ success: true, result: [] });

			await listWorkflows({ search: "credit" });

			const url = vi.mocked(fetch).mock.calls[0][0] as string;
			expect(url).toContain("search=credit");
		});

		it("passes JWT in Authorization header", async () => {
			mockFetch({ success: true, result: [] });

			await listWorkflows({ jwt: "my-token" });

			const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<
				string,
				string
			>;
			expect(headers.Authorization).toBe("Bearer my-token");
		});
	});

	describe("createWorkflow", () => {
		it("POSTs to correct URL and returns created workflow", async () => {
			mockFetch({ success: true, result: mockWorkflow }, 201);

			const payload = {
				name: "Credit App",
				slug: "credit-app",
				description: "Credit application workflow",
				github_repo_url: "https://github.com/carteracredit/credit-app",
				class_name: "CreditApp",
				current_major_version: 1,
			};

			const result = await createWorkflow(payload, { jwt: "my-token" });

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows`,
				expect.objectContaining({ method: "POST" }),
			);
			expect(result).toEqual(mockWorkflow);
		});
	});

	describe("getWorkflow", () => {
		it("fetches workflow by ID from correct URL", async () => {
			mockFetch({ success: true, result: mockWorkflow });

			const result = await getWorkflow(1);

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows/1`,
				expect.any(Object),
			);
			expect(result).toEqual(mockWorkflow);
		});

		it("throws ApiError on 404", async () => {
			mockFetch({ success: false, errors: [{ message: "Not Found" }] }, 404);

			await expect(getWorkflow(9999)).rejects.toThrow(ApiError);
		});
	});

	describe("updateWorkflow", () => {
		it("PUTs to correct URL with payload", async () => {
			const updated = { ...mockWorkflow, name: "Updated Name" };
			mockFetch({ success: true, result: updated });

			const result = await updateWorkflow(1, { name: "Updated Name" });

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows/1`,
				expect.objectContaining({ method: "PUT" }),
			);
			expect(result.name).toBe("Updated Name");
		});
	});

	describe("deleteWorkflow", () => {
		it("DELETEs to correct URL and returns id", async () => {
			mockFetch({ success: true, result: { id: 1 } });

			const result = await deleteWorkflow(1);

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows/1`,
				expect.objectContaining({ method: "DELETE" }),
			);
			expect(result.id).toBe(1);
		});
	});
});

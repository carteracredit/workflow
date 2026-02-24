import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	listDeployments,
	createDeployment,
	getDeployment,
	updateDeployment,
} from "./deployments";
import { ApiError } from "./http";

const BASE_URL = "https://workflow-svc.carteracredit.workers.dev";

const mockDeployment = {
	id: 1,
	workflow_id: 1,
	major_version: 1,
	semver: "1.0.0",
	environment: "development" as const,
	worker_name: "my-workflow-dev-v1",
	status: "active" as const,
	deployed_at: "2026-01-01T00:00:00.000Z",
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

describe("deployments API functions", () => {
	beforeEach(() => {
		delete process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("listDeployments", () => {
		it("fetches deployments from correct URL", async () => {
			mockFetch({ success: true, result: [mockDeployment] });

			const result = await listDeployments();

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflow-deployments`,
				expect.objectContaining({ headers: expect.any(Object) }),
			);
			expect(result).toEqual([mockDeployment]);
		});

		it("appends search param when provided", async () => {
			mockFetch({ success: true, result: [] });

			await listDeployments({ search: "active" });

			const url = vi.mocked(fetch).mock.calls[0][0] as string;
			expect(url).toContain("search=active");
		});

		it("passes JWT in Authorization header", async () => {
			mockFetch({ success: true, result: [] });

			await listDeployments({ jwt: "my-token" });

			const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<
				string,
				string
			>;
			expect(headers.Authorization).toBe("Bearer my-token");
		});
	});

	describe("createDeployment", () => {
		it("POSTs to correct URL and returns created deployment", async () => {
			mockFetch({ success: true, result: mockDeployment }, 201);

			const payload = {
				workflow_id: 1,
				major_version: 1,
				semver: "1.0.0",
				environment: "development" as const,
				worker_name: "my-workflow-dev-v1",
				status: "active" as const,
			};

			const result = await createDeployment(payload, { jwt: "my-token" });

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflow-deployments`,
				expect.objectContaining({ method: "POST" }),
			);
			expect(result).toEqual(mockDeployment);
		});
	});

	describe("getDeployment", () => {
		it("fetches deployment by ID from correct URL", async () => {
			mockFetch({ success: true, result: mockDeployment });

			const result = await getDeployment(1);

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflow-deployments/1`,
				expect.any(Object),
			);
			expect(result).toEqual(mockDeployment);
		});

		it("throws ApiError on 404", async () => {
			mockFetch({ success: false, errors: [{ message: "Not Found" }] }, 404);

			await expect(getDeployment(9999)).rejects.toThrow(ApiError);
		});
	});

	describe("updateDeployment", () => {
		it("PUTs to correct URL with status update", async () => {
			const updated = { ...mockDeployment, status: "deprecated" as const };
			mockFetch({ success: true, result: updated });

			const result = await updateDeployment(1, { status: "deprecated" });

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflow-deployments/1`,
				expect.objectContaining({ method: "PUT" }),
			);
			expect(result.status).toBe("deprecated");
		});

		it("PUTs with deployed_at timestamp", async () => {
			const timestamp = "2026-02-01T00:00:00.000Z";
			const updated = { ...mockDeployment, deployed_at: timestamp };
			mockFetch({ success: true, result: updated });

			const result = await updateDeployment(1, { deployed_at: timestamp });

			expect(result.deployed_at).toBe(timestamp);
		});
	});
});

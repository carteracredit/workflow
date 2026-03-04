import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	listWorkflows,
	createWorkflow,
	getWorkflow,
	updateWorkflow,
	deleteWorkflow,
	publishWorkflow,
	listWorkflowVersions,
} from "./workflows";
import type { PublishWorkflowDeployedResponse } from "./types";
import { ApiError } from "./http";

const BASE_URL = "https://workflow-svc.carteracredit.workers.dev";

const mockWorkflow = {
	id: "wf-uuid-001",
	name: "Credit App",
	slug: "credit-app",
	description: "Credit application workflow",
	status: "published" as const,
	definition: null,
	published_code_checksum: null,
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

		it("appends status param when provided", async () => {
			mockFetch({ success: true, result: [] });

			await listWorkflows({ status: "draft" });

			const url = vi.mocked(fetch).mock.calls[0][0] as string;
			expect(url).toContain("status=draft");
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

			const result = await getWorkflow("wf-uuid-001");

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows/wf-uuid-001`,
				expect.any(Object),
			);
			expect(result).toEqual(mockWorkflow);
		});

		it("throws ApiError on 404", async () => {
			mockFetch({ success: false, errors: [{ message: "Not Found" }] }, 404);

			await expect(getWorkflow("wf-uuid-404")).rejects.toThrow(ApiError);
		});
	});

	describe("updateWorkflow", () => {
		it("PUTs to correct URL with payload", async () => {
			const updated = { ...mockWorkflow, name: "Updated Name" };
			mockFetch({ success: true, result: updated });

			const result = await updateWorkflow("wf-uuid-001", {
				name: "Updated Name",
			});

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows/wf-uuid-001`,
				expect.objectContaining({ method: "PUT" }),
			);
			expect(result.name).toBe("Updated Name");
		});
	});

	describe("deleteWorkflow", () => {
		it("DELETEs to correct URL and returns id", async () => {
			mockFetch({ success: true, result: { id: "wf-uuid-001" } });

			const result = await deleteWorkflow("wf-uuid-001");

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows/wf-uuid-001`,
				expect.objectContaining({ method: "DELETE" }),
			);
			expect(result.id).toBe("wf-uuid-001");
		});
	});

	describe("publishWorkflow", () => {
		const mockDeployment = {
			id: "dep-uuid-010",
			workflow_id: "wf-uuid-001",
			major_version: 1,
			semver: "1.0.0",
			environment: "development" as const,
			worker_name: "credit-app-dev-v1",
			status: "deploying" as const,
			deployed_at: null,
			created_at: "2026-02-24T00:00:00.000Z",
			updated_at: "2026-02-24T00:00:00.000Z",
		};

		const mockPublishResult: PublishWorkflowDeployedResponse = {
			skipped: false,
			deployment: mockDeployment,
			repo_url: "https://github.com/carteracredit/credit-app",
			worker_name: "credit-app-dev-v1",
			branch: "dev",
			version: 1,
		};

		it("POSTs to correct publish URL", async () => {
			mockFetch({ success: true, result: mockPublishResult });

			await publishWorkflow(
				"wf-uuid-001",
				{
					code: "export class MyWorkflow {}",
					environment: "development",
				},
				{ jwt: "my-token" },
			);

			expect(vi.mocked(fetch)).toHaveBeenCalledWith(
				`${BASE_URL}/workflows/wf-uuid-001/publish`,
				expect.objectContaining({ method: "POST" }),
			);
		});

		it("sends code and environment in body", async () => {
			mockFetch({ success: true, result: mockPublishResult });

			const code = "export class MyWorkflow extends WorkflowEntrypoint {}";
			await publishWorkflow("wf-uuid-001", { code, environment: "production" });

			const call = vi.mocked(fetch).mock.calls[0];
			const body = JSON.parse(call[1]?.body as string) as {
				code: string;
				environment: string;
			};
			expect(body.code).toBe(code);
			expect(body.environment).toBe("production");
		});

		it("sends definition in body when provided", async () => {
			mockFetch({ success: true, result: mockPublishResult });

			const definition = JSON.stringify({ nodes: [], edges: [], flags: [] });
			await publishWorkflow("wf-uuid-001", {
				code: "code",
				environment: "development",
				definition,
			});

			const call = vi.mocked(fetch).mock.calls[0];
			const body = JSON.parse(call[1]?.body as string) as {
				definition: string;
			};
			expect(body.definition).toBe(definition);
		});

		it("returns deployment result on success", async () => {
			mockFetch({ success: true, result: mockPublishResult });

			const result = await publishWorkflow("wf-uuid-001", {
				code: "export class MyWorkflow {}",
				environment: "development",
			});

			if (result.skipped) throw new Error("Expected not skipped");
			expect(result.deployment.status).toBe("deploying");
			expect(result.worker_name).toBe("credit-app-dev-v1");
			expect(result.branch).toBe("dev");
			expect(result.repo_url).toBe(
				"https://github.com/carteracredit/credit-app",
			);
			expect(result.version).toBe(1);
		});

		it("returns skipped response when code has not changed", async () => {
			const skippedResult = {
				skipped: true,
				reason: "no_changes",
				current_version: 1,
			};
			mockFetch({ success: true, result: skippedResult });

			const result = await publishWorkflow("wf-uuid-001", {
				code: "export class MyWorkflow {}",
				environment: "development",
			});

			expect(result.skipped).toBe(true);
			if (!result.skipped) throw new Error("Expected skipped");
			expect(result.reason).toBe("no_changes");
			expect(result.current_version).toBe(1);
		});

		it("passes JWT Authorization header", async () => {
			mockFetch({ success: true, result: mockPublishResult });

			await publishWorkflow(
				"wf-uuid-001",
				{ code: "code", environment: "development" },
				{ jwt: "publish-token" },
			);

			const headers = vi.mocked(fetch).mock.calls[0][1]?.headers as Record<
				string,
				string
			>;
			expect(headers.Authorization).toBe("Bearer publish-token");
		});

		it("throws ApiError on 503 (GitHub not configured)", async () => {
			mockFetch(
				{ success: false, error: "GitHub integration is not configured" },
				503,
			);

			await expect(
				publishWorkflow("wf-uuid-001", {
					code: "code",
					environment: "development",
				}),
			).rejects.toThrow(ApiError);
		});

		it("throws ApiError on 404 (workflow not found)", async () => {
			mockFetch({ success: false, error: "Workflow not found" }, 404);

			await expect(
				publishWorkflow("wf-uuid-099", {
					code: "code",
					environment: "development",
				}),
			).rejects.toThrow(ApiError);
		});

		it("works without JWT option", async () => {
			mockFetch({ success: true, result: mockPublishResult });

			const result = await publishWorkflow("wf-uuid-001", {
				code: "code",
				environment: "development",
			});

			expect(result).toEqual(mockPublishResult);
		});
	});

	describe("listWorkflowVersions", () => {
		const mockVersions = [
			{
				id: "ver-uuid-001",
				workflow_id: "wf-uuid-001",
				version: 1,
				definition: "{}",
				code_checksum: "abc123",
				created_by: "user-id",
				created_at: "2026-01-01T00:00:00.000Z",
			},
		];

		it("fetches versions for a workflow ID", async () => {
			mockFetch({ success: true, result: mockVersions });

			const result = await listWorkflowVersions("wf-uuid-001", {
				jwt: "my-token",
			});

			const url = vi.mocked(fetch).mock.calls[0][0] as string;
			expect(url).toContain("/workflow-versions");
			expect(url).toContain("workflow_id=wf-uuid-001");
			expect(result).toEqual(mockVersions);
		});

		it("returns empty array when no versions exist", async () => {
			mockFetch({ success: true, result: [] });

			const result = await listWorkflowVersions("wf-uuid-404");

			expect(result).toEqual([]);
		});
	});
});

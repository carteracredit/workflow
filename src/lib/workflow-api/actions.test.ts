import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/auth/getJwt", () => ({
	getJwt: vi.fn(),
}));

vi.mock("@/lib/auth/getServerSession", () => ({
	requireAdminSession: vi.fn(),
}));

vi.mock("./workflows", () => ({
	listWorkflows: vi.fn(),
	createWorkflow: vi.fn(),
	getWorkflow: vi.fn(),
	updateWorkflow: vi.fn(),
	deleteWorkflow: vi.fn(),
}));

vi.mock("./deployments", () => ({
	listDeployments: vi.fn(),
	createDeployment: vi.fn(),
	getDeployment: vi.fn(),
	updateDeployment: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	redirect: vi.fn((url: string) => {
		throw new RedirectError(url);
	}),
}));

class RedirectError extends Error {
	url: string;
	constructor(url: string) {
		super(`NEXT_REDIRECT: ${url}`);
		this.url = url;
	}
}

import { getJwt } from "@/lib/auth/getJwt";
import { requireAdminSession } from "@/lib/auth/getServerSession";
import {
	listWorkflows,
	createWorkflow,
	getWorkflow,
	updateWorkflow,
	deleteWorkflow,
} from "./workflows";
import {
	listDeployments,
	createDeployment,
	getDeployment,
	updateDeployment,
} from "./deployments";
import {
	getWorkflowsAction,
	getWorkflowAction,
	createWorkflowAction,
	updateWorkflowAction,
	deleteWorkflowAction,
	getDeploymentsAction,
	getDeploymentAction,
	createDeploymentAction,
	updateDeploymentAction,
} from "./actions";

const mockSession = {
	user: {
		id: "user-1",
		name: "Admin",
		email: "admin@example.com",
		image: null,
		emailVerified: true,
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-01"),
		role: "admin",
	},
	session: {
		id: "session-1",
		userId: "user-1",
		token: "tok",
		expiresAt: new Date("2026-12-31"),
		createdAt: new Date("2026-01-01"),
		updatedAt: new Date("2026-01-01"),
	},
};

const mockWorkflow = {
	id: 1,
	name: "Test Workflow",
	slug: "test-workflow",
	description: "A test workflow",
	status: "draft" as const,
	definition: null,
	published_code_checksum: null,
	github_repo_url: "https://github.com/test/test-workflow",
	class_name: "TestWorkflow",
	current_major_version: 1,
	created_at: "2026-01-01T00:00:00Z",
	updated_at: "2026-01-01T00:00:00Z",
};

const mockDeployment = {
	id: 1,
	workflow_id: 1,
	major_version: 1,
	semver: "1.0.0",
	environment: "development" as const,
	worker_name: "test-workflow-v1-dev",
	status: "active" as const,
	deployed_at: "2026-01-01T00:00:00Z",
	created_at: "2026-01-01T00:00:00Z",
	updated_at: "2026-01-01T00:00:00Z",
};

describe("workflow-api server actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(requireAdminSession).mockResolvedValue(mockSession);
		vi.mocked(getJwt).mockResolvedValue("test-jwt-token");
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("auth guard", () => {
		it("redirects to /forbidden when requireAdminSession throws Authentication required", async () => {
			vi.mocked(requireAdminSession).mockRejectedValue(
				new Error("Authentication required"),
			);

			await expect(getWorkflowsAction()).rejects.toThrow(RedirectError);
			try {
				await getWorkflowsAction();
			} catch (err) {
				expect((err as RedirectError).url).toBe("/forbidden");
			}
		});

		it("redirects to /forbidden when requireAdminSession throws Admin access required", async () => {
			vi.mocked(requireAdminSession).mockRejectedValue(
				new Error("Admin access required"),
			);

			await expect(getWorkflowsAction()).rejects.toThrow(RedirectError);
		});

		it("returns error when JWT is null", async () => {
			vi.mocked(getJwt).mockResolvedValue(null);

			const result = await getWorkflowsAction();

			expect(result).toEqual({
				data: null,
				error: "Failed to obtain authentication token",
			});
		});
	});

	describe("getWorkflowsAction", () => {
		it("returns workflows list on success", async () => {
			vi.mocked(listWorkflows).mockResolvedValue([mockWorkflow]);

			const result = await getWorkflowsAction();

			expect(result).toEqual({ data: [mockWorkflow], error: null });
			expect(listWorkflows).toHaveBeenCalledWith({
				jwt: "test-jwt-token",
				search: undefined,
			});
		});

		it("passes search parameter", async () => {
			vi.mocked(listWorkflows).mockResolvedValue([]);

			await getWorkflowsAction("credit");

			expect(listWorkflows).toHaveBeenCalledWith({
				jwt: "test-jwt-token",
				search: "credit",
			});
		});
	});

	describe("getWorkflowAction", () => {
		it("returns a single workflow on success", async () => {
			vi.mocked(getWorkflow).mockResolvedValue(mockWorkflow);

			const result = await getWorkflowAction(1);

			expect(result).toEqual({ data: mockWorkflow, error: null });
			expect(getWorkflow).toHaveBeenCalledWith(1, {
				jwt: "test-jwt-token",
			});
		});
	});

	describe("createWorkflowAction", () => {
		it("creates a workflow and returns it", async () => {
			vi.mocked(createWorkflow).mockResolvedValue(mockWorkflow);

			const payload = {
				name: "Test Workflow",
				slug: "test-workflow",
				description: "A test workflow",
				github_repo_url: "https://github.com/test/test-workflow",
				class_name: "TestWorkflow",
				current_major_version: 1,
			};

			const result = await createWorkflowAction(payload);

			expect(result).toEqual({ data: mockWorkflow, error: null });
			expect(createWorkflow).toHaveBeenCalledWith(payload, {
				jwt: "test-jwt-token",
			});
		});
	});

	describe("updateWorkflowAction", () => {
		it("updates a workflow and returns the updated version", async () => {
			const updated = { ...mockWorkflow, name: "Updated" };
			vi.mocked(updateWorkflow).mockResolvedValue(updated);

			const result = await updateWorkflowAction(1, { name: "Updated" });

			expect(result).toEqual({ data: updated, error: null });
			expect(updateWorkflow).toHaveBeenCalledWith(
				1,
				{ name: "Updated" },
				{ jwt: "test-jwt-token" },
			);
		});
	});

	describe("deleteWorkflowAction", () => {
		it("deletes a workflow and returns the id", async () => {
			vi.mocked(deleteWorkflow).mockResolvedValue({ id: 1 });

			const result = await deleteWorkflowAction(1);

			expect(result).toEqual({ data: { id: 1 }, error: null });
			expect(deleteWorkflow).toHaveBeenCalledWith(1, {
				jwt: "test-jwt-token",
			});
		});
	});

	describe("getDeploymentsAction", () => {
		it("returns deployments list on success", async () => {
			vi.mocked(listDeployments).mockResolvedValue([mockDeployment]);

			const result = await getDeploymentsAction();

			expect(result).toEqual({ data: [mockDeployment], error: null });
			expect(listDeployments).toHaveBeenCalledWith({
				jwt: "test-jwt-token",
				search: undefined,
			});
		});
	});

	describe("getDeploymentAction", () => {
		it("returns a single deployment on success", async () => {
			vi.mocked(getDeployment).mockResolvedValue(mockDeployment);

			const result = await getDeploymentAction(1);

			expect(result).toEqual({ data: mockDeployment, error: null });
		});
	});

	describe("createDeploymentAction", () => {
		it("creates a deployment and returns it", async () => {
			vi.mocked(createDeployment).mockResolvedValue(mockDeployment);

			const payload = {
				workflow_id: 1,
				major_version: 1,
				semver: "1.0.0",
				environment: "development" as const,
				worker_name: "test-workflow-v1-dev",
				status: "active" as const,
			};

			const result = await createDeploymentAction(payload);

			expect(result).toEqual({ data: mockDeployment, error: null });
			expect(createDeployment).toHaveBeenCalledWith(payload, {
				jwt: "test-jwt-token",
			});
		});
	});

	describe("updateDeploymentAction", () => {
		it("updates a deployment and returns the updated version", async () => {
			const updated = { ...mockDeployment, status: "deprecated" as const };
			vi.mocked(updateDeployment).mockResolvedValue(updated);

			const result = await updateDeploymentAction(1, {
				status: "deprecated",
			});

			expect(result).toEqual({ data: updated, error: null });
			expect(updateDeployment).toHaveBeenCalledWith(
				1,
				{ status: "deprecated" },
				{ jwt: "test-jwt-token" },
			);
		});
	});
});

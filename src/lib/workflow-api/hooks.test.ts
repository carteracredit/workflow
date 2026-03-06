import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

vi.mock("swr", () => ({
	default: vi.fn(),
}));

vi.mock("@/hooks/useWorkflowApiToken", () => ({
	useWorkflowApiToken: vi.fn(),
}));

vi.mock("@/lib/workflow-api/config", () => ({
	getWorkflowServiceUrl: () => "https://workflow-svc.carteracredit.workers.dev",
}));

vi.mock("@/lib/workflow-api/http", () => ({
	fetchJson: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Deferred imports (after mocks are set up)
// ---------------------------------------------------------------------------

import useSWR from "swr";
import { useWorkflowApiToken } from "@/hooks/useWorkflowApiToken";
import { useWorkflows, useWorkflow, useWorkflowVersions } from "./hooks";
import type { Workflow, WorkflowVersion } from "./types";

// ---------------------------------------------------------------------------
// Typed mocks
// ---------------------------------------------------------------------------

const mockUseSWR = vi.mocked(useSWR);
const mockUseApiToken = vi.mocked(useWorkflowApiToken);

const BASE = "https://workflow-svc.carteracredit.workers.dev";

const mockMutate = vi.fn();

function mockSWRReturn<T>(
	data: T | undefined,
	opts: { error?: Error; isLoading?: boolean } = {},
) {
	mockUseSWR.mockReturnValue({
		data,
		error: opts.error,
		isLoading: opts.isLoading ?? false,
		isValidating: false,
		mutate: mockMutate,
	} as unknown as ReturnType<typeof useSWR>);
}

function withToken(token: string | null = "test-jwt") {
	mockUseApiToken.mockReturnValue({
		token,
		isLoading: false,
		error: null,
		refetch: vi.fn(),
	});
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
});

describe("useWorkflows", () => {
	it("passes null SWR key when token is null", () => {
		withToken(null);
		mockSWRReturn<Workflow[]>(undefined);

		renderHook(() => useWorkflows());

		expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function));
	});

	it("passes correct URL as SWR key when token is present", () => {
		withToken("my-token");
		mockSWRReturn<Workflow[]>(undefined);

		renderHook(() => useWorkflows());

		const key = mockUseSWR.mock.calls[0][0];
		expect(key).toBe(`${BASE}/workflows`);
	});

	it("appends search param to key", () => {
		withToken("my-token");
		mockSWRReturn<Workflow[]>(undefined);

		renderHook(() => useWorkflows({ search: "credit" }));

		const key = mockUseSWR.mock.calls[0][0] as string;
		expect(key).toContain("search=credit");
	});

	it("appends status param to key", () => {
		withToken("my-token");
		mockSWRReturn<Workflow[]>(undefined);

		renderHook(() => useWorkflows({ status: "published" }));

		const key = mockUseSWR.mock.calls[0][0] as string;
		expect(key).toContain("status=published");
	});

	it("returns empty array when data is undefined", () => {
		withToken("my-token");
		mockSWRReturn<Workflow[]>(undefined);

		const { result } = renderHook(() => useWorkflows());

		expect(result.current.workflows).toEqual([]);
		expect(result.current.isLoading).toBe(false);
		expect(result.current.error).toBeUndefined();
	});

	it("returns workflows when SWR provides data", () => {
		const workflows = [{ id: "wf-uuid-001", name: "Test" }] as Workflow[];
		withToken("my-token");
		mockSWRReturn<Workflow[]>(workflows);

		const { result } = renderHook(() => useWorkflows());

		expect(result.current.workflows).toEqual(workflows);
	});

	it("forwards isLoading and error from SWR", () => {
		withToken("my-token");
		const err = new Error("network error");
		mockSWRReturn<Workflow[]>(undefined, { error: err, isLoading: true });

		const { result } = renderHook(() => useWorkflows());

		expect(result.current.isLoading).toBe(true);
		expect(result.current.error).toBe(err);
	});

	it("exposes mutate from SWR", () => {
		withToken("my-token");
		mockSWRReturn<Workflow[]>([]);

		const { result } = renderHook(() => useWorkflows());

		expect(result.current.mutate).toBe(mockMutate);
	});
});

describe("useWorkflow", () => {
	it("passes null key when token is null", () => {
		withToken(null);
		mockSWRReturn<Workflow>(undefined);

		renderHook(() => useWorkflow("wf-uuid-001"));

		expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function));
	});

	it("passes null key when id is null", () => {
		withToken("my-token");
		mockSWRReturn<Workflow>(undefined);

		renderHook(() => useWorkflow(null));

		expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function));
	});

	it("passes correct URL key for a given id", () => {
		withToken("my-token");
		mockSWRReturn<Workflow>(undefined);

		renderHook(() => useWorkflow("wf-uuid-042"));

		const key = mockUseSWR.mock.calls[0][0] as string;
		expect(key).toBe(`${BASE}/workflows/wf-uuid-042`);
	});

	it("returns null when data is undefined", () => {
		withToken("my-token");
		mockSWRReturn<Workflow>(undefined);

		const { result } = renderHook(() => useWorkflow("wf-uuid-001"));

		expect(result.current.workflow).toBeNull();
	});

	it("returns workflow object when SWR provides data", () => {
		const workflow = { id: "wf-uuid-005", name: "Credit App" } as Workflow;
		withToken("my-token");
		mockSWRReturn<Workflow>(workflow);

		const { result } = renderHook(() => useWorkflow("wf-uuid-005"));

		expect(result.current.workflow).toEqual(workflow);
	});

	it("exposes isLoading, error, and mutate", () => {
		withToken("my-token");
		const err = new Error("not found");
		mockSWRReturn<Workflow>(undefined, { error: err, isLoading: false });

		const { result } = renderHook(() => useWorkflow("wf-uuid-099"));

		expect(result.current.error).toBe(err);
		expect(result.current.isLoading).toBe(false);
		expect(result.current.mutate).toBe(mockMutate);
	});
});

describe("useWorkflowVersions", () => {
	it("passes null key when token is null", () => {
		withToken(null);
		mockSWRReturn<WorkflowVersion[]>(undefined);

		renderHook(() => useWorkflowVersions("wf-uuid-001"));

		expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function));
	});

	it("passes null key when workflowId is null", () => {
		withToken("my-token");
		mockSWRReturn<WorkflowVersion[]>(undefined);

		renderHook(() => useWorkflowVersions(null));

		expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function));
	});

	it("passes correct URL key with workflow_id param", () => {
		withToken("my-token");
		mockSWRReturn<WorkflowVersion[]>(undefined);

		renderHook(() => useWorkflowVersions("wf-uuid-007"));

		const key = mockUseSWR.mock.calls[0][0] as string;
		expect(key).toContain(`${BASE}/workflow-versions`);
		expect(key).toContain("workflow_id=wf-uuid-007");
	});

	it("returns empty array when data is undefined", () => {
		withToken("my-token");
		mockSWRReturn<WorkflowVersion[]>(undefined);

		const { result } = renderHook(() => useWorkflowVersions("wf-uuid-001"));

		expect(result.current.versions).toEqual([]);
	});

	it("returns versions array when SWR provides data", () => {
		const versions = [{ id: "ver-uuid-001", version: 1 }] as WorkflowVersion[];
		withToken("my-token");
		mockSWRReturn<WorkflowVersion[]>(versions);

		const { result } = renderHook(() => useWorkflowVersions("wf-uuid-003"));

		expect(result.current.versions).toEqual(versions);
	});
});

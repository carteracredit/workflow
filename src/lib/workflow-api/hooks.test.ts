import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Module mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------

vi.mock("swr", () => ({
	default: vi.fn(),
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
import {
	useWorkflows,
	useWorkflow,
	useWorkflowVersions,
	useWorkflowFlags,
} from "./hooks";
import type { Workflow, WorkflowVersion, WorkflowFlag } from "./types";

// ---------------------------------------------------------------------------
// Typed mocks
// ---------------------------------------------------------------------------

const mockUseSWR = vi.mocked(useSWR);

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
	vi.clearAllMocks();
});

describe("useWorkflows", () => {
	it("passes correct URL as SWR key", () => {
		mockSWRReturn<{ result: Workflow[]; resultInfo: unknown }>(undefined);

		renderHook(() => useWorkflows());

		const key = mockUseSWR.mock.calls[0][0];
		expect(key).toBe(`${BASE}/workflows`);
	});

	it("appends search param to key", () => {
		mockSWRReturn<{ result: Workflow[]; resultInfo: unknown }>(undefined);

		renderHook(() => useWorkflows({ search: "credit" }));

		const key = mockUseSWR.mock.calls[0][0] as string;
		expect(key).toContain("search=credit");
	});

	it("appends status param to key", () => {
		mockSWRReturn<{ result: Workflow[]; resultInfo: unknown }>(undefined);

		renderHook(() => useWorkflows({ status: "published" }));

		const key = mockUseSWR.mock.calls[0][0] as string;
		expect(key).toContain("status=published");
	});

	it("returns empty array when data is undefined", () => {
		mockSWRReturn<{ result: Workflow[]; resultInfo: unknown }>(undefined);

		const { result } = renderHook(() => useWorkflows());

		expect(result.current.workflows).toEqual([]);
		expect(result.current.isLoading).toBe(false);
		expect(result.current.error).toBeUndefined();
	});

	it("returns workflows when SWR provides data", () => {
		const workflows = [{ id: "wf-uuid-001", name: "Test" }] as Workflow[];
		const ri = { page: 1, per_page: 20, count: 1, total_count: 1 };
		mockSWRReturn<{ result: Workflow[]; resultInfo: typeof ri }>({
			result: workflows,
			resultInfo: ri,
		});

		const { result } = renderHook(() => useWorkflows());

		expect(result.current.workflows).toEqual(workflows);
		expect(result.current.resultInfo).toEqual(ri);
	});

	it("forwards isLoading and error from SWR", () => {
		const err = new Error("network error");
		mockSWRReturn<{ result: Workflow[]; resultInfo: unknown }>(undefined, {
			error: err,
			isLoading: true,
		});

		const { result } = renderHook(() => useWorkflows());

		expect(result.current.isLoading).toBe(true);
		expect(result.current.error).toBe(err);
	});

	it("exposes mutate from SWR", () => {
		mockSWRReturn<{ result: Workflow[]; resultInfo: unknown }>({
			result: [],
			resultInfo: { page: 1, per_page: 20, count: 0, total_count: 0 },
		});

		const { result } = renderHook(() => useWorkflows());

		expect(result.current.mutate).toBe(mockMutate);
	});
});

describe("useWorkflow", () => {
	it("passes null key when id is null", () => {
		mockSWRReturn<Workflow>(undefined);

		renderHook(() => useWorkflow(null));

		expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function));
	});

	it("passes correct URL key for a given id", () => {
		mockSWRReturn<Workflow>(undefined);

		renderHook(() => useWorkflow("wf-uuid-042"));

		const key = mockUseSWR.mock.calls[0][0] as string;
		expect(key).toBe(`${BASE}/workflows/wf-uuid-042`);
	});

	it("returns null when data is undefined", () => {
		mockSWRReturn<Workflow>(undefined);

		const { result } = renderHook(() => useWorkflow("wf-uuid-001"));

		expect(result.current.workflow).toBeNull();
	});

	it("returns workflow object when SWR provides data", () => {
		const workflow = { id: "wf-uuid-005", name: "Credit App" } as Workflow;
		mockSWRReturn<Workflow>(workflow);

		const { result } = renderHook(() => useWorkflow("wf-uuid-005"));

		expect(result.current.workflow).toEqual(workflow);
	});

	it("exposes isLoading, error, and mutate", () => {
		const err = new Error("not found");
		mockSWRReturn<Workflow>(undefined, { error: err, isLoading: false });

		const { result } = renderHook(() => useWorkflow("wf-uuid-099"));

		expect(result.current.error).toBe(err);
		expect(result.current.isLoading).toBe(false);
		expect(result.current.mutate).toBe(mockMutate);
	});
});

describe("useWorkflowVersions", () => {
	it("passes null key when workflowId is null", () => {
		mockSWRReturn<WorkflowVersion[]>(undefined);

		renderHook(() => useWorkflowVersions(null));

		expect(mockUseSWR).toHaveBeenCalledWith(null, expect.any(Function));
	});

	it("passes correct URL key with workflow_id param", () => {
		mockSWRReturn<WorkflowVersion[]>(undefined);

		renderHook(() => useWorkflowVersions("wf-uuid-007"));

		const key = mockUseSWR.mock.calls[0][0] as string;
		expect(key).toContain(`${BASE}/workflow-versions`);
		expect(key).toContain("workflow_id=wf-uuid-007");
	});

	it("returns empty array when data is undefined", () => {
		mockSWRReturn<WorkflowVersion[]>(undefined);

		const { result } = renderHook(() => useWorkflowVersions("wf-uuid-001"));

		expect(result.current.versions).toEqual([]);
	});

	it("returns versions array when SWR provides data", () => {
		const versions = [{ id: "ver-uuid-001", version: 1 }] as WorkflowVersion[];
		mockSWRReturn<WorkflowVersion[]>(versions);

		const { result } = renderHook(() => useWorkflowVersions("wf-uuid-003"));

		expect(result.current.versions).toEqual(versions);
	});
});

describe("useWorkflowFlags", () => {
	it("passes null key when workflowId is null", () => {
		mockSWRReturn<WorkflowFlag[]>(undefined);

		renderHook(() => useWorkflowFlags(null));

		expect(mockUseSWR).toHaveBeenCalledWith(
			null,
			expect.any(Function),
			expect.objectContaining({ refreshInterval: 10_000 }),
		);
	});

	it("passes correct URL key for a given workflowId", () => {
		mockSWRReturn<WorkflowFlag[]>(undefined);

		renderHook(() => useWorkflowFlags("wf-uuid-042"));

		const key = mockUseSWR.mock.calls[0][0] as string;
		expect(key).toBe(`${BASE}/workflows/wf-uuid-042/flags`);
		expect(mockUseSWR).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(Function),
			expect.objectContaining({ refreshInterval: 10_000 }),
		);
	});

	it("returns empty array when data is undefined", () => {
		mockSWRReturn<WorkflowFlag[]>(undefined);

		const { result } = renderHook(() => useWorkflowFlags("wf-uuid-001"));

		expect(result.current.flags).toEqual([]);
	});

	it("returns flags array when SWR provides data", () => {
		const flags: WorkflowFlag[] = [
			{
				id: "flag-uuid-001",
				workflow_id: "wf-uuid-001",
				name: "Feature X",
				sort_order: 0,
				created_at: "2024-01-01T00:00:00Z",
				updated_at: "2024-01-01T00:00:00Z",
				options: [],
				currentState: null,
			},
		];
		mockSWRReturn<WorkflowFlag[]>(flags);

		const { result } = renderHook(() => useWorkflowFlags("wf-uuid-001"));

		expect(result.current.flags).toEqual(flags);
	});

	it("forwards isLoading, error, and mutate", () => {
		const err = new Error("flags fetch failed");
		mockSWRReturn<WorkflowFlag[]>(undefined, { error: err, isLoading: true });

		const { result } = renderHook(() => useWorkflowFlags("wf-uuid-099"));

		expect(result.current.isLoading).toBe(true);
		expect(result.current.error).toBe(err);
		expect(result.current.mutate).toBe(mockMutate);
	});
});

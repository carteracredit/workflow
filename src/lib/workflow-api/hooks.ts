"use client";

import useSWR from "swr";
import { fetchJson } from "./http";
import { getWorkflowServiceUrl } from "./config";
import type {
	Workflow,
	WorkflowVersion,
	ApiResponse,
	ListApiResponse,
	ResultInfo,
	WorkflowFlag,
} from "./types";

export interface WorkflowStatusCounts {
	total: number;
	published: number;
	draft: number;
	archived: number;
}

// ---------------------------------------------------------------------------
// SWR key builders
// ---------------------------------------------------------------------------

function workflowsKey(params?: {
	search?: string;
	status?: string;
	page?: number;
	per_page?: number;
}): string {
	const base = `${getWorkflowServiceUrl()}/workflows`;
	const url = new URL(base);
	if (params?.search) url.searchParams.set("search", params.search);
	if (params?.status) url.searchParams.set("status", params.status);
	if (params?.page != null) url.searchParams.set("page", String(params.page));
	if (params?.per_page != null)
		url.searchParams.set("per_page", String(params.per_page));
	return url.toString();
}

function workflowKey(id: string | null): string | null {
	if (!id) return null;
	return `${getWorkflowServiceUrl()}/workflows/${id}`;
}

function workflowVersionsKey(workflowId: string | null): string | null {
	if (!workflowId) return null;
	return `${getWorkflowServiceUrl()}/workflow-versions?workflow_id=${workflowId}`;
}

function workflowFlagsKey(workflowId: string | null): string | null {
	if (!workflowId) return null;
	return `${getWorkflowServiceUrl()}/workflows/${workflowId}/flags`;
}

// ---------------------------------------------------------------------------
// Generic fetchers
// ---------------------------------------------------------------------------

async function apiFetcher<T>(url: string): Promise<T> {
	const { json } = await fetchJson<ApiResponse<T>>(url);
	return json.result;
}

async function apiListFetcher<T>(
	url: string,
): Promise<{ result: T[]; resultInfo: ResultInfo }> {
	const { json } = await fetchJson<ListApiResponse<T>>(url);
	return {
		result: json.result,
		resultInfo: json.result_info,
	};
}

async function workflowStatusCountsFetcher(): Promise<WorkflowStatusCounts> {
	const allWorkflows: Workflow[] = [];
	let page = 1;
	let totalPages = 1;

	while (page <= totalPages) {
		const { result, resultInfo } = await apiListFetcher<Workflow>(
			workflowsKey({ page }),
		);
		if (page === 1) {
			const safePerPage = Math.max(1, resultInfo.per_page);
			totalPages = Math.max(1, Math.ceil(resultInfo.total_count / safePerPage));
		}
		allWorkflows.push(...result);
		page += 1;
	}

	return allWorkflows.reduce<WorkflowStatusCounts>(
		(acc, wf) => {
			acc.total += 1;
			if (wf.status === "published") acc.published += 1;
			else if (wf.status === "draft") acc.draft += 1;
			else if (wf.status === "archived") acc.archived += 1;
			return acc;
		},
		{ total: 0, published: 0, draft: 0, archived: 0 },
	);
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Hook to list workflows with optional search, status filter and pagination.
 * Returns the current page of workflows plus full pagination metadata.
 */
export function useWorkflows(params?: {
	search?: string;
	status?: string;
	page?: number;
	per_page?: number;
}) {
	const key = workflowsKey(params);

	const { data, error, isLoading, mutate } = useSWR<{
		result: Workflow[];
		resultInfo: ResultInfo;
	}>(key, (url: string) => apiListFetcher<Workflow>(url));

	return {
		workflows: data?.result ?? [],
		resultInfo: data?.resultInfo ?? null,
		isLoading,
		error,
		mutate,
	};
}

/**
 * Hook to compute global workflow counts per status.
 * It fetches all pages from `/workflows` and derives counts from records,
 * avoiding reliance on backend-specific `total_count` semantics for filtered queries.
 */
export function useWorkflowStatusCounts() {
	const key = `${getWorkflowServiceUrl()}/workflows::__status_counts`;

	const { data, error, isLoading, mutate } = useSWR<WorkflowStatusCounts>(
		key,
		workflowStatusCountsFetcher,
	);

	return {
		counts: data ?? { total: 0, published: 0, draft: 0, archived: 0 },
		isLoading,
		error,
		mutate,
	};
}

/**
 * Hook to load a single workflow by ID.
 */
export function useWorkflow(id: string | null) {
	const key = workflowKey(id);

	const { data, error, isLoading, mutate } = useSWR<Workflow>(
		key,
		(url: string) => apiFetcher<Workflow>(url),
	);

	return {
		workflow: data ?? null,
		isLoading,
		error,
		mutate,
	};
}

/**
 * Hook to list all published versions of a workflow.
 */
export function useWorkflowVersions(workflowId: string | null) {
	const key = workflowVersionsKey(workflowId);

	const { data, error, isLoading, mutate } = useSWR<WorkflowVersion[]>(
		key,
		(url: string) => apiFetcher<WorkflowVersion[]>(url),
	);

	return {
		versions: data ?? [],
		isLoading,
		error,
		mutate,
	};
}

/**
 * Hook to list flags for a workflow with their options and runtime state.
 * Polls every 10 seconds to show up-to-date flag states.
 */
export function useWorkflowFlags(workflowId: string | null) {
	const key = workflowFlagsKey(workflowId);

	const { data, error, isLoading, mutate } = useSWR<WorkflowFlag[]>(
		key,
		(url: string) => apiFetcher<WorkflowFlag[]>(url),
		{ refreshInterval: 10_000 },
	);

	return {
		flags: data ?? [],
		isLoading,
		error,
		mutate,
	};
}

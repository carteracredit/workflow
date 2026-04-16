"use client";

import useSWR from "swr";
import { fetchJson } from "./http";
import { getWorkflowServiceUrl } from "./config";
import type {
	Workflow,
	WorkflowVersion,
	ApiResponse,
	WorkflowFlag,
} from "./types";

// ---------------------------------------------------------------------------
// SWR key builders
// ---------------------------------------------------------------------------

function workflowsKey(params?: { search?: string; status?: string }): string {
	const base = `${getWorkflowServiceUrl()}/workflows`;
	const url = new URL(base);
	if (params?.search) url.searchParams.set("search", params.search);
	if (params?.status) url.searchParams.set("status", params.status);
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
// Generic fetcher (JWT from tokenCache via fetchJson auto-JWT)
// ---------------------------------------------------------------------------

async function apiFetcher<T>(url: string): Promise<T> {
	const { json } = await fetchJson<ApiResponse<T>>(url);
	return json.result;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Hook to list workflows with optional search and status filter.
 */
export function useWorkflows(params?: { search?: string; status?: string }) {
	const key = workflowsKey(params);

	const { data, error, isLoading, mutate } = useSWR<Workflow[]>(
		key,
		(url: string) => apiFetcher<Workflow[]>(url),
	);

	return {
		workflows: data ?? [],
		data,
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

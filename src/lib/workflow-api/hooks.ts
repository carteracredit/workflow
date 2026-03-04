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
import { useWorkflowApiToken } from "@/hooks/useWorkflowApiToken";

// ---------------------------------------------------------------------------
// SWR key builders
// ---------------------------------------------------------------------------

function workflowsKey(
	jwt: string | null,
	params?: { search?: string; status?: string },
): string | null {
	if (!jwt) return null;
	const base = `${getWorkflowServiceUrl()}/workflows`;
	const url = new URL(base);
	if (params?.search) url.searchParams.set("search", params.search);
	if (params?.status) url.searchParams.set("status", params.status);
	return url.toString();
}

function workflowKey(jwt: string | null, id: string | null): string | null {
	if (!jwt || !id) return null;
	return `${getWorkflowServiceUrl()}/workflows/${id}`;
}

function workflowVersionsKey(
	jwt: string | null,
	workflowId: string | null,
): string | null {
	if (!jwt || !workflowId) return null;
	return `${getWorkflowServiceUrl()}/workflow-versions?workflow_id=${workflowId}`;
}

function workflowFlagsKey(
	jwt: string | null,
	workflowId: string | null,
): string | null {
	if (!jwt || !workflowId) return null;
	return `${getWorkflowServiceUrl()}/workflows/${workflowId}/flags`;
}

// ---------------------------------------------------------------------------
// Generic fetcher with JWT
// ---------------------------------------------------------------------------

async function apiFetcher<T>(url: string, jwt: string): Promise<T> {
	const { json } = await fetchJson<ApiResponse<T>>(url, { jwt });
	return json.result;
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Hook to list workflows with optional search and status filter.
 */
export function useWorkflows(params?: { search?: string; status?: string }) {
	const { token } = useWorkflowApiToken();
	const key = workflowsKey(token, params);

	const { data, error, isLoading, mutate } = useSWR<Workflow[]>(
		key,
		(url: string) => apiFetcher<Workflow[]>(url, token!),
	);

	return {
		workflows: data ?? [],
		isLoading,
		error,
		mutate,
	};
}

/**
 * Hook to load a single workflow by ID.
 */
export function useWorkflow(id: string | null) {
	const { token } = useWorkflowApiToken();
	const key = workflowKey(token, id);

	const { data, error, isLoading, mutate } = useSWR<Workflow>(
		key,
		(url: string) => apiFetcher<Workflow>(url, token!),
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
	const { token } = useWorkflowApiToken();
	const key = workflowVersionsKey(token, workflowId);

	const { data, error, isLoading, mutate } = useSWR<WorkflowVersion[]>(
		key,
		(url: string) => apiFetcher<WorkflowVersion[]>(url, token!),
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
	const { token } = useWorkflowApiToken();
	const key = workflowFlagsKey(token, workflowId);

	const { data, error, isLoading, mutate } = useSWR<WorkflowFlag[]>(
		key,
		(url: string) => apiFetcher<WorkflowFlag[]>(url, token!),
		{ refreshInterval: 10_000 },
	);

	return {
		flags: data ?? [],
		isLoading,
		error,
		mutate,
	};
}

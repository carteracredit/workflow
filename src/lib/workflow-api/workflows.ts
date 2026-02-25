import { fetchJson } from "./http";
import { getWorkflowServiceUrl } from "./config";
import type {
	Workflow,
	CreateWorkflowPayload,
	UpdateWorkflowPayload,
	ApiResponse,
	ApiCallOptions,
} from "./types";

export type { Workflow, CreateWorkflowPayload, UpdateWorkflowPayload };

export interface ListWorkflowsOptions extends ApiCallOptions {
	search?: string;
}

/**
 * Lists all workflows, optionally filtered by search query.
 */
export async function listWorkflows(
	options?: ListWorkflowsOptions,
): Promise<Workflow[]> {
	const baseUrl = getWorkflowServiceUrl();
	const url = new URL(`${baseUrl}/workflows`);
	if (options?.search) {
		url.searchParams.set("search", options.search);
	}

	const { json } = await fetchJson<ApiResponse<Workflow[]>>(url.toString(), {
		jwt: options?.jwt,
	});

	return json.result;
}

/**
 * Creates a new workflow.
 */
export async function createWorkflow(
	payload: CreateWorkflowPayload,
	options?: ApiCallOptions,
): Promise<Workflow> {
	const baseUrl = getWorkflowServiceUrl();

	const { json } = await fetchJson<ApiResponse<Workflow>>(
		`${baseUrl}/workflows`,
		{
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
			jwt: options?.jwt,
		},
	);

	return json.result;
}

/**
 * Gets a single workflow by ID.
 */
export async function getWorkflow(
	id: number,
	options?: ApiCallOptions,
): Promise<Workflow> {
	const baseUrl = getWorkflowServiceUrl();

	const { json } = await fetchJson<ApiResponse<Workflow>>(
		`${baseUrl}/workflows/${id}`,
		{ jwt: options?.jwt },
	);

	return json.result;
}

/**
 * Updates an existing workflow by ID.
 */
export async function updateWorkflow(
	id: number,
	payload: UpdateWorkflowPayload,
	options?: ApiCallOptions,
): Promise<Workflow> {
	const baseUrl = getWorkflowServiceUrl();

	const { json } = await fetchJson<ApiResponse<Workflow>>(
		`${baseUrl}/workflows/${id}`,
		{
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
			jwt: options?.jwt,
		},
	);

	return json.result;
}

/**
 * Deletes a workflow by ID.
 */
export async function deleteWorkflow(
	id: number,
	options?: ApiCallOptions,
): Promise<{ id: number }> {
	const baseUrl = getWorkflowServiceUrl();

	const { json } = await fetchJson<ApiResponse<{ id: number }>>(
		`${baseUrl}/workflows/${id}`,
		{
			method: "DELETE",
			jwt: options?.jwt,
		},
	);

	return json.result;
}

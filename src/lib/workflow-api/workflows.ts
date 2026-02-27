import { fetchJson } from "./http";
import { getWorkflowServiceUrl } from "./config";
import type {
	Workflow,
	WorkflowVersion,
	CreateWorkflowPayload,
	UpdateWorkflowPayload,
	PublishWorkflowResponse,
	ApiResponse,
	ApiCallOptions,
} from "./types";

export type {
	Workflow,
	WorkflowVersion,
	CreateWorkflowPayload,
	UpdateWorkflowPayload,
	PublishWorkflowResponse,
};

export interface ListWorkflowsOptions extends ApiCallOptions {
	search?: string;
	status?: "draft" | "published" | "archived";
}

/**
 * Lists all workflows, optionally filtered by search query and status.
 */
export async function listWorkflows(
	options?: ListWorkflowsOptions,
): Promise<Workflow[]> {
	const baseUrl = getWorkflowServiceUrl();
	const url = new URL(`${baseUrl}/workflows`);
	if (options?.search) {
		url.searchParams.set("search", options.search);
	}
	if (options?.status) {
		url.searchParams.set("status", options.status);
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
 * Publishes a workflow by pushing generated TypeScript code to GitHub
 * and triggering a Cloudflare Workers deployment via GitHub Actions.
 *
 * Sends the current definition JSON alongside the code so the backend
 * always saves the latest state even if the user never hit "Save".
 *
 * Returns a skipped response when no code changes are detected.
 */
export async function publishWorkflow(
	id: number,
	payload: {
		code: string;
		environment: "development" | "production";
		definition?: string;
	},
	options?: ApiCallOptions,
): Promise<PublishWorkflowResponse> {
	const baseUrl = getWorkflowServiceUrl();

	const { json } = await fetchJson<ApiResponse<PublishWorkflowResponse>>(
		`${baseUrl}/workflows/${id}/publish`,
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

/**
 * Lists all published versions of a workflow.
 */
export async function listWorkflowVersions(
	workflowId: number,
	options?: ApiCallOptions,
): Promise<WorkflowVersion[]> {
	const baseUrl = getWorkflowServiceUrl();
	const url = new URL(`${baseUrl}/workflow-versions`);
	url.searchParams.set("workflow_id", String(workflowId));

	const { json } = await fetchJson<ApiResponse<WorkflowVersion[]>>(
		url.toString(),
		{ jwt: options?.jwt },
	);

	return json.result;
}

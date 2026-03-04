import { fetchJson } from "./http";
import { getWorkflowServiceUrl } from "./config";
import type {
	ApiCallOptions,
	ApiResponse,
	CreateFlagPayload,
	UpdateFlagPayload,
	WorkflowFlag,
} from "./types";

export type {
	WorkflowFlag,
	WorkflowFlagOption,
	WorkflowFlagState,
} from "./types";

/**
 * GET /workflows/:id/flags
 * Returns all flags for a workflow with their options and current runtime state.
 */
export async function listFlags(
	workflowId: string,
	options?: ApiCallOptions,
): Promise<WorkflowFlag[]> {
	const baseUrl = getWorkflowServiceUrl();
	const { json } = await fetchJson<ApiResponse<WorkflowFlag[]>>(
		`${baseUrl}/workflows/${workflowId}/flags`,
		{ jwt: options?.jwt },
	);
	return json.result;
}

/**
 * POST /workflows/:id/flags
 * Creates a new flag with options and initializes its runtime state.
 */
export async function createFlag(
	workflowId: string,
	payload: CreateFlagPayload,
	options?: ApiCallOptions,
): Promise<WorkflowFlag> {
	const baseUrl = getWorkflowServiceUrl();
	const { json } = await fetchJson<ApiResponse<WorkflowFlag>>(
		`${baseUrl}/workflows/${workflowId}/flags`,
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
 * PUT /workflows/:id/flags/:flagId
 * Updates a flag's name and options.
 */
export async function updateFlag(
	workflowId: string,
	flagId: string,
	payload: UpdateFlagPayload,
	options?: ApiCallOptions,
): Promise<WorkflowFlag> {
	const baseUrl = getWorkflowServiceUrl();
	const { json } = await fetchJson<ApiResponse<WorkflowFlag>>(
		`${baseUrl}/workflows/${workflowId}/flags/${flagId}`,
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
 * DELETE /workflows/:id/flags/:flagId
 * Deletes a flag along with its options and runtime state.
 */
export async function deleteFlag(
	workflowId: string,
	flagId: string,
	options?: ApiCallOptions,
): Promise<void> {
	const baseUrl = getWorkflowServiceUrl();
	await fetchJson<ApiResponse<{ deleted: boolean }>>(
		`${baseUrl}/workflows/${workflowId}/flags/${flagId}`,
		{
			method: "DELETE",
			jwt: options?.jwt,
		},
	);
}

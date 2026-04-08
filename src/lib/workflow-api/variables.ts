import { fetchJson } from "./http";
import { getWorkflowServiceUrl } from "./config";
import type {
	ApiCallOptions,
	ApiResponse,
	CreateVariablePayload,
	UpdateVariablePayload,
	WorkflowVariable,
	RotateSecretPayload,
} from "./types";

export type {
	WorkflowVariable,
	CreateVariablePayload,
	UpdateVariablePayload,
	RotateSecretPayload,
} from "./types";

/**
 * GET /workflows/:id/variables
 * Returns all draft variables and secrets for a workflow.
 * For secrets, value is always null.
 */
export async function listVariables(
	workflowId: string,
	options?: ApiCallOptions,
): Promise<WorkflowVariable[]> {
	const baseUrl = getWorkflowServiceUrl();
	const { json } = await fetchJson<ApiResponse<WorkflowVariable[]>>(
		`${baseUrl}/workflows/${workflowId}/variables`,
		{ jwt: options?.jwt },
	);
	return json.result;
}

/**
 * POST /workflows/:id/variables
 * Creates a new variable or secret in draft state.
 */
export async function createVariable(
	workflowId: string,
	payload: CreateVariablePayload,
	options?: ApiCallOptions,
): Promise<WorkflowVariable> {
	const baseUrl = getWorkflowServiceUrl();
	const { json } = await fetchJson<ApiResponse<WorkflowVariable>>(
		`${baseUrl}/workflows/${workflowId}/variables`,
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
 * PUT /workflows/:id/variables/:varId
 * Updates a draft variable or secret.
 */
export async function updateVariable(
	workflowId: string,
	varId: string,
	payload: UpdateVariablePayload,
	options?: ApiCallOptions,
): Promise<WorkflowVariable> {
	const baseUrl = getWorkflowServiceUrl();
	const { json } = await fetchJson<ApiResponse<WorkflowVariable>>(
		`${baseUrl}/workflows/${workflowId}/variables/${varId}`,
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
 * DELETE /workflows/:id/variables/:varId
 * Deletes a draft variable or secret.
 */
export async function deleteVariable(
	workflowId: string,
	varId: string,
	options?: ApiCallOptions,
): Promise<void> {
	const baseUrl = getWorkflowServiceUrl();
	await fetchJson<ApiResponse<{ deleted: boolean }>>(
		`${baseUrl}/workflows/${workflowId}/variables/${varId}`,
		{
			method: "DELETE",
			jwt: options?.jwt,
		},
	);
}

/**
 * POST /workflows/:id/variables/sync
 * Syncs all variables (non-secrets from D1 + provided secret values) to all
 * active deployed workers. Use this after a deployment completes when the
 * automatic sync at publish time may have failed.
 */
export async function syncAllVariables(
	workflowId: string,
	payload: { secretValues?: Record<string, string> },
	options?: ApiCallOptions,
): Promise<{ synced: string[]; failed: string[]; variableCount: number }> {
	const baseUrl = getWorkflowServiceUrl();
	const { json } = await fetchJson<
		ApiResponse<{
			synced: string[];
			failed: string[];
			variableCount: number;
			message?: string;
		}>
	>(`${baseUrl}/workflows/${workflowId}/variables/sync`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
		jwt: options?.jwt,
	});
	return json.result;
}
export async function rotateSecret(
	workflowId: string,
	payload: RotateSecretPayload,
	options?: ApiCallOptions,
): Promise<{ secret: string; synced: string[]; failed: string[] }> {
	const baseUrl = getWorkflowServiceUrl();
	const { json } = await fetchJson<
		ApiResponse<{ secret: string; synced: string[]; failed: string[] }>
	>(`${baseUrl}/workflows/${workflowId}/variables/rotate-secrets`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
		jwt: options?.jwt,
	});
	return json.result;
}

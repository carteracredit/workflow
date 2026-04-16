import { fetchJson } from "./http";
import { getWorkflowServiceUrl } from "./config";
import type {
	WorkflowDeployment,
	CreateWorkflowDeploymentPayload,
	UpdateWorkflowDeploymentPayload,
	ApiResponse,
	ApiCallOptions,
} from "./types";

export type {
	WorkflowDeployment,
	CreateWorkflowDeploymentPayload,
	UpdateWorkflowDeploymentPayload,
};

export interface ListDeploymentsOptions extends ApiCallOptions {
	search?: string;
}

/**
 * Lists all workflow deployments, optionally filtered by search query.
 */
export async function listDeployments(
	options?: ListDeploymentsOptions,
): Promise<WorkflowDeployment[]> {
	const baseUrl = getWorkflowServiceUrl();
	const url = new URL(`${baseUrl}/workflow-deployments`);
	if (options?.search) {
		url.searchParams.set("search", options.search);
	}

	const { json } = await fetchJson<ApiResponse<WorkflowDeployment[]>>(
		url.toString(),
		{ jwt: options?.jwt },
	);

	return json.result;
}

/**
 * Creates a new workflow deployment.
 */
export async function createDeployment(
	payload: CreateWorkflowDeploymentPayload,
	options?: ApiCallOptions,
): Promise<WorkflowDeployment> {
	const baseUrl = getWorkflowServiceUrl();

	const { json } = await fetchJson<ApiResponse<WorkflowDeployment>>(
		`${baseUrl}/workflow-deployments`,
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
 * Gets a single workflow deployment by ID.
 */
export async function getDeployment(
	id: string,
	options?: ApiCallOptions,
): Promise<WorkflowDeployment> {
	const baseUrl = getWorkflowServiceUrl();

	const { json } = await fetchJson<ApiResponse<WorkflowDeployment>>(
		`${baseUrl}/workflow-deployments/${id}`,
		{ jwt: options?.jwt },
	);

	return json.result;
}

/**
 * Updates a workflow deployment status or deployed_at timestamp.
 */
export async function updateDeployment(
	id: string,
	payload: UpdateWorkflowDeploymentPayload,
	options?: ApiCallOptions,
): Promise<WorkflowDeployment> {
	const baseUrl = getWorkflowServiceUrl();

	const { json } = await fetchJson<ApiResponse<WorkflowDeployment>>(
		`${baseUrl}/workflow-deployments/${id}`,
		{
			method: "PUT",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
			jwt: options?.jwt,
		},
	);

	return json.result;
}

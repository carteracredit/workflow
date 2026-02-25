/**
 * Workflow entity as returned by workflow-svc
 */
export interface Workflow {
	id: number;
	name: string;
	slug: string;
	description: string;
	github_repo_url: string | null;
	class_name: string;
	current_major_version: number;
	created_at: string;
	updated_at: string;
}

/**
 * Payload for creating a new workflow
 */
export interface CreateWorkflowPayload {
	name: string;
	slug: string;
	description: string;
	github_repo_url?: string | null;
	class_name: string;
	current_major_version: number;
}

/**
 * Payload for updating an existing workflow (all fields optional)
 */
export type UpdateWorkflowPayload = Partial<CreateWorkflowPayload>;

/**
 * Workflow deployment entity as returned by workflow-svc
 */
export interface WorkflowDeployment {
	id: number;
	workflow_id: number;
	major_version: number;
	semver: string;
	environment: "development" | "production";
	worker_name: string;
	status: "deploying" | "active" | "deprecated" | "retired";
	deployed_at: string | null;
	created_at: string;
	updated_at: string;
}

/**
 * Payload for creating a new workflow deployment
 */
export interface CreateWorkflowDeploymentPayload {
	workflow_id: number;
	major_version: number;
	semver: string;
	environment: "development" | "production";
	worker_name: string;
	status: "deploying" | "active" | "deprecated" | "retired";
}

/**
 * Payload for updating a workflow deployment
 */
export interface UpdateWorkflowDeploymentPayload {
	status?: "deploying" | "active" | "deprecated" | "retired";
	deployed_at?: string | null;
}

/**
 * Response from POST /workflows/:id/publish
 */
export interface PublishWorkflowResponse {
	deployment: WorkflowDeployment;
	repo_url: string | null;
	worker_name: string;
	branch: string;
}

/**
 * Standard API response envelope from workflow-svc
 */
export interface ApiResponse<T> {
	success: boolean;
	result: T;
}

/**
 * Options for API calls that require authentication
 */
export interface ApiCallOptions {
	jwt?: string;
}

/**
 * Workflow entity as returned by workflow-svc
 */
export interface Workflow {
	id: string;
	name: string;
	slug: string;
	description: string;
	status: "draft" | "published" | "archived";
	definition?: string | null;
	published_code_checksum?: string | null;
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
	status?: "draft" | "published" | "archived";
	definition?: string | null;
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
	id: string;
	workflow_id: string;
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
 * Workflow version snapshot as returned by workflow-svc
 */
export interface WorkflowVersion {
	id: string;
	workflow_id: string;
	version: number;
	definition: string;
	code_checksum: string;
	created_by: string | null;
	created_at: string;
}

/**
 * Payload for creating a new workflow deployment
 */
export interface CreateWorkflowDeploymentPayload {
	workflow_id: string;
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
 * Response when publish was skipped (no code changes detected)
 */
export interface PublishWorkflowSkippedResponse {
	skipped: true;
	reason: "no_changes";
	current_version: number;
}

/**
 * Response when publish succeeded (code was deployed)
 */
export interface PublishWorkflowDeployedResponse {
	skipped: false;
	deployment: WorkflowDeployment;
	repo_url: string | null;
	worker_name: string;
	branch: string;
	version: number;
}

/**
 * Response from POST /workflows/:id/publish
 */
export type PublishWorkflowResponse =
	| PublishWorkflowSkippedResponse
	| PublishWorkflowDeployedResponse;

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

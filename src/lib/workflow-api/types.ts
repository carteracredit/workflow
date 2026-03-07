/**
 * Workflow entity as returned by workflow-svc
 */
export interface Workflow {
	id: string;
	name: string;
	slug: string;
	description: string;
	status: "draft" | "published" | "archived";
	definition?: Record<string, unknown> | null;
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
	definition?: Record<string, unknown> | null;
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
	definition: Record<string, unknown>;
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

// ---------------------------------------------------------------------------
// Flag types
// ---------------------------------------------------------------------------

/**
 * A flag option (one of N possible values for a flag)
 */
export interface WorkflowFlagOption {
	id: string;
	label: string;
	color: string;
	sort_order: number;
}

/**
 * Runtime state of a flag (which option is currently active)
 */
export interface WorkflowFlagState {
	optionId: string;
	updatedAt: string;
	updatedByInstanceId: string | null;
}

/**
 * A flag with its options and current runtime state as returned by workflow-svc
 */
export interface WorkflowFlag {
	id: string;
	workflow_id: string;
	name: string;
	sort_order: number;
	created_at: string;
	updated_at: string;
	options: WorkflowFlagOption[];
	currentState: WorkflowFlagState | null;
}

/**
 * Payload for creating a flag
 */
export interface CreateFlagPayload {
	id: string;
	name: string;
	options: Array<{
		id: string;
		label: string;
		color: string;
		sort_order?: number;
	}>;
	sort_order?: number;
}

/**
 * Payload for updating a flag
 */
export interface UpdateFlagPayload {
	name: string;
	options: Array<{
		id: string;
		label: string;
		color: string;
		sort_order?: number;
	}>;
	sort_order?: number;
}

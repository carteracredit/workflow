/**
 * Gets the workflow service URL from environment variables.
 *
 * Configure NEXT_PUBLIC_WORKFLOW_SERVICE_URL in your environment.
 * This variable is available on both client and server.
 *
 * Falls back to the dev environment URL for local development.
 *
 * @returns The base URL for workflow-svc (e.g., https://workflow-svc.carteracredit.workers.dev)
 */
export const getWorkflowServiceUrl = (): string => {
	return (
		process.env.NEXT_PUBLIC_WORKFLOW_SERVICE_URL ||
		"https://workflow-svc.carteracredit.workers.dev"
	);
};

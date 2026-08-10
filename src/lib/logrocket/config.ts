/**
 * LogRocket configuration resolved from environment variables.
 * Build-time env vars: NEXT_PUBLIC_LOGROCKET_APP_ID, NEXT_PUBLIC_LOGROCKET_ROOT_HOSTNAME,
 * NEXT_PUBLIC_ENVIRONMENT, NEXT_PUBLIC_COMMIT_SHA.
 */
export interface LogRocketConfig {
	/** false when NEXT_PUBLIC_LOGROCKET_APP_ID is unset — never throws. */
	enabled: boolean;
	appId: string;
	rootHostname: string;
	environment: string;
	/** e.g. `workflow-production-abc1234` (no @ — LogRocket rejects it). */
	release: string;
}

/**
 * Pure resolver for the LogRocket configuration — never throws, never logs.
 * Callers decide what to do when `enabled` is false (typically: skip init).
 */
export const getLogRocketConfig = (): LogRocketConfig => {
	const appId = process.env.NEXT_PUBLIC_LOGROCKET_APP_ID ?? "";
	const rootHostname = process.env.NEXT_PUBLIC_LOGROCKET_ROOT_HOSTNAME ?? "";
	const environment = (
		process.env.NEXT_PUBLIC_ENVIRONMENT ||
		process.env.NODE_ENV ||
		"development"
	).trim();
	const commitSha = process.env.NEXT_PUBLIC_COMMIT_SHA?.trim() || undefined;
	// LogRocket release versions are capped at 60 chars; use short SHA.
	const shortSha = commitSha ? commitSha.slice(0, 7) : "local";

	return {
		enabled: appId !== "",
		appId,
		rootHostname,
		environment,
		release: `workflow-${environment}-${shortSha}`,
	};
};

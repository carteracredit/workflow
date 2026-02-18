/**
 * Gets the auth service URL from environment variables.
 *
 * For Cloudflare Workers deployment, configure NEXT_PUBLIC_AUTH_SERVICE_URL
 * in your environment. This variable is available on both client and server.
 *
 * Falls back to the dev environment URL for local development and Storybook.
 *
 * @returns The base URL for the auth service (e.g., https://auth-svc.example.workers.dev)
 */
export const getAuthServiceUrl = (): string => {
	return (
		process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ||
		"https://auth-svc.carteracredit.workers.dev"
	);
};

/**
 * Gets the auth app URL from environment variables.
 *
 * The auth app is the frontend for authentication (login, signup, etc.).
 * Users are redirected here when they need to authenticate.
 *
 * @returns The base URL for the auth app (e.g., https://auth.carteracredit.workers.dev)
 */
export const getAuthAppUrl = (): string => {
	return (
		process.env.NEXT_PUBLIC_AUTH_APP_URL ||
		"https://auth.carteracredit.workers.dev"
	);
};

/**
 * Derives the environment name from the auth service URL for display purposes.
 * @returns "dev" or "prod" based on the URL pattern
 */
export const getEnvironment = (): "dev" | "prod" => {
	const baseUrl = getAuthServiceUrl();
	if (baseUrl.includes(".carteracredit.com")) {
		return "prod";
	}
	return "dev";
};

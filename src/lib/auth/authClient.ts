"use client";

import { createAuthClient } from "better-auth/client";
import { jwtClient } from "better-auth/client/plugins";

import { getAuthServiceUrl } from "./config";

/**
 * Better Auth client instance with JWT plugin.
 *
 * Single source of truth for the Better Auth client. All auth operations
 * should use this instance to ensure consistent configuration.
 *
 * The `credentials: "include"` option is critical for cross-origin
 * cookie-based authentication between workflow app and auth-svc.
 *
 * Plugins:
 * - jwtClient: Enables JWT token exchange for API authentication.
 */
export const authClient = createAuthClient({
	baseURL: getAuthServiceUrl(),
	fetchOptions: {
		credentials: "include",
	},
	plugins: [jwtClient()],
});

export type AuthClient = typeof authClient;

/**
 * Get JWT token for client-side API calls to workflow-svc.
 * Uses the jwtClient plugin to exchange the session cookie for a JWT.
 * @returns JWT token or null if not authenticated
 */
export async function getClientJwt(): Promise<string | null> {
	try {
		const result = await authClient.token();
		if (result.error || !result.data?.token) {
			console.error("Failed to get JWT:", result.error);
			return null;
		}
		return result.data.token;
	} catch (error) {
		console.error("Error fetching JWT:", error);
		return null;
	}
}

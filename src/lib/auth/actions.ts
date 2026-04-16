"use client";

import { authClient } from "./authClient";
import { clearSession } from "./sessionStore";
import { getAuthAppUrl } from "./config";

/**
 * Sign out the current user and redirect to auth app login.
 *
 * Clears local session state and redirects to the auth app.
 * The redirect URL is preserved so user can return after re-authentication.
 */
export async function logout(): Promise<void> {
	const authAppUrl = getAuthAppUrl();

	try {
		await authClient.signOut({
			fetchOptions: {
				onSuccess: () => {
					// Clear local session state
					clearSession();
					// Redirect to auth app login
					window.location.href = `${authAppUrl}/login`;
				},
			},
		});
	} catch {
		// If signOut fails, still clear session and redirect
		clearSession();
		window.location.href = `${authAppUrl}/login`;
	}
}

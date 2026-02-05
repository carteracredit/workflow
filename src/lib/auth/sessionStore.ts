import { atom } from "nanostores";
import type { Session } from "./types";
import { isAdminRole } from "./types";

/**
 * Session state for client-side state management.
 */
type SessionState = {
	/** Session data (null when not authenticated) */
	data: Session;
	/** Error from session operations */
	error: Error | null;
	/** Whether session is being loaded */
	isPending: boolean;
	/** Whether the current user is an admin */
	isAdmin: boolean;
};

/**
 * Client-side session store using nanostores.
 *
 * Provides reactive session state for components.
 * Admin status is automatically derived from the session data.
 */
export const sessionStore = atom<SessionState>({
	data: null,
	error: null,
	isPending: true,
	isAdmin: false,
});

/**
 * Set session data in the store.
 * Automatically updates admin status.
 */
export function setSession(session: Session) {
	sessionStore.set({
		data: session,
		error: null,
		isPending: false,
		isAdmin: session ? isAdminRole(session.user.role) : false,
	});
}

/**
 * Clear session data from the store.
 */
export function clearSession() {
	sessionStore.set({
		data: null,
		error: null,
		isPending: false,
		isAdmin: false,
	});
}

/**
 * Set session loading state.
 */
export function setSessionPending(isPending: boolean) {
	sessionStore.set({
		...sessionStore.get(),
		isPending,
	});
}

/**
 * Set session error.
 */
export function setSessionError(error: Error) {
	sessionStore.set({
		...sessionStore.get(),
		error,
		isPending: false,
	});
}

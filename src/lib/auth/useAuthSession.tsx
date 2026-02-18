"use client";

import { useStore } from "@nanostores/react";
import { useRef } from "react";
import { sessionStore } from "./sessionStore";
import type { Session } from "./types";
import { isAdminRole } from "./types";

/**
 * Hydrator component - use in root layout to bridge server session to client store.
 *
 * This component hydrates the client-side session store with the server-fetched session
 * on initial page load, enabling reactive session state throughout the app.
 */
export function SessionHydrator({
	serverSession,
	children,
}: {
	serverSession: Session;
	children: React.ReactNode;
}) {
	const hydrated = useRef(false);

	if (!hydrated.current && typeof window !== "undefined") {
		sessionStore.set({
			data: serverSession,
			error: null,
			isPending: false,
			isAdmin: serverSession ? isAdminRole(serverSession.user.role) : false,
		});
		hydrated.current = true;
	}

	return <>{children}</>;
}

/**
 * Hook to access session in components.
 *
 * Returns the current session state including:
 * - data: The session data (null if not authenticated)
 * - error: Any error from session operations
 * - isPending: Whether the session is being loaded
 * - isAdmin: Whether the current user has admin role
 */
export function useAuthSession() {
	const { data, error, isPending, isAdmin } = useStore(sessionStore);
	return { data, error, isPending, isAdmin };
}

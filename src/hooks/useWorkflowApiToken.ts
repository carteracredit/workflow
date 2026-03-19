"use client";

import { useStore } from "@nanostores/react";
import { useEffect, useCallback } from "react";
import { getClientJwtCached, tokenStore } from "@/lib/auth/tokenStore";

interface UseWorkflowApiTokenResult {
	token: string | null;
	isLoading: boolean;
	error: Error | null;
	refetch: () => Promise<void>;
}

/**
 * React hook for client components to get a JWT token for workflow-svc API calls.
 *
 * Uses the token store singleton so all consumers share one token. Token is
 * invalidated when session changes (clearSession/setSession) and refetched when
 * the tab becomes visible, so no hard refresh is needed.
 *
 * @example
 * ```tsx
 * function WorkflowEditor() {
 *   const { token, isLoading } = useWorkflowApiToken();
 *
 *   const handleSave = async () => {
 *     if (!token) return;
 *     await createWorkflow(payload, { jwt: token });
 *   };
 * }
 * ```
 */
export function useWorkflowApiToken(): UseWorkflowApiTokenResult {
	const { token, isPending, error } = useStore(tokenStore);

	const refetch = useCallback(async () => {
		await getClientJwtCached(true);
	}, []);

	// Ensure token is loaded on mount (or when store was invalidated)
	useEffect(() => {
		void getClientJwtCached();
	}, []);

	// Refetch when tab becomes visible so re-auth or session refresh elsewhere is picked up
	useEffect(() => {
		const handleVisibility = () => {
			if (
				typeof document !== "undefined" &&
				document.visibilityState === "visible"
			) {
				void getClientJwtCached(true);
			}
		};
		document.addEventListener("visibilitychange", handleVisibility);
		return () =>
			document.removeEventListener("visibilitychange", handleVisibility);
	}, []);

	return {
		token,
		isLoading: isPending,
		error,
		refetch,
	};
}

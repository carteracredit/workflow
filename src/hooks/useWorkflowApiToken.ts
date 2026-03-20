"use client";

import { useState, useEffect, useCallback } from "react";
import { tokenCache } from "@/lib/auth/tokenCache";

interface UseWorkflowApiTokenResult {
	token: string | null;
	isLoading: boolean;
	error: Error | null;
	refetch: () => Promise<void>;
}

/**
 * React hook for client components to get a JWT token for workflow-svc API calls.
 *
 * Uses the shared token cache so all consumers share one token. Token is
 * invalidated when session changes (clearSession/setSession). Visibility and
 * a 10-min interval keep the token fresh without forcing a network call on
 * every tab focus.
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
	const [token, setToken] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<Error | null>(null);

	const fetchJwt = useCallback(async (forceRefresh: boolean = false) => {
		try {
			setIsLoading(true);
			setError(null);
			const t = await tokenCache.getToken(null, forceRefresh);
			setToken(t);
		} catch (err) {
			setError(err instanceof Error ? err : new Error("Failed to fetch JWT"));
			setToken(null);
		} finally {
			setIsLoading(false);
		}
	}, []);

	// Load token on mount (uses cache if valid)
	useEffect(() => {
		void fetchJwt(false);
	}, [fetchJwt]);

	// Refresh when tab becomes visible — cache-respecting, no forced network call
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				void fetchJwt();
			}
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, [fetchJwt]);

	// Proactively refresh every 10 minutes (JWT TTL 15 min; cache stale 5 min)
	useEffect(() => {
		const interval = setInterval(
			() => {
				void fetchJwt();
			},
			10 * 60 * 1000,
		);
		return () => clearInterval(interval);
	}, [fetchJwt]);

	return {
		token,
		isLoading,
		error,
		refetch: () => fetchJwt(true),
	};
}

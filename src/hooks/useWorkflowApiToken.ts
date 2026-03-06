"use client";

import { useState, useEffect, useCallback } from "react";
import { getClientJwt } from "@/lib/auth/authClient";

interface UseWorkflowApiTokenResult {
	token: string | null;
	isLoading: boolean;
	error: Error | null;
	refetch: () => Promise<void>;
}

/**
 * React hook for client components to get a JWT token for workflow-svc API calls.
 *
 * Uses the Better Auth jwtClient plugin to exchange the session cookie for a JWT,
 * which is then passed as `Authorization: Bearer <token>` to workflow-svc.
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

	const fetchToken = useCallback(async () => {
		try {
			setIsLoading(true);
			setError(null);
			const jwt = await getClientJwt();
			setToken(jwt);
		} catch (err) {
			setError(err instanceof Error ? err : new Error("Failed to fetch token"));
			setToken(null);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchToken();
	}, [fetchToken]);

	return { token, isLoading, error, refetch: fetchToken };
}

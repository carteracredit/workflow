"use client";

import { atom } from "nanostores";
import { getClientJwt } from "./authClient";

/** TTL for cached JWT (ms). Slightly under typical JWT expiry to avoid using an expired token. */
const TOKEN_TTL_MS = 50_000;

export type TokenState = {
	token: string | null;
	expiresAt: number;
	isPending: boolean;
	error: Error | null;
};

const initialState: TokenState = {
	token: null,
	expiresAt: 0,
	isPending: false,
	error: null,
};

/**
 * Client-side token store (singleton). Single source of truth for the JWT
 * used for workflow-svc API calls. Invalidated when session changes so token
 * refetches without hard refresh.
 */
export const tokenStore = atom<TokenState>({ ...initialState });

/**
 * Clears the cached token. Call from sessionStore on clearSession/setSession
 * so the next read refetches (token refresh without hard refresh).
 */
export function clearTokenStore(): void {
	tokenStore.set({ ...initialState });
}

let fetchPromise: Promise<string | null> | null = null;

/**
 * Returns the current JWT, from cache if valid or by fetching. Updates tokenStore.
 * @param forceRefetch - If true, ignore cache and always fetch (e.g. on tab visible).
 */
export async function getClientJwtCached(
	forceRefetch = false,
): Promise<string | null> {
	const now = Date.now();
	const state = tokenStore.get();

	if (!forceRefetch && state.token && state.expiresAt > now) {
		return state.token;
	}

	// Dedupe concurrent fetches
	if (fetchPromise) {
		const token = await fetchPromise;
		return token;
	}

	tokenStore.set({ ...tokenStore.get(), isPending: true, error: null });
	fetchPromise = getClientJwt()
		.then((token) => {
			tokenStore.set({
				token,
				expiresAt: token ? now + TOKEN_TTL_MS : 0,
				isPending: false,
				error: null,
			});
			return token;
		})
		.catch((err) => {
			const error =
				err instanceof Error ? err : new Error("Failed to fetch token");
			tokenStore.set({
				token: null,
				expiresAt: 0,
				isPending: false,
				error,
			});
			return null;
		})
		.finally(() => {
			fetchPromise = null;
		});

	return fetchPromise;
}

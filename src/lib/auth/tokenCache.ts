"use client";

import { getClientJwt } from "./authClient";

/**
 * Token cache entry with expiration tracking
 */
interface TokenCacheEntry {
	token: string;
	fetchedAt: number;
	organizationId: string | null;
}

/**
 * Shared token cache to prevent duplicate token requests.
 * Tokens are cached for a configurable duration (default: 5 minutes).
 * Cache is automatically invalidated when organization changes.
 */
class TokenCache {
	private cache: TokenCacheEntry | null = null;
	private fetchPromise: Promise<string | null> | null = null;
	private readonly staleTimeout: number;

	constructor(staleTimeoutMs: number = 5 * 60 * 1000) {
		// Default: 5 minutes
		this.staleTimeout = staleTimeoutMs;
	}

	/**
	 * Get a valid token from cache or fetch a new one.
	 * Returns cached token if it exists and is not stale.
	 * Otherwise, fetches a new token (deduplicates concurrent requests).
	 *
	 * @param organizationId - Current organization ID to validate cache key
	 * @param forceRefresh - Force a new fetch even if cache is valid
	 * @returns JWT token or null
	 */
	async getToken(
		organizationId: string | null,
		forceRefresh: boolean = false,
	): Promise<string | null> {
		// Check if cache is valid and matches current organization
		if (
			!forceRefresh &&
			this.cache &&
			this.cache.organizationId === organizationId &&
			Date.now() - this.cache.fetchedAt < this.staleTimeout
		) {
			return this.cache.token;
		}

		// If cache is for a different organization, clear it
		if (this.cache && this.cache.organizationId !== organizationId) {
			this.clear();
		}

		// If there's already a fetch in progress, wait for it
		if (this.fetchPromise) {
			return this.fetchPromise;
		}

		// Start a new fetch
		this.fetchPromise = this.fetchAndCache(organizationId);

		try {
			const token = await this.fetchPromise;
			return token;
		} finally {
			this.fetchPromise = null;
		}
	}

	/**
	 * Fetch token and update cache
	 */
	private async fetchAndCache(
		organizationId: string | null,
	): Promise<string | null> {
		try {
			const token = await getClientJwt();
			if (token) {
				this.cache = {
					token,
					fetchedAt: Date.now(),
					organizationId,
				};
			} else {
				// Clear cache on failed fetch
				this.clear();
			}
			return token;
		} catch (error) {
			this.clear();
			throw error;
		}
	}

	/**
	 * Force-refresh the token using the last known organizationId.
	 * Used by the HTTP client to silently recover from 401 responses without
	 * needing to know the current org at the call site.
	 */
	async forceRefresh(): Promise<string | null> {
		const orgId = this.cache?.organizationId ?? null;
		return this.getToken(orgId, true);
	}

	/**
	 * Clear the token cache
	 */
	clear(): void {
		this.cache = null;
		this.fetchPromise = null;
	}

	/**
	 * Check if cache is valid for the given organization
	 */
	isValid(organizationId: string | null): boolean {
		return (
			this.cache !== null &&
			this.cache.organizationId === organizationId &&
			Date.now() - this.cache.fetchedAt < this.staleTimeout
		);
	}

	/**
	 * Get cached token without organization validation.
	 * Used for auto-fetch scenarios where we don't have access to the current organization context.
	 * Returns cached token if valid (not stale), otherwise fetches a new one using the cached org ID.
	 *
	 * This method is useful for components that don't use useJwt hook but still need authentication.
	 * It respects the token cache set by useJwt (which handles org switching).
	 *
	 * @returns JWT token or null
	 */
	async getCachedToken(): Promise<string | null> {
		// If cache is valid and not stale, return it regardless of organization
		if (this.cache && Date.now() - this.cache.fetchedAt < this.staleTimeout) {
			return this.cache.token;
		}

		// If there's already a fetch in progress, wait for it
		if (this.fetchPromise) {
			return this.fetchPromise;
		}

		// Start a new fetch using the cached organization ID (or null if no cache)
		const orgId = this.cache?.organizationId ?? null;
		this.fetchPromise = this.fetchAndCache(orgId);

		try {
			const token = await this.fetchPromise;
			return token;
		} finally {
			this.fetchPromise = null;
		}
	}
}

// Export singleton instance
export const tokenCache = new TokenCache();

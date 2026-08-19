let cachedSessionUrl: string | undefined;

/**
 * Stores the LogRocket session URL captured on the client so it can be read
 * synchronously from shared modules (outgoing API headers, Sentry `beforeSend`)
 * without importing the `"use client"` LogRocket SDK.
 *
 * On the server this stays `undefined` — there is no browser session to attach.
 */
export function setCachedSessionUrl(sessionUrl: string | undefined): void {
	cachedSessionUrl = sessionUrl;
}

/**
 * Last session URL captured via `getSessionUrl`, or undefined if LogRocket
 * hasn't resolved one yet (e.g. not initialized, still starting up, or this
 * code is running on the server).
 */
export function getCachedSessionUrl(): string | undefined {
	return cachedSessionUrl;
}

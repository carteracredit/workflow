"use client";

import LogRocket from "logrocket";

let cachedSessionUrl: string | undefined;

/**
 * Subscribes to the LogRocket session recording URL via the real, asynchronous
 * `LogRocket.getSessionURL` callback API. Also caches the resolved value so it
 * can be read synchronously afterwards (e.g. to attach to a Sentry event or an
 * outgoing API request) via `getCachedSessionUrl()`.
 */
export function getSessionUrl(callback: (sessionUrl: string) => void): void {
	LogRocket.getSessionURL((sessionUrl) => {
		cachedSessionUrl = sessionUrl;
		callback(sessionUrl);
	});
}

/**
 * Last session URL captured via `getSessionUrl`, or undefined if LogRocket
 * hasn't resolved one yet (e.g. not initialized, or still starting up).
 */
export function getCachedSessionUrl(): string | undefined {
	return cachedSessionUrl;
}

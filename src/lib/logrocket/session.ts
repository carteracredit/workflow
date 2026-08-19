"use client";

import LogRocket from "logrocket";

import { setCachedSessionUrl } from "./session-store";

/**
 * Subscribes to the LogRocket session recording URL via the real, asynchronous
 * `LogRocket.getSessionURL` callback API. Also caches the resolved value so it
 * can be read synchronously afterwards (e.g. to attach to a Sentry event or an
 * outgoing API request) via `getCachedSessionUrl()` from `session-store`.
 */
export function getSessionUrl(callback: (sessionUrl: string) => void): void {
	LogRocket.getSessionURL((sessionUrl) => {
		setCachedSessionUrl(sessionUrl);
		callback(sessionUrl);
	});
}

"use client";

import LogRocket from "logrocket";

import { getLogRocketConfig } from "./config";
import { requestSanitizer, responseSanitizer } from "./sanitizers";
import { getSessionUrl } from "./session";

let initialized = false;

/**
 * Initializes LogRocket session replay on the client, if enabled.
 * Idempotent — safe to call multiple times (e.g. across renders/HMR).
 */
export function initLogRocket(): void {
	if (initialized || typeof window === "undefined") return;

	const config = getLogRocketConfig();
	if (!config.enabled) return;

	LogRocket.init(config.appId, {
		release: config.release,
		rootHostname: config.rootHostname || undefined,
		dom: {
			inputSanitizer: true,
			imageSanitizer: true,
		},
		network: {
			requestSanitizer,
			responseSanitizer,
		},
	});

	initialized = true;

	// Kick off caching the session URL as soon as it's available, so it can be
	// read synchronously elsewhere (Sentry `beforeSend`, outgoing API requests).
	getSessionUrl(() => {});
}

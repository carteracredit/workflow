import { getCachedSessionUrl } from "@/lib/logrocket/session-store";

/**
 * Merges the `X-LogRocket-Session-URL` header into an existing `HeadersInit`
 * when a LogRocket session is available, so backend logs can be correlated
 * with the session replay in progress at request time. No-ops (returns
 * `headers` unchanged) when LogRocket isn't enabled/initialized yet.
 */
export function withLogRocketHeader(headers?: HeadersInit): HeadersInit {
	const sessionUrl = getCachedSessionUrl();
	if (!sessionUrl) return headers ?? {};
	const merged = new Headers(headers);
	merged.set("X-LogRocket-Session-URL", sessionUrl);
	return merged;
}

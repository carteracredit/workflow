export const DEFAULT_API_BASE_URL =
	"https://backend-template.algtools.workers.dev";

/**
 * Base URL for the upstream API.
 *
 * - Server: prefer `ALGTOOLS_API_BASE_URL`
 * - Client (if you ever call upstream directly): `NEXT_PUBLIC_ALGTOOLS_API_BASE_URL`
 *
 * In this repo we mainly call upstream from Next Route Handlers, so CORS/auth stay server-side.
 */
export function getUpstreamApiBaseUrl() {
	return (
		process.env.ALGTOOLS_API_BASE_URL ??
		process.env.NEXT_PUBLIC_ALGTOOLS_API_BASE_URL ??
		DEFAULT_API_BASE_URL
	);
}

import type LogRocket from "logrocket";

// LogRocket doesn't export its `IRequest`/`IResponse` types directly (they
// live in an internal, non-exported namespace), so we derive them from the
// public `init` signature instead of redeclaring them by hand.
type LogRocketOptions = NonNullable<Parameters<typeof LogRocket.init>[1]>;
type NetworkOptions = NonNullable<LogRocketOptions["network"]>;
type RequestSanitizer = NonNullable<NetworkOptions["requestSanitizer"]>;
type ResponseSanitizer = NonNullable<NetworkOptions["responseSanitizer"]>;
export type LogRocketRequest = Parameters<RequestSanitizer>[0];
export type LogRocketResponse = Parameters<ResponseSanitizer>[0];

const SENSITIVE_HEADER_NAMES = new Set(["authorization", "cookie"]);

/**
 * Matches JSON keys that should never leave the browser in a session replay:
 * SSNs/dates of birth, card/bank details, and auth secrets. Case-insensitive
 * substring match so e.g. `bankAccountNumber` and `refreshToken` both match.
 */
const SENSITIVE_KEY_PATTERN =
	/ssn|dob|card|cvv|account|routing|token|secret|password/i;

const REDACTED = "[REDACTED]";

function sanitizeHeaders(
	headers: LogRocketRequest["headers"],
): LogRocketRequest["headers"] {
	const sanitized: LogRocketRequest["headers"] = {};
	for (const [key, value] of Object.entries(headers)) {
		sanitized[key] = SENSITIVE_HEADER_NAMES.has(key.toLowerCase())
			? REDACTED
			: value;
	}
	return sanitized;
}

function redactSensitiveKeys(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(redactSensitiveKeys);
	}
	if (value !== null && typeof value === "object") {
		const result: Record<string, unknown> = {};
		for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
			result[key] = SENSITIVE_KEY_PATTERN.test(key)
				? REDACTED
				: redactSensitiveKeys(v);
		}
		return result;
	}
	return value;
}

/** Redacts sensitive JSON keys in a request/response body. Non-JSON bodies are left untouched. */
function sanitizeBody(body: string | undefined): string | undefined {
	if (!body) return body;
	try {
		const parsed: unknown = JSON.parse(body);
		return JSON.stringify(redactSensitiveKeys(parsed));
	} catch {
		return body;
	}
}

/**
 * Strips Authorization/Cookie headers and redacts sensitive JSON body keys
 * from outgoing requests before LogRocket records them.
 */
export function requestSanitizer(request: LogRocketRequest): LogRocketRequest {
	return {
		...request,
		headers: sanitizeHeaders(request.headers),
		body: sanitizeBody(request.body),
	};
}

/**
 * Strips Authorization/Cookie headers and redacts sensitive JSON body keys
 * from incoming responses before LogRocket records them.
 */
export function responseSanitizer(
	response: LogRocketResponse,
): LogRocketResponse {
	return {
		...response,
		headers: sanitizeHeaders(response.headers),
		body: sanitizeBody(response.body),
	};
}

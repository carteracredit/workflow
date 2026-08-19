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

const SENSITIVE_HEADER_NAMES = new Set([
	"authorization",
	"proxy-authorization",
	"cookie",
	"set-cookie",
	"x-api-key",
	"x-auth-token",
	"x-session-token",
	"x-csrf-token",
	"x-xsrf-token",
	"x-captcha-response",
	"x-amz-security-token",
]);

/**
 * Matches JSON keys that should never leave the browser in a session replay.
 * Applied to a normalized key (lowercase, non-alphanumerics stripped) so
 * `tax_id_number`, `taxIdNumber` and `TaxIDNumber` all match `taxid`.
 *
 * `account` is kept as a substring so `bankAccountNumber` / `accountBalance`
 * stay covered. Exact-only keys (`pan`, `ein`, `otp`) live in
 * `EXACT_SENSITIVE_KEYS` to avoid false positives like `company` / `being`.
 * `code` is intentionally omitted — it would redact `statusCode` / `errorCode`.
 */
const SENSITIVE_KEY_PATTERN =
	/ssn|itin|socialsecurity|taxid|dob|dateofbirth|birthdate|birthday|card|cvv|cvc|routing|account|iban|password|passcode|secret|token|apikey|privatekey|phone|email|firstname|middlename|lastname|fullname|holdername|address|driverlicense|licensenumber|bureau|scorefactor|fico|tradeline/;

const EXACT_SENSITIVE_KEYS = new Set(["pan", "ein", "otp"]);

/**
 * Query-string names that carry PII or credentials even when they wouldn't
 * match the body-key pattern (`q`, `search`, AWS signature params).
 */
const SENSITIVE_QUERY_PARAMS = new Set([
	"token",
	"sessiontoken",
	"q",
	"query",
	"search",
	"email",
	"phone",
	"taxid",
	"signature",
	"xamzsignature",
	"xamzcredential",
	"xamzsecuritytoken",
]);

const ADDRESS_FIELD_KEYS = new Set([
	"street",
	"streetname",
	"streetnumber",
	"city",
	"state",
	"zip",
	"zipcode",
	"apt",
]);

const REDACTED = "[REDACTED]";

function normalizeKey(key: string): string {
	return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isSensitiveKey(key: string): boolean {
	const normalized = normalizeKey(key);
	return (
		EXACT_SENSITIVE_KEYS.has(normalized) ||
		SENSITIVE_KEY_PATTERN.test(normalized)
	);
}

function looksLikeAddress(value: Record<string, unknown>): boolean {
	let hits = 0;
	for (const key of Object.keys(value)) {
		if (ADDRESS_FIELD_KEYS.has(normalizeKey(key))) hits += 1;
		if (hits >= 2) return true;
	}
	return false;
}

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

function getContentType(headers: LogRocketRequest["headers"]): string {
	for (const [key, value] of Object.entries(headers)) {
		if (key.toLowerCase() === "content-type") {
			return (value ?? "").toLowerCase();
		}
	}
	return "";
}

function redactSensitiveKeys(value: unknown): unknown {
	if (Array.isArray(value)) {
		return value.map(redactSensitiveKeys);
	}
	if (value !== null && typeof value === "object") {
		const record = value as Record<string, unknown>;
		if (looksLikeAddress(record)) {
			return REDACTED;
		}
		const result: Record<string, unknown> = {};
		for (const [key, nested] of Object.entries(record)) {
			result[key] = isSensitiveKey(key)
				? REDACTED
				: redactSensitiveKeys(nested);
		}
		return result;
	}
	return value;
}

function sanitizeFormBody(body: string): string {
	const params = new URLSearchParams(body);
	const result = new URLSearchParams();
	for (const [key, value] of params.entries()) {
		result.append(key, isSensitiveKey(key) ? REDACTED : value);
	}
	return result.toString();
}

/**
 * Redacts sensitive keys in JSON and form-urlencoded bodies. Multipart,
 * binary and other non-JSON bodies are replaced wholesale — LogRocket must
 * never persist an avatar upload or chat attachment.
 */
function sanitizeBody(
	body: string | undefined,
	headers: LogRocketRequest["headers"],
): string | undefined {
	if (!body) return body;

	const contentType = getContentType(headers);
	if (contentType.includes("application/x-www-form-urlencoded")) {
		return sanitizeFormBody(body);
	}

	const looksJson =
		contentType.includes("application/json") || contentType.includes("+json");
	if (contentType && !looksJson) {
		return REDACTED;
	}

	try {
		const parsed: unknown = JSON.parse(body);
		return JSON.stringify(redactSensitiveKeys(parsed));
	} catch {
		return REDACTED;
	}
}

/**
 * Redacts PII and credentials from a URL's query string and from the
 * `/access/{token}` path segment used by external case access.
 */
export function sanitizeUrl(url: string): string {
	try {
		const absolute = /^[a-z][a-z0-9+.-]*:/i.test(url);
		const parsed = new URL(url, "https://logrocket-sanitizer.invalid");

		parsed.pathname = parsed.pathname.replace(
			/\/access\/[^/]+/i,
			`/access/${REDACTED}`,
		);

		for (const key of [...parsed.searchParams.keys()]) {
			const normalized = normalizeKey(key);
			if (
				SENSITIVE_QUERY_PARAMS.has(normalized) ||
				EXACT_SENSITIVE_KEYS.has(normalized) ||
				SENSITIVE_KEY_PATTERN.test(normalized)
			) {
				parsed.searchParams.set(key, REDACTED);
			}
		}

		if (absolute) return parsed.toString();
		return `${parsed.pathname}${parsed.search}${parsed.hash}`;
	} catch {
		return url;
	}
}

/**
 * LogRocket `browser.urlSanitizer` entry point. Same rules as `sanitizeUrl`.
 */
export function urlSanitizer(url: string): string {
	return sanitizeUrl(url);
}

/**
 * Strips auth/session headers, redacts sensitive body keys, and sanitizes
 * the request URL before LogRocket records them.
 */
export function requestSanitizer(request: LogRocketRequest): LogRocketRequest {
	return {
		...request,
		url: sanitizeUrl(request.url),
		headers: sanitizeHeaders(request.headers),
		body: sanitizeBody(request.body, request.headers),
	};
}

/**
 * Strips auth/session headers and redacts sensitive body keys from incoming
 * responses before LogRocket records them.
 */
export function responseSanitizer(
	response: LogRocketResponse,
): LogRocketResponse {
	return {
		...response,
		url: response.url ? sanitizeUrl(response.url) : response.url,
		headers: sanitizeHeaders(response.headers),
		body: sanitizeBody(response.body, response.headers),
	};
}

export class ApiError extends Error {
	name = "ApiError" as const;
	status: number;
	body: unknown;

	constructor(message: string, opts: { status: number; body: unknown }) {
		super(message);
		this.status = opts.status;
		this.body = opts.body;
	}
}

/**
 * Extracts a human-readable error message from any error.
 *
 * Handles both response formats from workflow-svc:
 *  - Chanfana endpoints: `{ success: false, errors: [{ code, message }] }`
 *  - Publish endpoint:   `{ success: false, error: string, details?: string }`
 */
export function extractApiErrorMessage(error: unknown): string {
	if (error instanceof ApiError) {
		const body = error.body;
		if (body && typeof body === "object") {
			// Chanfana format: { success: false, errors: [{ code, message }] }
			if (
				"errors" in body &&
				Array.isArray((body as { errors: unknown[] }).errors)
			) {
				const errors = (body as { errors: Array<{ message?: string }> }).errors;
				if (errors.length > 0 && errors[0].message) {
					return errors[0].message;
				}
			}
			// Publish/custom endpoint format: { success: false, error: string, details?: string }
			if ("error" in body) {
				const { error: msg, details } = body as {
					error?: string;
					details?: string;
				};
				if (msg) {
					return details ? `${msg}: ${details}` : msg;
				}
			}
		}
		return error.message;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return "Error desconocido";
}

export interface FetchJsonOptions extends RequestInit {
	/**
	 * JWT token to include in Authorization header.
	 * When provided, adds `Authorization: Bearer <jwt>` header.
	 * If not provided and running in browser (client-side), automatically fetches JWT.
	 */
	jwt?: string | null;
}

function isClientSide(): boolean {
	return typeof window !== "undefined";
}

function isTestEnvironment(): boolean {
	return (
		typeof process !== "undefined" &&
		(process.env.NODE_ENV === "test" ||
			process.env.VITEST === "true" ||
			process.env.JEST_WORKER_ID !== undefined)
	);
}

async function getJwtIfNeeded(
	jwt: string | null | undefined,
): Promise<string | null> {
	if (jwt !== undefined && jwt !== null) {
		return jwt;
	}
	if (isTestEnvironment() || !isClientSide()) {
		return null;
	}
	try {
		const { tokenCache } = await import("@/lib/auth/tokenCache");
		return await tokenCache.getCachedToken();
	} catch (error) {
		console.warn("Failed to auto-fetch JWT:", error);
		return null;
	}
}

export async function fetchJson<T>(
	url: string,
	init?: FetchJsonOptions,
): Promise<{ status: number; json: T }> {
	const { jwt: providedJwt, ...fetchInit } = init ?? {};
	const jwt = await getJwtIfNeeded(providedJwt);

	const headers: Record<string, string> = {
		accept: "application/json",
		...(fetchInit?.headers as Record<string, string> | undefined),
	};
	if (jwt) {
		headers.Authorization = `Bearer ${jwt}`;
	}
	const res = await fetch(url, {
		...fetchInit,
		headers,
	});

	const contentType = res.headers.get("content-type") ?? "";
	const isJson = contentType.includes("application/json");
	const body = isJson ? await res.json().catch(() => null) : await res.text();

	if (!res.ok) {
		if (res.status === 401 && isClientSide() && !isTestEnvironment()) {
			try {
				const { tokenCache } = await import("@/lib/auth/tokenCache");
				const freshToken = await tokenCache.forceRefresh();
				if (freshToken) {
					const retryHeaders = {
						...headers,
						Authorization: `Bearer ${freshToken}`,
					};
					const retryRes = await fetch(url, {
						...fetchInit,
						headers: retryHeaders,
					});
					const retryContentType = retryRes.headers.get("content-type") ?? "";
					const retryIsJson = retryContentType.includes("application/json");
					const retryBody = retryIsJson
						? await retryRes.json().catch(() => null)
						: await retryRes.text();
					if (retryRes.ok) {
						return { status: retryRes.status, json: retryBody as T };
					}
					throw new ApiError(
						`Request failed: ${retryRes.status} ${retryRes.statusText}`,
						{ status: retryRes.status, body: retryBody },
					);
				}
			} catch (retryErr) {
				if (retryErr instanceof ApiError) throw retryErr;
			}
		}
		throw new ApiError(`Request failed: ${res.status} ${res.statusText}`, {
			status: res.status,
			body,
		});
	}

	return { status: res.status, json: body as T };
}

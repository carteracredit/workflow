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
	 */
	jwt?: string;
}

export async function fetchJson<T>(
	url: string,
	init?: FetchJsonOptions,
): Promise<{ status: number; json: T }> {
	const { jwt, ...fetchInit } = init ?? {};
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
		throw new ApiError(`Request failed: ${res.status} ${res.statusText}`, {
			status: res.status,
			body,
		});
	}

	return { status: res.status, json: body as T };
}

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

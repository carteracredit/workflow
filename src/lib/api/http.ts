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

export async function fetchJson<T>(
	url: string,
	init?: RequestInit,
): Promise<{ status: number; json: T }> {
	const res = await fetch(url, {
		...init,
		headers: {
			accept: "application/json",
			...(init?.headers ?? {}),
		},
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

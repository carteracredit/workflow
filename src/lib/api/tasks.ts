import { getUpstreamApiBaseUrl } from "./config";
import { fetchJson } from "./http";

export type Task = {
	id: number;
	name: string;
	slug: string;
	description: string;
	completed: boolean;
	due_date: string; // date-time
};

export type ApiEnvelope<T> = { success: boolean; result: T };

export type TaskUpsertInput = Omit<Task, "id">;

export async function listTasks(opts?: {
	page?: number;
	per_page?: number;
	search?: string;
	baseUrl?: string;
	signal?: AbortSignal;
}) {
	const baseUrl = opts?.baseUrl ?? getUpstreamApiBaseUrl();
	const url = new URL("/tasks", baseUrl);
	if (opts?.page) url.searchParams.set("page", String(opts.page));
	if (opts?.per_page) url.searchParams.set("per_page", String(opts.per_page));
	if (opts?.search) url.searchParams.set("search", opts.search);

	const { json } = await fetchJson<ApiEnvelope<Task[]>>(url.toString(), {
		method: "GET",
		cache: "no-store",
		signal: opts?.signal,
	});
	return json;
}

export async function createTask(opts: {
	input: TaskUpsertInput;
	baseUrl?: string;
	signal?: AbortSignal;
}) {
	const baseUrl = opts.baseUrl ?? getUpstreamApiBaseUrl();
	const url = new URL("/tasks", baseUrl);

	const { json } = await fetchJson<ApiEnvelope<Task>>(url.toString(), {
		method: "POST",
		cache: "no-store",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(opts.input),
		signal: opts.signal,
	});
	return json;
}

export async function readTask(opts: {
	id: number;
	baseUrl?: string;
	signal?: AbortSignal;
}) {
	const baseUrl = opts.baseUrl ?? getUpstreamApiBaseUrl();
	const url = new URL(`/tasks/${opts.id}`, baseUrl);

	const { json } = await fetchJson<ApiEnvelope<Task>>(url.toString(), {
		method: "GET",
		cache: "no-store",
		signal: opts.signal,
	});
	return json;
}

export async function updateTask(opts: {
	id: number;
	input: TaskUpsertInput;
	baseUrl?: string;
	signal?: AbortSignal;
}) {
	const baseUrl = opts.baseUrl ?? getUpstreamApiBaseUrl();
	const url = new URL(`/tasks/${opts.id}`, baseUrl);

	const { json } = await fetchJson<ApiEnvelope<Task>>(url.toString(), {
		method: "PUT",
		cache: "no-store",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(opts.input),
		signal: opts.signal,
	});
	return json;
}

export async function deleteTask(opts: {
	id: number;
	baseUrl?: string;
	signal?: AbortSignal;
}) {
	const baseUrl = opts.baseUrl ?? getUpstreamApiBaseUrl();
	const url = new URL(`/tasks/${opts.id}`, baseUrl);

	const { json } = await fetchJson<ApiEnvelope<Task>>(url.toString(), {
		method: "DELETE",
		cache: "no-store",
		signal: opts.signal,
	});
	return json;
}

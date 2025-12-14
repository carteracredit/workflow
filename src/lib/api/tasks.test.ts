import { describe, expect, it, vi } from "vitest";
import {
	createTask,
	deleteTask,
	listTasks,
	readTask,
	updateTask,
	type ApiEnvelope,
	type Task,
} from "./tasks";

describe("api/tasks", () => {
	it("listTasks omits query params when not provided", async () => {
		const fetchSpy = vi.fn(async (url: RequestInfo | URL) => {
			const u = new URL(typeof url === "string" ? url : url.toString());
			expect(u.origin + u.pathname).toBe("https://example.com/tasks");
			expect(u.search).toBe("");
			return new Response(JSON.stringify({ success: true, result: [] }), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		});
		vi.stubGlobal("fetch", fetchSpy);

		const res = await listTasks({ baseUrl: "https://example.com" });
		expect(res).toEqual({ success: true, result: [] });
	});

	it("listTasks builds query params correctly", async () => {
		const fetchSpy = vi.fn(
			async (url: RequestInfo | URL, init?: RequestInit) => {
				expect((init?.method ?? "GET").toUpperCase()).toBe("GET");
				const u = new URL(typeof url === "string" ? url : url.toString());
				expect(u.origin + u.pathname).toBe("https://example.com/tasks");
				expect(u.searchParams.get("page")).toBe("2");
				expect(u.searchParams.get("per_page")).toBe("10");
				expect(u.searchParams.get("search")).toBe("milk");
				return new Response(JSON.stringify({ success: true, result: [] }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			},
		);
		vi.stubGlobal("fetch", fetchSpy);

		const res = await listTasks({
			baseUrl: "https://example.com",
			page: 2,
			per_page: 10,
			search: "milk",
		});
		expect(res).toEqual({ success: true, result: [] });
	});

	it("createTask uses env baseUrl when not provided", async () => {
		const prev = process.env.ALGTOOLS_API_BASE_URL;
		process.env.ALGTOOLS_API_BASE_URL = "https://env.example";

		const fetchSpy = vi.fn(async (url: RequestInfo | URL) => {
			expect(typeof url === "string" ? url : url.toString()).toBe(
				"https://env.example/tasks",
			);
			return new Response(
				JSON.stringify({ success: true, result: { id: 1 } }),
				{
					status: 201,
					headers: { "content-type": "application/json" },
				},
			);
		});
		vi.stubGlobal("fetch", fetchSpy);

		await createTask({
			input: {
				name: "A",
				slug: "a-1",
				description: "",
				completed: false,
				due_date: new Date().toISOString(),
			},
		});

		if (prev === undefined) delete process.env.ALGTOOLS_API_BASE_URL;
		else process.env.ALGTOOLS_API_BASE_URL = prev;
	});

	it("createTask sends POST with JSON body", async () => {
		const input = {
			name: "A",
			slug: "a-1",
			description: "",
			completed: false,
			due_date: new Date().toISOString(),
		};

		const fetchSpy = vi.fn(
			async (_url: RequestInfo | URL, init?: RequestInit) => {
				expect((init?.method ?? "").toUpperCase()).toBe("POST");
				expect((init?.headers as Record<string, string>)["content-type"]).toBe(
					"application/json",
				);
				expect(JSON.parse(String(init?.body))).toEqual(input);
				const created: ApiEnvelope<Task> = {
					success: true,
					result: { id: 1, ...input },
				};
				return new Response(JSON.stringify(created), {
					status: 201,
					headers: { "content-type": "application/json" },
				});
			},
		);
		vi.stubGlobal("fetch", fetchSpy);

		const res = await createTask({ baseUrl: "https://example.com", input });
		expect(res.success).toBe(true);
		expect(res.result.id).toBe(1);
	});

	it("readTask uses env baseUrl when not provided", async () => {
		const prev = process.env.ALGTOOLS_API_BASE_URL;
		process.env.ALGTOOLS_API_BASE_URL = "https://env.example";

		const fetchSpy = vi.fn(async (url: RequestInfo | URL) => {
			expect(typeof url === "string" ? url : url.toString()).toBe(
				"https://env.example/tasks/123",
			);
			return new Response(
				JSON.stringify({ success: true, result: { id: 123 } }),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		});
		vi.stubGlobal("fetch", fetchSpy);

		await readTask({ id: 123 });

		if (prev === undefined) delete process.env.ALGTOOLS_API_BASE_URL;
		else process.env.ALGTOOLS_API_BASE_URL = prev;
	});

	it("readTask requests /tasks/:id", async () => {
		const fetchSpy = vi.fn(
			async (url: RequestInfo | URL, init?: RequestInit) => {
				expect((init?.method ?? "GET").toUpperCase()).toBe("GET");
				expect(typeof url === "string" ? url : url.toString()).toBe(
					"https://example.com/tasks/123",
				);
				return new Response(
					JSON.stringify({ success: true, result: { id: 123 } }),
					{
						status: 200,
						headers: { "content-type": "application/json" },
					},
				);
			},
		);
		vi.stubGlobal("fetch", fetchSpy);

		const res = await readTask({ baseUrl: "https://example.com", id: 123 });
		expect(res).toEqual({ success: true, result: { id: 123 } });
	});

	it("updateTask uses env baseUrl when not provided", async () => {
		const prev = process.env.ALGTOOLS_API_BASE_URL;
		process.env.ALGTOOLS_API_BASE_URL = "https://env.example";

		const fetchSpy = vi.fn(async (url: RequestInfo | URL) => {
			expect(typeof url === "string" ? url : url.toString()).toBe(
				"https://env.example/tasks/1",
			);
			return new Response(
				JSON.stringify({ success: true, result: { id: 1 } }),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		});
		vi.stubGlobal("fetch", fetchSpy);

		await updateTask({
			id: 1,
			input: {
				name: "A",
				slug: "a-1",
				description: "",
				completed: true,
				due_date: new Date().toISOString(),
			},
		});

		if (prev === undefined) delete process.env.ALGTOOLS_API_BASE_URL;
		else process.env.ALGTOOLS_API_BASE_URL = prev;
	});

	it("updateTask requests PUT /tasks/:id with body", async () => {
		const input = {
			name: "A",
			slug: "a-1",
			description: "",
			completed: true,
			due_date: new Date().toISOString(),
		};

		const fetchSpy = vi.fn(
			async (url: RequestInfo | URL, init?: RequestInit) => {
				expect(typeof url === "string" ? url : url.toString()).toBe(
					"https://example.com/tasks/1",
				);
				expect((init?.method ?? "").toUpperCase()).toBe("PUT");
				expect(JSON.parse(String(init?.body))).toEqual(input);
				return new Response(
					JSON.stringify({ success: true, result: { id: 1 } }),
					{
						status: 200,
						headers: { "content-type": "application/json" },
					},
				);
			},
		);
		vi.stubGlobal("fetch", fetchSpy);

		const res = await updateTask({
			baseUrl: "https://example.com",
			id: 1,
			input,
		});
		expect(res.success).toBe(true);
	});

	it("deleteTask uses env baseUrl when not provided", async () => {
		const prev = process.env.ALGTOOLS_API_BASE_URL;
		process.env.ALGTOOLS_API_BASE_URL = "https://env.example";

		const fetchSpy = vi.fn(async (url: RequestInfo | URL) => {
			expect(typeof url === "string" ? url : url.toString()).toBe(
				"https://env.example/tasks/9",
			);
			return new Response(
				JSON.stringify({ success: true, result: { id: 9 } }),
				{
					status: 200,
					headers: { "content-type": "application/json" },
				},
			);
		});
		vi.stubGlobal("fetch", fetchSpy);

		await deleteTask({ id: 9 });

		if (prev === undefined) delete process.env.ALGTOOLS_API_BASE_URL;
		else process.env.ALGTOOLS_API_BASE_URL = prev;
	});

	it("deleteTask requests DELETE /tasks/:id", async () => {
		const fetchSpy = vi.fn(
			async (url: RequestInfo | URL, init?: RequestInit) => {
				expect(typeof url === "string" ? url : url.toString()).toBe(
					"https://example.com/tasks/9",
				);
				expect((init?.method ?? "").toUpperCase()).toBe("DELETE");
				return new Response(
					JSON.stringify({ success: true, result: { id: 9 } }),
					{
						status: 200,
						headers: { "content-type": "application/json" },
					},
				);
			},
		);
		vi.stubGlobal("fetch", fetchSpy);

		const res = await deleteTask({ baseUrl: "https://example.com", id: 9 });
		expect(res.success).toBe(true);
	});
});

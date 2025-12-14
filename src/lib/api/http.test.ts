import { describe, expect, it, vi } from "vitest";
import { ApiError, fetchJson } from "./http";

describe("api/http fetchJson", () => {
	it("returns parsed JSON for ok responses", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				return new Response(JSON.stringify({ ok: true }), {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}),
		);

		const res = await fetchJson<{ ok: boolean }>("https://example.com");
		expect(res.status).toBe(200);
		expect(res.json).toEqual({ ok: true });
	});

	it("returns null when JSON parsing fails but response is ok", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				return new Response("not json", {
					status: 200,
					headers: { "content-type": "application/json" },
				});
			}),
		);

		const res = await fetchJson<unknown>("https://example.com");
		expect(res.json).toBeNull();
	});

	it("returns text when content-type is not JSON", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				return new Response("ok", {
					status: 200,
					headers: { "content-type": "text/plain" },
				});
			}),
		);

		const res = await fetchJson<string>("https://example.com");
		expect(res.json).toBe("ok");
	});

	it("throws ApiError and includes parsed body on non-2xx JSON responses", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				return new Response(JSON.stringify({ message: "bad" }), {
					status: 400,
					statusText: "Bad Request",
					headers: { "content-type": "application/json" },
				});
			}),
		);

		await expect(fetchJson("https://example.com")).rejects.toBeInstanceOf(
			ApiError,
		);

		try {
			await fetchJson("https://example.com");
		} catch (e) {
			const err = e as ApiError;
			expect(err.status).toBe(400);
			expect(err.body).toEqual({ message: "bad" });
		}
	});

	it("throws ApiError and includes text body on non-2xx non-JSON responses", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				return new Response("oops", {
					status: 500,
					statusText: "Internal Server Error",
					headers: { "content-type": "text/plain" },
				});
			}),
		);

		try {
			await fetchJson("https://example.com");
			throw new Error("expected to throw");
		} catch (e) {
			const err = e as ApiError;
			expect(err.status).toBe(500);
			expect(err.body).toBe("oops");
		}
	});
});

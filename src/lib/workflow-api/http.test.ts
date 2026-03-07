import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchJson, ApiError, extractApiErrorMessage } from "./http";

describe("fetchJson", () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it("returns parsed JSON on successful response", async () => {
		const mockData = { success: true, result: [{ id: 1 }] };
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				headers: { get: () => "application/json" },
				json: () => Promise.resolve(mockData),
				text: () => Promise.resolve(""),
			}),
		);

		const result = await fetchJson<typeof mockData>("https://example.com/api");
		expect(result.status).toBe(200);
		expect(result.json).toEqual(mockData);
	});

	it("adds Authorization header when jwt is provided", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				headers: { get: () => "application/json" },
				json: () => Promise.resolve({}),
				text: () => Promise.resolve(""),
			}),
		);

		await fetchJson("https://example.com/api", { jwt: "my-token" });

		const fetchCall = vi.mocked(fetch).mock.calls[0];
		const headers = fetchCall[1]?.headers as Record<string, string>;
		expect(headers.Authorization).toBe("Bearer my-token");
	});

	it("does not add Authorization header when jwt is not provided", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				headers: { get: () => "application/json" },
				json: () => Promise.resolve({}),
				text: () => Promise.resolve(""),
			}),
		);

		await fetchJson("https://example.com/api");

		const fetchCall = vi.mocked(fetch).mock.calls[0];
		const headers = fetchCall[1]?.headers as Record<string, string>;
		expect(headers.Authorization).toBeUndefined();
	});

	it("throws ApiError on non-ok response", async () => {
		const errorBody = { success: false, errors: [{ message: "Not Found" }] };
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 404,
				statusText: "Not Found",
				headers: { get: () => "application/json" },
				json: () => Promise.resolve(errorBody),
				text: () => Promise.resolve(""),
			}),
		);

		await expect(fetchJson("https://example.com/api")).rejects.toThrow(
			ApiError,
		);
	});

	it("throws ApiError with correct status on 401", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 401,
				statusText: "Unauthorized",
				headers: { get: () => "application/json" },
				json: () =>
					Promise.resolve({
						success: false,
						errors: [{ message: "Unauthorized" }],
					}),
				text: () => Promise.resolve(""),
			}),
		);

		try {
			await fetchJson("https://example.com/api");
		} catch (err) {
			expect(err).toBeInstanceOf(ApiError);
			expect((err as ApiError).status).toBe(401);
		}
	});

	it("handles non-JSON response bodies", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({
				ok: false,
				status: 500,
				statusText: "Internal Server Error",
				headers: { get: () => "text/plain" },
				json: () => Promise.reject(new Error("not json")),
				text: () => Promise.resolve("Internal Server Error"),
			}),
		);

		await expect(fetchJson("https://example.com/api")).rejects.toThrow(
			ApiError,
		);
	});
});

describe("extractApiErrorMessage", () => {
	it("returns errors[0].message for ApiError with Chanfana format", () => {
		const err = new ApiError("Request failed", {
			status: 400,
			body: {
				success: false,
				errors: [{ code: "VALIDATION", message: "Campo requerido" }],
			},
		});
		expect(extractApiErrorMessage(err)).toBe("Campo requerido");
	});

	it("returns error string for ApiError with publish format", () => {
		const err = new ApiError("Request failed", {
			status: 500,
			body: { success: false, error: "Internal server error" },
		});
		expect(extractApiErrorMessage(err)).toBe("Internal server error");
	});

	it("returns error + details for ApiError with publish format and details", () => {
		const err = new ApiError("Request failed", {
			status: 500,
			body: {
				success: false,
				error: "Deploy failed",
				details: "Invalid config",
			},
		});
		expect(extractApiErrorMessage(err)).toBe("Deploy failed: Invalid config");
	});

	it("returns error.message when ApiError body has no matching format", () => {
		const err = new ApiError("Network timeout", {
			status: 504,
			body: { success: false, unknown: "format" },
		});
		expect(extractApiErrorMessage(err)).toBe("Network timeout");
	});

	it("returns error.message when ApiError body is null", () => {
		const err = new ApiError("Connection refused", { status: 0, body: null });
		expect(extractApiErrorMessage(err)).toBe("Connection refused");
	});

	it("returns error.message for plain Error", () => {
		expect(extractApiErrorMessage(new Error("Something broke"))).toBe(
			"Something broke",
		);
	});

	it('returns "Error desconocido" for non-Error values', () => {
		expect(extractApiErrorMessage("string error")).toBe("Error desconocido");
		expect(extractApiErrorMessage(123)).toBe("Error desconocido");
		expect(extractApiErrorMessage(null)).toBe("Error desconocido");
	});
});

describe("ApiError", () => {
	it("has correct name, status and body", () => {
		const err = new ApiError("Something went wrong", {
			status: 403,
			body: { message: "Forbidden" },
		});
		expect(err.name).toBe("ApiError");
		expect(err.message).toBe("Something went wrong");
		expect(err.status).toBe(403);
		expect(err.body).toEqual({ message: "Forbidden" });
	});

	it("is an instance of Error", () => {
		const err = new ApiError("test", { status: 500, body: null });
		expect(err).toBeInstanceOf(Error);
	});
});

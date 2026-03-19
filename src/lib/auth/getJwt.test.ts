import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/headers", () => ({
	cookies: vi.fn(),
}));

import { cookies } from "next/headers";
import { getJwt, __resetTokenCacheForTests } from "./getJwt";

const AUTH_SERVICE_URL = "https://auth-svc.carteracredit.workers.dev";
const AUTH_APP_URL = "https://auth.carteracredit.workers.dev";

function mockCookies(cookieString: string) {
	vi.mocked(cookies).mockResolvedValue({
		toString: () => cookieString,
	} as unknown as Awaited<ReturnType<typeof cookies>>);
}

function mockFetchResponse(options: {
	ok: boolean;
	status?: number;
	statusText?: string;
	json?: unknown;
}) {
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({
			ok: options.ok,
			status: options.status ?? (options.ok ? 200 : 401),
			statusText: options.statusText ?? (options.ok ? "OK" : "Unauthorized"),
			json: () => Promise.resolve(options.json ?? {}),
		}),
	);
}

describe("getJwt", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		__resetTokenCacheForTests();
		delete process.env.NEXT_PUBLIC_AUTH_SERVICE_URL;
		delete process.env.NEXT_PUBLIC_AUTH_APP_URL;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("returns null when no session cookie is present", async () => {
		mockCookies("some_other_cookie=value");
		const fetchSpy = vi.fn();
		vi.stubGlobal("fetch", fetchSpy);

		const result = await getJwt();

		expect(result).toBeNull();
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("returns null when cookie string is empty", async () => {
		mockCookies("");

		const result = await getJwt();

		expect(result).toBeNull();
	});

	it("fetches JWT when better-auth.session_token cookie exists", async () => {
		mockCookies("better-auth.session_token=abc123");
		mockFetchResponse({ ok: true, json: { token: "jwt-token-123" } });

		const result = await getJwt();

		expect(result).toBe("jwt-token-123");
		expect(fetch).toHaveBeenCalledWith(
			`${AUTH_SERVICE_URL}/api/auth/token`,
			expect.objectContaining({
				headers: expect.objectContaining({
					Cookie: "better-auth.session_token=abc123",
					Origin: AUTH_APP_URL,
					Accept: "application/json",
				}),
				cache: "no-store",
			}),
		);
	});

	it("fetches JWT when __Secure-better-auth.session_token cookie exists", async () => {
		mockCookies("__Secure-better-auth.session_token=secure-abc");
		mockFetchResponse({ ok: true, json: { token: "secure-jwt" } });

		const result = await getJwt();

		expect(result).toBe("secure-jwt");
	});

	it("returns null when auth service returns non-ok response", async () => {
		mockCookies("better-auth.session_token=abc123");
		mockFetchResponse({ ok: false, status: 401, statusText: "Unauthorized" });

		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		const result = await getJwt();

		expect(result).toBeNull();
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			"Failed to get JWT: 401 Unauthorized",
		);
	});

	it("returns null when response has no token field", async () => {
		mockCookies("better-auth.session_token=abc123");
		mockFetchResponse({ ok: true, json: {} });

		const result = await getJwt();

		expect(result).toBeNull();
	});

	it("returns null when fetch throws a network error", async () => {
		mockCookies("better-auth.session_token=abc123");
		vi.stubGlobal(
			"fetch",
			vi.fn().mockRejectedValue(new Error("Network error")),
		);

		const consoleErrorSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});

		const result = await getJwt();

		expect(result).toBeNull();
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			"Error fetching JWT:",
			expect.any(Error),
		);
	});

	it("uses custom auth service URL from env", async () => {
		process.env.NEXT_PUBLIC_AUTH_SERVICE_URL =
			"https://custom-auth.example.com";
		process.env.NEXT_PUBLIC_AUTH_APP_URL = "https://custom-app.example.com";
		mockCookies("better-auth.session_token=abc123");
		mockFetchResponse({ ok: true, json: { token: "custom-jwt" } });

		const result = await getJwt();

		expect(result).toBe("custom-jwt");
		expect(fetch).toHaveBeenCalledWith(
			"https://custom-auth.example.com/api/auth/token",
			expect.objectContaining({
				headers: expect.objectContaining({
					Origin: "https://custom-app.example.com",
				}),
			}),
		);
	});

	it("returns cached token on second call within TTL without second fetch", async () => {
		mockCookies("better-auth.session_token=abc123");
		mockFetchResponse({ ok: true, json: { token: "cached-jwt" } });

		const first = await getJwt();
		expect(first).toBe("cached-jwt");
		const fetchCountAfterFirst = (fetch as ReturnType<typeof vi.fn>).mock.calls
			.length;

		const second = await getJwt();
		expect(second).toBe("cached-jwt");
		expect(fetch).toHaveBeenCalledTimes(fetchCountAfterFirst);
	});
});

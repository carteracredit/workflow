import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock better-auth/cookies
vi.mock("better-auth/cookies", () => ({
	getSessionCookie: vi.fn(),
}));

import { getSessionCookie } from "better-auth/cookies";
import { middleware } from "./middleware";

describe("middleware", () => {
	const mockGetSessionCookie = vi.mocked(getSessionCookie);

	beforeEach(() => {
		vi.clearAllMocks();
		global.fetch = vi.fn();
	});

	function createRequest(
		url: string,
		options?: {
			cookies?: Record<string, string>;
			headers?: Record<string, string>;
		},
	): NextRequest {
		const request = new NextRequest(new URL(url, "http://localhost:3000"));

		if (options?.cookies) {
			const cookieString = Object.entries(options.cookies)
				.map(([key, value]) => `${key}=${value}`)
				.join("; ");
			Object.defineProperty(request, "headers", {
				value: new Headers({
					cookie: cookieString,
					...options.headers,
				}),
			});
		} else if (options?.headers) {
			Object.defineProperty(request, "headers", {
				value: new Headers(options.headers),
			});
		}

		return request;
	}

	/**
	 * Creates a mock fetch Response with proper headers including getSetCookie support.
	 * This is required because the middleware uses response.headers.getSetCookie() to
	 * forward Set-Cookie headers from auth-svc to the browser.
	 */
	function createMockFetchResponse(options: {
		ok: boolean;
		status?: number;
		json?: () => Promise<unknown>;
		setCookies?: string[];
	}): Response {
		const setCookies = options.setCookies ?? [];
		return {
			ok: options.ok,
			status: options.status ?? (options.ok ? 200 : 401),
			headers: {
				getSetCookie: () => setCookies,
			},
			json: options.json ?? (async () => ({})),
		} as unknown as Response;
	}

	describe("session validation", () => {
		it("redirects to auth when no session cookie", async () => {
			mockGetSessionCookie.mockReturnValue(null);
			const request = createRequest("/dashboard");

			const response = await middleware(request);

			expect(response.status).toBe(307);
			expect(response.headers.get("location")).toContain("/auth");
		});

		it("redirects to auth when session fetch fails", async () => {
			mockGetSessionCookie.mockReturnValue("session-token");
			vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

			const request = createRequest("/dashboard", {
				cookies: { "better-auth.session_token": "session-token" },
			});

			const response = await middleware(request);

			expect(response.status).toBe(307);
			expect(response.headers.get("location")).toContain("/auth");
		});

		it("redirects to auth when auth service returns non-ok response", async () => {
			mockGetSessionCookie.mockReturnValue("session-token");
			vi.mocked(global.fetch).mockResolvedValue(
				createMockFetchResponse({ ok: false }),
			);

			const request = createRequest("/dashboard", {
				cookies: { "better-auth.session_token": "session-token" },
			});

			const response = await middleware(request);

			expect(response.status).toBe(307);
			expect(response.headers.get("location")).toContain("/auth");
		});

		it("redirects to auth when session data is empty", async () => {
			mockGetSessionCookie.mockReturnValue("session-token");
			vi.mocked(global.fetch).mockResolvedValue(
				createMockFetchResponse({
					ok: true,
					json: async () => ({}),
				}),
			);

			const request = createRequest("/dashboard", {
				cookies: { "better-auth.session_token": "session-token" },
			});

			const response = await middleware(request);

			expect(response.status).toBe(307);
			expect(response.headers.get("location")).toContain("/auth");
		});
	});

	describe("admin role validation", () => {
		it("redirects to forbidden when user has no role", async () => {
			mockGetSessionCookie.mockReturnValue("session-token");
			vi.mocked(global.fetch).mockResolvedValue(
				createMockFetchResponse({
					ok: true,
					json: async () => ({
						session: { id: "session-123" },
						user: { id: "user-123", email: "user@example.com" },
					}),
				}),
			);

			const request = createRequest("/dashboard", {
				cookies: { "better-auth.session_token": "session-token" },
			});

			const response = await middleware(request);

			expect(response.status).toBe(307);
			expect(response.headers.get("location")).toContain("/forbidden");
		});

		it("redirects to forbidden when user has user role", async () => {
			mockGetSessionCookie.mockReturnValue("session-token");
			vi.mocked(global.fetch).mockResolvedValue(
				createMockFetchResponse({
					ok: true,
					json: async () => ({
						session: { id: "session-123" },
						user: { id: "user-123", email: "user@example.com", role: "user" },
					}),
				}),
			);

			const request = createRequest("/dashboard", {
				cookies: { "better-auth.session_token": "session-token" },
			});

			const response = await middleware(request);

			expect(response.status).toBe(307);
			expect(response.headers.get("location")).toContain("/forbidden");
		});

		it("allows access when user has admin role", async () => {
			mockGetSessionCookie.mockReturnValue("session-token");
			vi.mocked(global.fetch).mockResolvedValue(
				createMockFetchResponse({
					ok: true,
					json: async () => ({
						session: { id: "session-123" },
						user: { id: "user-123", email: "admin@example.com", role: "admin" },
					}),
				}),
			);

			const request = createRequest("/dashboard", {
				cookies: { "better-auth.session_token": "session-token" },
			});

			const response = await middleware(request);

			// NextResponse.next() returns undefined headers for location
			expect(response.headers.get("location")).toBeNull();
		});
	});

	describe("banned user handling", () => {
		it("redirects to forbidden when user is banned", async () => {
			mockGetSessionCookie.mockReturnValue("session-token");
			vi.mocked(global.fetch).mockResolvedValue(
				createMockFetchResponse({
					ok: true,
					json: async () => ({
						session: { id: "session-123" },
						user: {
							id: "user-123",
							email: "banned@example.com",
							role: "admin",
							banned: true,
						},
					}),
				}),
			);

			const request = createRequest("/dashboard", {
				cookies: { "better-auth.session_token": "session-token" },
			});

			const response = await middleware(request);

			expect(response.status).toBe(307);
			expect(response.headers.get("location")).toContain("/forbidden");
		});
	});

	describe("redirect URL preservation", () => {
		it("includes return URL in auth redirect", async () => {
			mockGetSessionCookie.mockReturnValue(null);
			const request = createRequest("/workflows?filter=active");

			const response = await middleware(request);

			const location = response.headers.get("location");
			expect(location).toContain("redirect_to=");
			expect(location).toContain(
				encodeURIComponent("/workflows?filter=active"),
			);
		});
	});

	describe("Set-Cookie header forwarding", () => {
		it("forwards Set-Cookie headers from auth-svc on successful admin access", async () => {
			mockGetSessionCookie.mockReturnValue("session-token");
			vi.mocked(global.fetch).mockResolvedValue(
				createMockFetchResponse({
					ok: true,
					json: async () => ({
						session: { id: "session-123" },
						user: { id: "user-123", email: "admin@example.com", role: "admin" },
					}),
					setCookies: ["better-auth.session_token=new-token; Path=/; HttpOnly"],
				}),
			);

			const request = createRequest("/dashboard", {
				cookies: { "better-auth.session_token": "session-token" },
			});

			const response = await middleware(request);

			expect(response.headers.get("set-cookie")).toContain(
				"better-auth.session_token=new-token",
			);
		});

		it("forwards Set-Cookie headers from auth-svc on non-ok redirect to login", async () => {
			mockGetSessionCookie.mockReturnValue("session-token");
			vi.mocked(global.fetch).mockResolvedValue(
				createMockFetchResponse({
					ok: false,
					setCookies: [
						"better-auth.session_token=; Path=/; HttpOnly; Max-Age=0",
					],
				}),
			);

			const request = createRequest("/dashboard", {
				cookies: { "better-auth.session_token": "session-token" },
			});

			const response = await middleware(request);

			expect(response.status).toBe(307);
			expect(response.headers.get("location")).toContain("/auth");
			expect(response.headers.get("set-cookie")).toContain(
				"better-auth.session_token=",
			);
		});

		it("does not add Set-Cookie when auth-svc returns no cookies", async () => {
			mockGetSessionCookie.mockReturnValue("session-token");
			vi.mocked(global.fetch).mockResolvedValue(
				createMockFetchResponse({
					ok: true,
					json: async () => ({
						session: { id: "session-123" },
						user: { id: "user-123", email: "admin@example.com", role: "admin" },
					}),
					setCookies: [],
				}),
			);

			const request = createRequest("/dashboard", {
				cookies: { "better-auth.session_token": "session-token" },
			});

			const response = await middleware(request);

			expect(response.headers.get("set-cookie")).toBeNull();
		});
	});

	describe("external origin handling", () => {
		it("uses external origin from x-forwarded headers", async () => {
			mockGetSessionCookie.mockReturnValue(null);
			const request = createRequest("/dashboard", {
				headers: {
					"x-forwarded-proto": "https",
					"x-forwarded-host": "workflow.example.com",
				},
			});

			const response = await middleware(request);

			const location = response.headers.get("location");
			// The redirect URL should be encoded in the redirect_to parameter
			expect(location).toContain("redirect_to=");
			expect(location).toContain(
				encodeURIComponent("https://workflow.example.com/dashboard"),
			);
		});

		it("falls back to request URL when no x-forwarded headers", async () => {
			mockGetSessionCookie.mockReturnValue(null);
			const request = createRequest("/dashboard");

			const response = await middleware(request);

			const location = response.headers.get("location");
			// The redirect URL should be encoded in the redirect_to parameter
			expect(location).toContain("redirect_to=");
			expect(location).toContain(
				encodeURIComponent("http://localhost:3000/dashboard"),
			);
		});
	});
});

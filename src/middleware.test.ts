import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock better-auth/cookies
vi.mock("better-auth/cookies", () => ({
	getSessionCookie: vi.fn(),
}));

import { getSessionCookie } from "better-auth/cookies";
import { middleware } from "./middleware";

function mockAuthFetches(options?: {
	sessionBody?: Record<string, unknown>;
	permissions?: { roleSlug: string | null; actions: string[] };
}) {
	vi.mocked(global.fetch).mockImplementation(async (input) => {
		const url = String(input);
		if (url.includes("/permissions/me")) {
			return {
				ok: true,
				json: async () => ({
					success: true,
					data: options?.permissions ?? {
						roleSlug: "superadmin",
						actions: ["access:workflowapp"],
					},
				}),
			} as Response;
		}

		return {
			ok: true,
			json: async () =>
				options?.sessionBody ?? {
					session: { id: "session-123" },
					user: {
						id: "user-123",
						email: "admin@example.com",
						role: "admin",
					},
				},
		} as Response;
	});
}

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
			vi.mocked(global.fetch).mockResolvedValue({
				ok: false,
			} as Response);

			const request = createRequest("/dashboard", {
				cookies: { "better-auth.session_token": "session-token" },
			});

			const response = await middleware(request);

			expect(response.status).toBe(307);
			expect(response.headers.get("location")).toContain("/auth");
		});

		it("redirects to auth when session data is empty", async () => {
			mockGetSessionCookie.mockReturnValue("session-token");
			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				json: async () => ({}),
			} as Response);

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
			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				json: async () => ({
					session: { id: "session-123" },
					user: { id: "user-123", email: "user@example.com" },
				}),
			} as Response);

			const request = createRequest("/dashboard", {
				cookies: { "better-auth.session_token": "session-token" },
			});

			const response = await middleware(request);

			expect(response.status).toBe(307);
			expect(response.headers.get("location")).toContain("/forbidden");
		});

		it("redirects to forbidden when user has user role", async () => {
			mockGetSessionCookie.mockReturnValue("session-token");
			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				json: async () => ({
					session: { id: "session-123" },
					user: { id: "user-123", email: "user@example.com", role: "user" },
				}),
			} as Response);

			const request = createRequest("/dashboard", {
				cookies: { "better-auth.session_token": "session-token" },
			});

			const response = await middleware(request);

			expect(response.status).toBe(307);
			expect(response.headers.get("location")).toContain("/forbidden");
		});

		it("allows access when user has admin role and workflow app access", async () => {
			mockGetSessionCookie.mockReturnValue("session-token");
			mockAuthFetches();

			const request = createRequest("/dashboard", {
				cookies: { "better-auth.session_token": "session-token" },
			});

			const response = await middleware(request);

			// NextResponse.next() returns undefined headers for location
			expect(response.headers.get("location")).toBeNull();
		});

		it("redirects to forbidden when admin lacks workflow app access", async () => {
			mockGetSessionCookie.mockReturnValue("session-token");
			mockAuthFetches({
				permissions: { roleSlug: "viewer", actions: ["read:workflow"] },
			});

			const request = createRequest("/dashboard", {
				cookies: { "better-auth.session_token": "session-token" },
			});

			const response = await middleware(request);

			expect(response.status).toBe(307);
			expect(response.headers.get("location")).toContain("/forbidden");
		});
	});

	describe("banned user handling", () => {
		it("redirects to forbidden when user is banned", async () => {
			mockGetSessionCookie.mockReturnValue("session-token");
			vi.mocked(global.fetch).mockResolvedValue({
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
			} as Response);

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

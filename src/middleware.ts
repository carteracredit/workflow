import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Get auth app URL for redirects.
 */
const getAuthAppUrl = () => {
	return (
		process.env.NEXT_PUBLIC_AUTH_APP_URL ||
		"https://auth.carteracredit.workers.dev"
	);
};

/**
 * Get auth service URL for session validation.
 */
const getAuthServiceUrl = () => {
	return (
		process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ||
		"https://auth-svc.carteracredit.workers.dev"
	);
};

/**
 * Get the external base URL for the request, using forwarded headers from reverse proxy.
 * Returns the origin (protocol + host) without path.
 */
function getExternalOrigin(request: NextRequest): string {
	const forwardedHost = request.headers.get("x-forwarded-host");
	const forwardedProto = request.headers.get("x-forwarded-proto");

	if (forwardedHost) {
		const protocol = forwardedProto || "https";
		return `${protocol}://${forwardedHost}`;
	}

	return new URL(request.url).origin;
}

/**
 * Get the full external URL for the request.
 */
function getExternalUrl(request: NextRequest): string {
	const origin = getExternalOrigin(request);
	const pathname = request.nextUrl.pathname;
	const search = request.nextUrl.search;
	return `${origin}${pathname}${search}`;
}

/**
 * Redirect to login page with return URL.
 */
function redirectToLogin(request: NextRequest): NextResponse {
	const authAppUrl = getAuthAppUrl();
	const returnUrl = encodeURIComponent(getExternalUrl(request));
	return NextResponse.redirect(`${authAppUrl}/login?redirect_to=${returnUrl}`);
}

/**
 * Redirect to forbidden page for non-admin users.
 */
function redirectToForbidden(request: NextRequest): NextResponse {
	const url = new URL("/forbidden", request.url);
	return NextResponse.redirect(url);
}

/**
 * Check if user role includes "admin".
 * Better-auth stores multiple roles as comma-separated string.
 */
function hasAdminRole(role?: string | null): boolean {
	if (!role) return false;
	const roles = role.split(",").map((r) => r.trim().toLowerCase());
	return roles.includes("admin");
}

/**
 * Session response type from auth service.
 */
interface SessionResponse {
	session?: {
		id?: string;
		userId?: string;
		activeOrganizationId?: string;
	};
	user?: {
		id?: string;
		email?: string;
		role?: string;
		banned?: boolean;
	};
}

/**
 * Admin dashboard middleware.
 *
 * Enforces:
 * 1. User must be authenticated (has valid session)
 * 2. User must have "admin" role
 * 3. User must not be banned
 *
 * Non-authenticated users are redirected to login.
 * Non-admin users are redirected to forbidden page.
 */
export async function middleware(request: NextRequest) {
	const sessionCookie = getSessionCookie(request);

	// No session cookie → redirect to auth app login
	if (!sessionCookie) {
		return redirectToLogin(request);
	}

	const cookieHeader = request.headers.get("cookie") || "";

	let sessionData: SessionResponse | null = null;

	try {
		const response = await fetch(
			`${getAuthServiceUrl()}/api/auth/get-session`,
			{
				headers: {
					Cookie: cookieHeader,
					Origin: getAuthAppUrl(),
				},
				cache: "no-store",
			},
		);

		if (!response.ok) {
			return redirectToLogin(request);
		}

		sessionData = (await response.json()) as SessionResponse;

		if (!sessionData?.session || !sessionData?.user) {
			return redirectToLogin(request);
		}
	} catch {
		return redirectToLogin(request);
	}

	// Check if user is banned
	if (sessionData.user?.banned) {
		return redirectToForbidden(request);
	}

	// Check for admin role
	if (!hasAdminRole(sessionData.user?.role)) {
		return redirectToForbidden(request);
	}

	// Admin user with valid session - allow access
	return NextResponse.next();
}

/**
 * Matcher configuration.
 *
 * Applies middleware to all routes except:
 * - API routes (/api/*)
 * - Next.js static files (_next/static, _next/image)
 * - Favicon and other static assets
 * - The forbidden page itself (to avoid redirect loop)
 */
export const config = {
	matcher: [
		"/((?!api|_next/static|_next/image|favicon.ico|site.webmanifest|forbidden|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};

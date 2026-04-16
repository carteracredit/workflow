import { cookies } from "next/headers";
import { getAuthServiceUrl, getAuthAppUrl } from "./config";

/** In-process cache with TTL so multiple server actions reuse one token. */
const JWT_TTL_MS = 50_000;
let serverTokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Resets the server-side token cache. Only for use in tests.
 * @internal
 */
export function __resetTokenCacheForTests(): void {
	serverTokenCache = null;
}

/**
 * Retrieves a JWT token from the auth service using session cookies.
 * Uses an in-process cache with TTL so multiple getJwt() calls within
 * the same window reuse one token.
 *
 * Calls the `/api/auth/token` endpoint provided by better-auth's
 * JWT plugin to exchange session cookies for a JWT token that can be used
 * to authenticate with external services (like workflow-svc).
 *
 * The JWT is signed by auth-svc and can be verified using JWKS at
 * `/api/auth/jwks`. This is different from `session.token` which is
 * just a session identifier (random string), not a verifiable JWT.
 *
 * @returns The JWT token string if successful, null otherwise
 *
 * @example
 * // Server-side usage in a Next.js Server Component or API route
 * const jwt = await getJwt();
 * if (jwt) {
 *   const response = await fetch('https://workflow-svc.example.com/workflows', {
 *     headers: { Authorization: `Bearer ${jwt}` }
 *   });
 * }
 */
export async function getJwt(): Promise<string | null> {
	const now = Date.now();
	if (serverTokenCache && serverTokenCache.expiresAt > now) {
		return serverTokenCache.token;
	}

	const cookieStore = await cookies();
	const cookieHeader = cookieStore.toString();

	if (
		!cookieHeader.includes("better-auth.session_token") &&
		!cookieHeader.includes("__Secure-better-auth.session_token")
	) {
		return null;
	}

	try {
		const response = await fetch(`${getAuthServiceUrl()}/api/auth/token`, {
			headers: {
				Cookie: cookieHeader,
				Origin: getAuthAppUrl(),
				Accept: "application/json",
			},
			cache: "no-store",
		});

		if (!response.ok) {
			console.error(
				`Failed to get JWT: ${response.status} ${response.statusText}`,
			);
			return null;
		}

		const data = (await response.json()) as { token?: string };
		const token = data.token ?? null;
		if (token) {
			serverTokenCache = {
				token,
				expiresAt: now + JWT_TTL_MS,
			};
		} else {
			serverTokenCache = null;
		}
		return token;
	} catch (error) {
		console.error("Error fetching JWT:", error);
		return null;
	}
}

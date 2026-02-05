import { cookies } from "next/headers";
import { getAuthServiceUrl, getAuthAppUrl } from "./config";
import type { Session, AdminSessionResult } from "./types";
import { isAdminRole } from "./types";

/**
 * Fetch session from auth service on the server.
 * Returns null if user is not authenticated.
 */
export async function getServerSession(): Promise<Session> {
	const cookieStore = await cookies();
	const cookieHeader = cookieStore.toString();

	// Check for session cookie existence
	if (!cookieHeader.includes("better-auth.session_token")) {
		return null;
	}

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

		if (!response.ok) return null;

		const data = (await response.json()) as {
			session?: NonNullable<Session>["session"];
			user?: NonNullable<Session>["user"];
		};

		return data.session && data.user
			? ({ user: data.user, session: data.session } as Session)
			: null;
	} catch {
		return null;
	}
}

/**
 * Validate session and check for admin role.
 *
 * This function is specifically for the admin dashboard.
 * It validates both authentication and admin role authorization.
 *
 * @returns AdminSessionResult with authentication and authorization status
 */
export async function getAdminSession(): Promise<AdminSessionResult> {
	const session = await getServerSession();

	if (!session) {
		return {
			isAuthenticated: false,
			isAdmin: false,
			session: null,
			error: "Not authenticated",
		};
	}

	const hasAdminRole = isAdminRole(session.user.role);

	if (!hasAdminRole) {
		return {
			isAuthenticated: true,
			isAdmin: false,
			session,
			error: "User does not have admin role",
		};
	}

	// Check if user is banned
	if (session.user.banned) {
		return {
			isAuthenticated: true,
			isAdmin: false,
			session,
			error: session.user.banReason || "User is banned",
		};
	}

	return {
		isAuthenticated: true,
		isAdmin: true,
		session,
	};
}

/**
 * Require admin session or throw.
 * Use in server components/actions that require admin access.
 *
 * @throws Error if user is not authenticated or not an admin
 */
export async function requireAdminSession(): Promise<NonNullable<Session>> {
	const result = await getAdminSession();

	if (!result.isAuthenticated) {
		throw new Error("Authentication required");
	}

	if (!result.isAdmin) {
		throw new Error(result.error || "Admin access required");
	}

	return result.session!;
}

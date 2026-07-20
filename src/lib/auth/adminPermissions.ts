import type { NextRequest } from "next/server";

export const SUPERADMIN_ROLE_SLUG = "superadmin";
export const ADMIN_PERMISSIONS_COOKIE = "cartera-admin-permissions";
export const PERMISSIONS_COOKIE_MAX_AGE_SECONDS = 300;

export const WORKFLOW_APP_ACCESS_ACTION = "access:workflowapp";

export type AdminPermissions = {
	roleSlug: string | null;
	actions: string[];
};

type CachedPermissionsPayload = AdminPermissions & {
	expiresAt: number;
};

export function hasAdminAction(
	permissions: AdminPermissions | null | undefined,
	action: string,
): boolean {
	if (!permissions) return false;
	if (permissions.roleSlug === SUPERADMIN_ROLE_SLUG) return true;
	return permissions.actions.includes(action);
}

export function parsePermissionsCookie(
	cookieValue: string | undefined,
): AdminPermissions | null {
	if (!cookieValue) return null;

	try {
		const parsed = JSON.parse(
			decodeURIComponent(cookieValue),
		) as CachedPermissionsPayload;
		if (!parsed.expiresAt || Date.now() > parsed.expiresAt) {
			return null;
		}
		return {
			roleSlug: parsed.roleSlug ?? null,
			actions: Array.isArray(parsed.actions) ? parsed.actions : [],
		};
	} catch {
		return null;
	}
}

export function buildPermissionsCookieValue(
	permissions: AdminPermissions,
): string {
	const payload: CachedPermissionsPayload = {
		roleSlug: permissions.roleSlug,
		actions: permissions.actions,
		expiresAt: Date.now() + PERMISSIONS_COOKIE_MAX_AGE_SECONDS * 1000,
	};
	return encodeURIComponent(JSON.stringify(payload));
}

export function setPermissionsCookie(
	response: import("next/server").NextResponse,
	permissions: AdminPermissions,
): void {
	response.cookies.set(
		ADMIN_PERMISSIONS_COOKIE,
		buildPermissionsCookieValue(permissions),
		{
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			maxAge: PERMISSIONS_COOKIE_MAX_AGE_SECONDS,
			path: "/",
		},
	);
}

export async function fetchAdminPermissions(
	authSvcUrl: string,
	authAppUrl: string,
	cookieHeader: string,
): Promise<AdminPermissions | null> {
	try {
		const response = await fetch(
			`${authSvcUrl}/api/admin/roles/permissions/me`,
			{
				headers: {
					Cookie: cookieHeader,
					Origin: authAppUrl,
				},
				cache: "no-store",
			},
		);

		if (!response.ok) {
			return null;
		}

		const body = (await response.json()) as {
			success?: boolean;
			data?: AdminPermissions;
		};

		if (!body.success || !body.data) {
			return null;
		}

		return {
			roleSlug: body.data.roleSlug ?? null,
			actions: body.data.actions ?? [],
		};
	} catch {
		return null;
	}
}

export async function resolveAppAccessForMiddleware(
	request: NextRequest,
	authSvcUrl: string,
	authAppUrl: string,
	requiredAccessAction: string,
): Promise<{
	allowed: boolean;
	permissions: AdminPermissions | null;
}> {
	const cached = parsePermissionsCookie(
		request.cookies.get(ADMIN_PERMISSIONS_COOKIE)?.value,
	);

	if (cached && hasAdminAction(cached, requiredAccessAction)) {
		return { allowed: true, permissions: cached };
	}

	const cookieHeader = request.headers.get("cookie") || "";
	const permissions = await fetchAdminPermissions(
		authSvcUrl,
		authAppUrl,
		cookieHeader,
	);

	if (!permissions || !hasAdminAction(permissions, requiredAccessAction)) {
		return { allowed: false, permissions };
	}

	return { allowed: true, permissions };
}

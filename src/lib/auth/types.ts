/**
 * Session types for the workflow application.
 *
 * The workflow app requires users to have the "admin" role.
 * Regular users cannot access the workflow dashboard.
 */

/**
 * User data from better-auth session.
 * Extended with role field for admin access control.
 */
export type User = {
	id: string;
	name: string;
	email: string;
	image: string | null;
	emailVerified: boolean;
	createdAt: Date;
	updatedAt: Date;
	/** User's role - must be "admin" for admin dashboard access */
	role?: string;
	/** Whether user is currently banned */
	banned?: boolean | null;
	/** Reason for ban if applicable */
	banReason?: string | null;
	/** When the ban expires (null = permanent) */
	banExpires?: Date | null;
};

/**
 * Session data from better-auth.
 */
export type SessionData = {
	id: string;
	userId: string;
	token: string;
	expiresAt: Date;
	createdAt: Date;
	updatedAt: Date;
	ipAddress?: string;
	userAgent?: string;
	/** Active organization ID if set */
	activeOrganizationId?: string;
	/** Whether this session is impersonating another user */
	impersonatedBy?: string | null;
};

/**
 * Combined session response type.
 * Null when user is not authenticated or not an admin.
 */
export type Session = {
	user: User;
	session: SessionData;
} | null;

/**
 * Admin-specific session validation result.
 */
export type AdminSessionResult = {
	/** Whether the user is authenticated */
	isAuthenticated: boolean;
	/** Whether the user has admin role */
	isAdmin: boolean;
	/** The session data if authenticated */
	session: Session;
	/** Error message if validation failed */
	error?: string;
};

/**
 * Check if a user has admin role.
 * Supports both single role and comma-separated multiple roles.
 */
export function isAdminRole(role?: string | null): boolean {
	if (!role) return false;
	// Better-auth stores multiple roles as comma-separated string
	const roles = role.split(",").map((r) => r.trim().toLowerCase());
	return roles.includes("admin");
}

/**
 * Cookie utilities for cross-subdomain storage
 *
 * Provides functions to read/write cookies with root domain support,
 * enabling shared preferences (theme, language) across all apps.
 */

export type Environment = "local" | "preview" | "dev" | "production";

const COOKIE_DOMAIN_BY_ENV: Record<Environment, string | undefined> = {
	local: undefined, // localhost doesn't use domain
	preview: ".carteracredit.workers.dev",
	dev: ".carteracredit.workers.dev",
	production: ".cartera.credit",
};

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year in seconds

/**
 * Detects the current environment based on the hostname
 */
export function detectEnvironment(): Environment {
	if (typeof window === "undefined") {
		// SSR - default to local, will be corrected on client
		return "local";
	}

	const hostname = window.location.hostname.toLowerCase();

	if (hostname === "localhost" || hostname === "127.0.0.1") {
		return "local";
	}

	if (hostname.endsWith(".cartera.credit") || hostname === "cartera.credit") {
		return "production";
	}

	if (hostname.endsWith(".carteracredit.workers.dev")) {
		// Check for preview deployments (e.g., pr-123-forms.carteracredit.workers.dev)
		if (hostname.match(/^pr-\d+-.*\.carteracredit\.workers\.dev$/)) {
			return "preview";
		}
		return "dev";
	}

	// Default to local for unknown hostnames
	return "local";
}

/**
 * Gets the cookie domain for the current environment
 */
export function getCookieDomain(): string | undefined {
	return COOKIE_DOMAIN_BY_ENV[detectEnvironment()];
}

/**
 * Sets a cookie with cross-subdomain support
 */
export function setCookie(
	name: string,
	value: string,
	options: {
		maxAge?: number;
		path?: string;
		sameSite?: "strict" | "lax" | "none";
		secure?: boolean;
	} = {},
): void {
	if (typeof document === "undefined") return;

	const {
		maxAge = COOKIE_MAX_AGE,
		path = "/",
		sameSite = "lax",
		secure = detectEnvironment() !== "local",
	} = options;

	const domain = getCookieDomain();

	let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
	cookie += `; path=${path}`;
	cookie += `; max-age=${maxAge}`;
	cookie += `; samesite=${sameSite}`;

	if (domain) {
		cookie += `; domain=${domain}`;
	}

	if (secure) {
		cookie += "; secure";
	}

	document.cookie = cookie;
}

/**
 * Gets a cookie value by name
 */
export function getCookie(name: string): string | undefined {
	if (typeof document === "undefined") return undefined;

	const cookies = document.cookie.split(";");
	const encodedName = encodeURIComponent(name);

	for (const cookie of cookies) {
		const [cookieName, cookieValue] = cookie.trim().split("=");
		if (cookieName === encodedName) {
			return decodeURIComponent(cookieValue || "");
		}
	}

	return undefined;
}

/**
 * Deletes a cookie
 */
export function deleteCookie(name: string): void {
	if (typeof document === "undefined") return;

	const domain = getCookieDomain();

	let cookie = `${encodeURIComponent(name)}=; path=/; max-age=0`;

	if (domain) {
		cookie += `; domain=${domain}`;
	}

	document.cookie = cookie;
}

// Cookie names for shared preferences
export const COOKIE_NAMES = {
	THEME: "cartera-theme",
	LANGUAGE: "cartera-lang",
} as const;

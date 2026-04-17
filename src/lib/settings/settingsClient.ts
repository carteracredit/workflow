"use client";

/**
 * Settings API client for the workflow frontend.
 *
 * Talks to auth-svc's /api/settings endpoints using the Better Auth
 * session cookie (credentials: "include") so preferences persist
 * across all Cartera Credit apps.
 */
import { getAuthServiceUrl } from "../auth/config";
import type {
	ResolvedSettings,
	SettingsApiResponse,
	UpdateUserSettingsInput,
	UserSettings,
} from "./types";

const getBaseUrl = () => getAuthServiceUrl();

export async function getUserSettings(): Promise<UserSettings | null> {
	const response = await fetch(`${getBaseUrl()}/api/settings/user`, {
		credentials: "include",
	});

	if (!response.ok) {
		throw new Error("Failed to fetch user settings");
	}

	const result =
		(await response.json()) as SettingsApiResponse<UserSettings | null>;
	return result.data;
}

export async function updateUserSettings(
	input: UpdateUserSettingsInput,
): Promise<UserSettings> {
	const response = await fetch(`${getBaseUrl()}/api/settings/user`, {
		method: "PATCH",
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(input),
	});

	if (!response.ok) {
		const errorResponse = (await response
			.json()
			.catch(() => ({ error: "Unknown error" }))) as { error?: string };
		throw new Error(errorResponse.error || "Failed to update user settings");
	}

	const result = (await response.json()) as SettingsApiResponse<UserSettings>;
	return result.data;
}

/**
 * Get resolved settings (merged: user > org > browser hints > defaults).
 *
 * This is what apps should hydrate from on mount so theme/language
 * reflect the authoritative server-side value.
 */
export async function getResolvedSettings(): Promise<ResolvedSettings> {
	const browserHints = {
		"accept-language": navigator.language,
		"x-timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
		"x-preferred-theme": window.matchMedia("(prefers-color-scheme: dark)")
			.matches
			? "dark"
			: "light",
	};
	const encodedHeaders = btoa(JSON.stringify(browserHints));

	const response = await fetch(
		`${getBaseUrl()}/api/settings/resolved?headers=${encodeURIComponent(encodedHeaders)}`,
		{
			credentials: "include",
		},
	);

	if (!response.ok) {
		throw new Error("Failed to fetch resolved settings");
	}

	const result =
		(await response.json()) as SettingsApiResponse<ResolvedSettings>;
	return result.data;
}

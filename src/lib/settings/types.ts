/**
 * Settings types for the workflow frontend.
 *
 * Mirrors the types exposed by auth-svc so workflow can read/write
 * user settings via the /api/settings endpoints.
 */

export type Theme = "light" | "dark" | "system";
export type DateFormat =
	| "MM/DD/YYYY"
	| "DD/MM/YYYY"
	| "YYYY-MM-DD"
	| "DD.MM.YYYY";
export type LanguageCode = "en" | "es";
export type ClockFormat = "12h" | "24h";

export interface PaymentMethod {
	id: string;
	type: "card" | "bank_account" | "paypal";
	label: string;
	last4?: string;
	isDefault?: boolean;
}

export interface UIPreferences {
	sidebarCollapsed?: boolean;
}

export interface UserSettingsMetadata extends UIPreferences {
	[key: string]: unknown;
}

export interface UserSettings {
	id: string;
	userId: string;
	theme: Theme | null;
	timezone: string | null;
	language: LanguageCode | null;
	dateFormat: DateFormat | null;
	clockFormat: ClockFormat | null;
	paymentMethods: PaymentMethod[];
	metadata: UserSettingsMetadata | null;
	createdAt: string;
	updatedAt: string;
}

export interface ResolvedSettings {
	theme: Theme;
	timezone: string;
	language: LanguageCode;
	dateFormat: DateFormat;
	clockFormat: ClockFormat;
	paymentMethods: PaymentMethod[];
	sources: {
		theme: "user" | "browser" | "default";
		timezone: "user" | "browser" | "default";
		language: "user" | "browser" | "default";
		dateFormat: "user" | "default";
		clockFormat: "user" | "default";
	};
}

export interface UpdateUserSettingsInput {
	theme?: Theme | null;
	timezone?: string | null;
	language?: LanguageCode | null;
	dateFormat?: DateFormat | null;
	clockFormat?: ClockFormat | null;
	paymentMethods?: PaymentMethod[];
	metadata?: UserSettingsMetadata;
}

export interface SettingsApiResponse<T> {
	success: boolean;
	data: T;
	error?: string;
}

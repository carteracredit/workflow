"use client";
import {
	ThemeProvider as NextThemesProvider,
	type ThemeProviderProps,
	useTheme,
} from "next-themes";
import { useEffect, useRef, useState } from "react";
import { COOKIE_NAMES, getCookie, setCookie } from "@/lib/cookies";
import {
	getResolvedSettings,
	type Theme,
	updateUserSettings,
} from "@/lib/settings";

type AppTheme = "light" | "dark" | "system";

/**
 * Syncs theme across the shared cross-subdomain cookie and the
 * auth-svc user settings API so theme is consistent across all
 * Cartera Credit apps (auth, admin, workflow, cases, contractor).
 */
function ThemeSettingsSyncer({ children }: { children: React.ReactNode }) {
	const { theme, setTheme } = useTheme();
	const [initialized, setInitialized] = useState(false);
	const [settingsSynced, setSettingsSynced] = useState(false);
	const previousTheme = useRef<string | undefined>(undefined);

	useEffect(() => {
		if (initialized) return;

		const cookieTheme = getCookie(COOKIE_NAMES.THEME);
		if (cookieTheme && ["light", "dark", "system"].includes(cookieTheme)) {
			if (cookieTheme !== theme) {
				setTheme(cookieTheme);
			}
		}
		setInitialized(true);
		previousTheme.current = cookieTheme || theme;

		getResolvedSettings()
			.then((settings) => {
				const apiTheme = settings.theme;
				if (!apiTheme || !["light", "dark", "system"].includes(apiTheme)) {
					return;
				}

				const cookieTheme = getCookie(COOKIE_NAMES.THEME);
				const hasExplicitCookie =
					cookieTheme && ["light", "dark", "system"].includes(cookieTheme);

				if (settings.sources?.theme === "user") {
					setTheme(apiTheme);
					setCookie(COOKIE_NAMES.THEME, apiTheme);
					previousTheme.current = apiTheme;
				} else if (hasExplicitCookie) {
					setTheme(cookieTheme as AppTheme);
					previousTheme.current = cookieTheme;
					updateUserSettings({ theme: cookieTheme as Theme }).catch((error) => {
						console.debug("Failed to promote theme to API:", error);
					});
				} else {
					setTheme(apiTheme);
					previousTheme.current = apiTheme;
				}
			})
			.catch((error) => {
				console.debug("Settings API unavailable:", error);
			})
			.finally(() => {
				setSettingsSynced(true);
			});
	}, [initialized, theme, setTheme]);

	useEffect(() => {
		if (!initialized || !theme) return;

		if (theme === previousTheme.current) return;
		previousTheme.current = theme;

		setCookie(COOKIE_NAMES.THEME, theme);

		if (settingsSynced) {
			updateUserSettings({ theme: theme as Theme }).catch((error) => {
				console.debug("Failed to update theme in API:", error);
			});
		}
	}, [theme, initialized, settingsSynced]);

	return <>{children}</>;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			storageKey={COOKIE_NAMES.THEME}
			{...props}
		>
			{mounted ? <ThemeSettingsSyncer>{children}</ThemeSettingsSyncer> : null}
		</NextThemesProvider>
	);
}

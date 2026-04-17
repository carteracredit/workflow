"use client";

import {
	createContext,
	type ReactNode,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { COOKIE_NAMES, getCookie, setCookie } from "@/lib/cookies";
import {
	getResolvedSettings,
	type LanguageCode,
	updateUserSettings,
} from "@/lib/settings";
import {
	detectBrowserLanguage,
	type Language,
	translations,
} from "@/lib/translations";

interface LanguageContextType {
	language: Language;
	setLanguage: (lang: Language) => void;
	t: (key: string) => string;
	getFieldLabel: (label: string, labelEs?: string) => string;
	getFieldPlaceholder: (
		placeholder?: string,
		placeholderEs?: string,
	) => string | undefined;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
	undefined,
);

interface LanguageProviderProps {
	children: ReactNode;
	/** Force a specific language (useful for testing) */
	defaultLanguage?: Language;
}

export function LanguageProvider({
	children,
	defaultLanguage,
}: LanguageProviderProps) {
	const [language, setLanguageState] = useState<Language>(
		defaultLanguage ?? "es",
	);
	const [mounted, setMounted] = useState(false);
	const [settingsSynced, setSettingsSynced] = useState(false);

	useEffect(() => {
		setMounted(true);
		if (defaultLanguage) {
			return;
		}

		// Step 1: cookie first so there is no flash of wrong language.
		const stored = getCookie(COOKIE_NAMES.LANGUAGE) as Language | undefined;
		if (stored && ["es", "en"].includes(stored)) {
			setLanguageState(stored);
		} else {
			const detected = detectBrowserLanguage();
			setLanguageState(detected);
			setCookie(COOKIE_NAMES.LANGUAGE, detected);
		}

		// Step 2: verify against auth-svc so cross-app value wins.
		getResolvedSettings()
			.then((settings) => {
				const apiLanguage = settings.language as Language;
				if (apiLanguage === "en" || apiLanguage === "es") {
					setLanguageState(apiLanguage);
					setCookie(COOKIE_NAMES.LANGUAGE, apiLanguage);
				}
				setSettingsSynced(true);
			})
			.catch((error) => {
				console.debug("Settings API unavailable:", error);
				setSettingsSynced(true);
			});
	}, [defaultLanguage]);

	const setLanguage = useCallback(
		(lang: Language) => {
			setLanguageState(lang);
			setCookie(COOKIE_NAMES.LANGUAGE, lang);

			if (settingsSynced) {
				updateUserSettings({ language: lang as LanguageCode }).catch(
					(error) => {
						console.debug("Failed to update language in API:", error);
					},
				);
			}
		},
		[settingsSynced],
	);

	/**
	 * Translation function supporting nested keys with dot notation.
	 */
	const t = (key: string): string => {
		const keys = key.split(".");
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let value: any = translations[language];

		for (const k of keys) {
			if (value && typeof value === "object" && k in value) {
				value = value[k];
			} else {
				// Fallback to English if key not found in the active language
				value = translations.en;
				for (const fallbackKey of keys) {
					if (value && typeof value === "object" && fallbackKey in value) {
						value = value[fallbackKey];
					} else {
						return key;
					}
				}
				break;
			}
		}

		return typeof value === "string" ? value : key;
	};

	const getFieldLabel = (label: string, labelEs?: string): string => {
		if (language === "es" && labelEs) {
			return labelEs;
		}
		return label;
	};

	const getFieldPlaceholder = (
		placeholder?: string,
		placeholderEs?: string,
	): string | undefined => {
		if (language === "es" && placeholderEs) {
			return placeholderEs;
		}
		return placeholder;
	};

	if (!mounted) {
		const ssrLanguage = defaultLanguage ?? "es";
		return (
			<LanguageContext.Provider
				value={{
					language: ssrLanguage,
					setLanguage: () => {},
					t: (key) => {
						const keys = key.split(".");
						// eslint-disable-next-line @typescript-eslint/no-explicit-any
						let value: any = translations[ssrLanguage];
						for (const k of keys) {
							if (value && typeof value === "object" && k in value) {
								value = value[k];
							} else {
								return key;
							}
						}
						return typeof value === "string" ? value : key;
					},
					getFieldLabel: (label) => label,
					getFieldPlaceholder: (placeholder) => placeholder,
				}}
			>
				{children}
			</LanguageContext.Provider>
		);
	}

	return (
		<LanguageContext.Provider
			value={{ language, setLanguage, t, getFieldLabel, getFieldPlaceholder }}
		>
			{children}
		</LanguageContext.Provider>
	);
}

export function useLanguage() {
	const context = useContext(LanguageContext);
	if (!context) {
		throw new Error("useLanguage must be used within a LanguageProvider");
	}
	return context;
}

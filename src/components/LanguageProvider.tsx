"use client";

import {
	createContext,
	useContext,
	useEffect,
	useState,
	type ReactNode,
} from "react";
import {
	type Language,
	translations,
	detectBrowserLanguage,
} from "@/lib/translations";
import { getCookie, setCookie, COOKIE_NAMES } from "@/lib/cookies";

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

	useEffect(() => {
		setMounted(true);
		// If defaultLanguage is set, skip detection (useful for testing)
		if (defaultLanguage) {
			return;
		}
		// Check cookie first, then browser language
		const stored = getCookie(COOKIE_NAMES.LANGUAGE) as Language | undefined;
		if (stored && ["es", "en"].includes(stored)) {
			setLanguageState(stored);
		} else {
			const detected = detectBrowserLanguage();
			setLanguageState(detected);
			setCookie(COOKIE_NAMES.LANGUAGE, detected);
		}
	}, [defaultLanguage]);

	const setLanguage = (lang: Language) => {
		setLanguageState(lang);
		setCookie(COOKIE_NAMES.LANGUAGE, lang);
	};

	/**
	 * Translation function supporting nested keys with dot notation
	 */
	const t = (key: string): string => {
		const keys = key.split(".");
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		let value: any = translations[language];

		for (const k of keys) {
			if (value && typeof value === "object" && k in value) {
				value = value[k];
			} else {
				// Fallback to English if key not found
				value = translations.en;
				for (const fallbackKey of keys) {
					if (value && typeof value === "object" && fallbackKey in value) {
						value = value[fallbackKey];
					} else {
						return key; // Return key if not found in fallback either
					}
				}
				break;
			}
		}

		return typeof value === "string" ? value : key;
	};

	/**
	 * Get field label based on current language
	 */
	const getFieldLabel = (label: string, labelEs?: string): string => {
		if (language === "es" && labelEs) {
			return labelEs;
		}
		return label;
	};

	/**
	 * Get field placeholder based on current language
	 */
	const getFieldPlaceholder = (
		placeholder?: string,
		placeholderEs?: string,
	): string | undefined => {
		if (language === "es" && placeholderEs) {
			return placeholderEs;
		}
		return placeholder;
	};

	// Return default context during SSR
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

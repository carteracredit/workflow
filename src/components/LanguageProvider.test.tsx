import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { LanguageProvider, useLanguage } from "./LanguageProvider";
import * as settings from "@/lib/settings";
import * as cookieUtils from "@/lib/cookies";

const mockGetCookie = vi.fn();
const mockSetCookie = vi.fn();

vi.mock("@/lib/cookies", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/cookies")>();
	return {
		getCookie: (...args: unknown[]) => mockGetCookie(...args),
		setCookie: (...args: unknown[]) => mockSetCookie(...args),
		COOKIE_NAMES: actual.COOKIE_NAMES,
	};
});

vi.mock("@/lib/settings", () => ({
	getResolvedSettings: vi.fn(() =>
		Promise.reject(new Error("no api in tests")),
	),
	updateUserSettings: vi.fn(() => Promise.resolve({})),
}));

vi.mock("@/lib/translations", () => ({
	translations: {
		en: {
			common: { save: "Save", cancel: "Cancel" },
			testKey: "English Test",
		},
		es: {
			common: { save: "Guardar", cancel: "Cancelar" },
			testKey: "Spanish Test",
		},
	},
	detectBrowserLanguage: vi.fn(() => "es"),
}));

describe("LanguageProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetCookie.mockReturnValue(undefined);
		vi.spyOn(console, "debug").mockImplementation(() => {});
	});

	afterEach(() => {
		cleanup();
		vi.restoreAllMocks();
	});

	it("should provide translations and language switching", async () => {
		function TestComponent() {
			const { t, setLanguage } = useLanguage();

			return (
				<div>
					<span data-testid="translated">{t("common.save")}</span>
					<button
						type="button"
						onClick={() => setLanguage("en")}
						data-testid="switch-en"
					>
						Switch to English
					</button>
				</div>
			);
		}

		const { container } = render(
			<LanguageProvider>
				<TestComponent />
			</LanguageProvider>,
		);

		expect(
			container.querySelector('[data-testid="translated"]'),
		).toHaveTextContent("Guardar");

		fireEvent.click(
			container.querySelector('[data-testid="switch-en"]') as HTMLElement,
		);

		await waitFor(() => {
			expect(
				container.querySelector('[data-testid="translated"]'),
			).toHaveTextContent("Save");
		});
	});

	it("detects browser language without writing a cookie", async () => {
		function TestComponent() {
			const { language } = useLanguage();
			return <span data-testid="language">{language}</span>;
		}

		render(
			<LanguageProvider>
				<TestComponent />
			</LanguageProvider>,
		);

		await waitFor(() => {
			expect(
				document.querySelector('[data-testid="language"]'),
			).toHaveTextContent("es");
		});
		expect(mockSetCookie).not.toHaveBeenCalled();
	});

	it("should fall back to English label when Spanish not provided", () => {
		function FallbackComponent() {
			const { getFieldLabel } = useLanguage();
			return (
				<span data-testid="label">
					{getFieldLabel("Only English", undefined)}
				</span>
			);
		}

		const { container } = render(
			<LanguageProvider>
				<FallbackComponent />
			</LanguageProvider>,
		);

		expect(container.querySelector('[data-testid="label"]')).toHaveTextContent(
			"Only English",
		);
	});

	it("should use language from cookie when available", () => {
		mockGetCookie.mockReturnValue("en");

		function TestComponent() {
			const { t } = useLanguage();
			return <span data-testid="translated">{t("common.save")}</span>;
		}

		const { container } = render(
			<LanguageProvider>
				<TestComponent />
			</LanguageProvider>,
		);

		expect(
			container.querySelector('[data-testid="translated"]'),
		).toHaveTextContent("Save");
	});

	it("promotes cookie choice when API resolves from browser", async () => {
		mockGetCookie.mockReturnValue("en");
		vi.mocked(settings.getResolvedSettings).mockResolvedValueOnce({
			theme: "system",
			timezone: "UTC",
			language: "es",
			dateFormat: "DD/MM/YYYY",
			clockFormat: "12h",
			paymentMethods: [],
			sources: {
				theme: "default",
				timezone: "default",
				language: "browser",
				dateFormat: "default",
				clockFormat: "default",
			},
		});

		function TestComponent() {
			const { language } = useLanguage();
			return <span data-testid="language">{language}</span>;
		}

		render(
			<LanguageProvider>
				<TestComponent />
			</LanguageProvider>,
		);

		await waitFor(() => {
			expect(
				document.querySelector('[data-testid="language"]'),
			).toHaveTextContent("en");
		});
		expect(settings.updateUserSettings).toHaveBeenCalledWith({
			language: "en",
		});
		expect(mockSetCookie).not.toHaveBeenCalledWith(
			cookieUtils.COOKIE_NAMES.LANGUAGE,
			"es",
		);
	});

	it("should save language to cookie when changed", async () => {
		function TestComponent() {
			const { setLanguage } = useLanguage();
			return (
				<button
					type="button"
					onClick={() => setLanguage("en")}
					data-testid="switch"
				>
					Switch
				</button>
			);
		}

		const { container } = render(
			<LanguageProvider>
				<TestComponent />
			</LanguageProvider>,
		);

		fireEvent.click(container.querySelector('[data-testid="switch"]')!);

		await waitFor(() => {
			expect(mockSetCookie).toHaveBeenCalledWith(
				cookieUtils.COOKIE_NAMES.LANGUAGE,
				"en",
			);
		});
	});

	it("should fall back to English placeholder when Spanish not provided", () => {
		function TestComponent() {
			const { getFieldPlaceholder } = useLanguage();
			return (
				<span data-testid="placeholder">
					{getFieldPlaceholder("English Only", undefined)}
				</span>
			);
		}

		const { container } = render(
			<LanguageProvider>
				<TestComponent />
			</LanguageProvider>,
		);

		expect(
			container.querySelector('[data-testid="placeholder"]'),
		).toHaveTextContent("English Only");
	});

	it("should return empty string for undefined placeholder", () => {
		function TestComponent() {
			const { getFieldPlaceholder } = useLanguage();
			return (
				<span data-testid="empty">
					{getFieldPlaceholder(undefined, undefined) || "EMPTY"}
				</span>
			);
		}

		const { container } = render(
			<LanguageProvider>
				<TestComponent />
			</LanguageProvider>,
		);

		expect(container.querySelector('[data-testid="empty"]')).toHaveTextContent(
			"EMPTY",
		);
	});

	it("should throw error when used outside provider", () => {
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

		function TestComponent() {
			const { t } = useLanguage();
			return <span>{t("test")}</span>;
		}

		expect(() => {
			render(<TestComponent />);
		}).toThrow();

		consoleSpy.mockRestore();
	});
});

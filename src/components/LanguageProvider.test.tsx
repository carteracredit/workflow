import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { LanguageProvider, useLanguage } from "./LanguageProvider";

// Mock cookies module - reset each test
const mockGetCookie = vi.fn();
const mockSetCookie = vi.fn();

vi.mock("@/lib/cookies", () => ({
	getCookie: () => mockGetCookie(),
	setCookie: (...args: unknown[]) => mockSetCookie(...args),
	COOKIE_NAMES: { LANGUAGE: "cartera-lang" },
}));

// Mock translations
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
		mockGetCookie.mockReset();
		mockSetCookie.mockReset();
		mockGetCookie.mockReturnValue(undefined); // Default to no cookie
	});

	afterEach(() => {
		cleanup();
	});

	it("should provide translations and language switching", async () => {
		function TestComponent() {
			const { language, t, setLanguage, getFieldLabel, getFieldPlaceholder } =
				useLanguage();

			return (
				<div>
					<span data-testid="language">{language}</span>
					<span data-testid="translated">{t("common.save")}</span>
					<span data-testid="field-label">
						{getFieldLabel("English Label", "Spanish Label")}
					</span>
					<span data-testid="field-placeholder">
						{getFieldPlaceholder("English Placeholder", "Spanish Placeholder")}
					</span>
					<button onClick={() => setLanguage("en")} data-testid="switch-en">
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

		// Check initial state (Spanish from detectBrowserLanguage)
		expect(
			container.querySelector('[data-testid="translated"]'),
		).toHaveTextContent("Guardar");

		// Switch to English
		const switchButton = container.querySelector(
			'[data-testid="switch-en"]',
		) as HTMLElement;
		fireEvent.click(switchButton);

		await waitFor(() => {
			expect(
				container.querySelector('[data-testid="translated"]'),
			).toHaveTextContent("Save");
		});
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

	it("should save language to cookie when changed", async () => {
		function TestComponent() {
			const { setLanguage } = useLanguage();
			return (
				<button onClick={() => setLanguage("en")} data-testid="switch">
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
			expect(mockSetCookie).toHaveBeenCalled();
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

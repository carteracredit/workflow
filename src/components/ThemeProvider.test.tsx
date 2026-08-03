import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { ThemeProvider } from "./ThemeProvider";
import * as cookiesModule from "@/lib/cookies";
import { getResolvedSettings, updateUserSettings } from "@/lib/settings";

vi.mock("next-themes", () => ({
	ThemeProvider: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="next-themes-provider">{children}</div>
	),
	useTheme: () => ({
		theme: "light",
		setTheme: vi.fn(),
		systemTheme: "light",
		themes: ["light", "dark", "system"],
		resolvedTheme: "light",
	}),
}));

vi.mock("@/lib/cookies", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/cookies")>();
	return {
		getCookie: vi.fn(),
		setCookie: vi.fn(),
		COOKIE_NAMES: actual.COOKIE_NAMES,
	};
});

vi.mock("@/lib/settings", () => ({
	getResolvedSettings: vi.fn(),
	updateUserSettings: vi.fn(),
}));

describe("ThemeProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(getResolvedSettings).mockRejectedValue(
			new Error("no api in tests"),
		);
		vi.mocked(updateUserSettings).mockResolvedValue({} as never);
		vi.spyOn(console, "debug").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("should render children after mounting", async () => {
		vi.spyOn(cookiesModule, "getCookie").mockReturnValue(undefined);

		const { container } = render(
			<ThemeProvider>
				<div data-testid="child">Test Content</div>
			</ThemeProvider>,
		);

		await waitFor(() => {
			expect(
				container.querySelector('[data-testid="child"]'),
			).toBeInTheDocument();
		});
	});

	it("should render next-themes ThemeProvider", async () => {
		vi.spyOn(cookiesModule, "getCookie").mockReturnValue(undefined);

		const { container } = render(
			<ThemeProvider>
				<div>Test</div>
			</ThemeProvider>,
		);

		await waitFor(() => {
			expect(
				container.querySelector('[data-testid="next-themes-provider"]'),
			).toBeInTheDocument();
		});
	});

	it("promotes cookie theme when API source is not user", async () => {
		const setCookieSpy = vi.spyOn(cookiesModule, "setCookie");
		vi.spyOn(cookiesModule, "getCookie").mockReturnValue("light");
		vi.mocked(getResolvedSettings).mockResolvedValue({
			theme: "dark",
			language: "es",
			timezone: "UTC",
			dateFormat: "DD/MM/YYYY",
			clockFormat: "12h",
			paymentMethods: [],
			sources: {
				theme: "browser",
				language: "default",
				timezone: "default",
				dateFormat: "default",
				clockFormat: "default",
			},
		});

		render(
			<ThemeProvider>
				<div>Test</div>
			</ThemeProvider>,
		);

		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 200));
		});

		expect(updateUserSettings).toHaveBeenCalledWith({ theme: "light" });
		expect(setCookieSpy).not.toHaveBeenCalledWith(
			"carteracredit-theme",
			"dark",
		);
	});

	it("writes cookie when API returns user-owned theme", async () => {
		const setCookieSpy = vi.spyOn(cookiesModule, "setCookie");
		vi.spyOn(cookiesModule, "getCookie").mockReturnValue("light");
		vi.mocked(getResolvedSettings).mockResolvedValue({
			theme: "dark",
			language: "es",
			timezone: "UTC",
			dateFormat: "DD/MM/YYYY",
			clockFormat: "12h",
			paymentMethods: [],
			sources: {
				theme: "user",
				language: "default",
				timezone: "default",
				dateFormat: "default",
				clockFormat: "default",
			},
		});

		render(
			<ThemeProvider>
				<div>Test</div>
			</ThemeProvider>,
		);

		await act(async () => {
			await new Promise((resolve) => setTimeout(resolve, 200));
		});

		expect(setCookieSpy).toHaveBeenCalledWith("carteracredit-theme", "dark");
	});
});

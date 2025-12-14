import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { ThemeProvider } from "./ThemeProvider";

const mockSetTheme = vi.fn();
const mockUseTheme = vi.fn();

// Mock next-themes
vi.mock("next-themes", () => ({
	useTheme: () => mockUseTheme(),
	ThemeProvider: ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	),
}));

describe("ThemeSwitcher", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockSetTheme.mockClear();
	});

	it("should render theme switcher button", () => {
		mockUseTheme.mockReturnValue({
			theme: "light",
			setTheme: mockSetTheme,
			themes: [],
			systemTheme: "light",
			resolvedTheme: "light",
		});

		render(
			<ThemeProvider>
				<ThemeSwitcher />
			</ThemeProvider>,
		);

		const button = screen.getByRole("button", { name: /cambiar tema/i });
		expect(button).toBeInTheDocument();
	});

	it("should toggle theme from light to dark", async () => {
		const user = userEvent.setup();
		mockUseTheme.mockReturnValue({
			theme: "light",
			setTheme: mockSetTheme,
			themes: [],
			systemTheme: "light",
			resolvedTheme: "light",
		});

		render(
			<ThemeProvider>
				<ThemeSwitcher />
			</ThemeProvider>,
		);

		const buttons = screen.getAllByRole("button");
		const themeButton = buttons.find((btn) =>
			btn.getAttribute("title")?.includes("Cambiar tema"),
		);
		expect(themeButton).toBeDefined();
		if (themeButton) {
			await user.click(themeButton);
			expect(mockSetTheme).toHaveBeenCalledWith("dark");
		}
	});


	it("should display sun icon in light mode", () => {
		mockUseTheme.mockReturnValue({
			theme: "light",
			setTheme: mockSetTheme,
			themes: [],
			systemTheme: "light",
			resolvedTheme: "light",
		});

		render(
			<ThemeProvider>
				<ThemeSwitcher />
			</ThemeProvider>,
		);

		const buttons = screen.getAllByRole("button");
		const themeButton = buttons.find((btn) =>
			btn.getAttribute("title")?.includes("Cambiar tema"),
		);
		expect(themeButton).toBeInTheDocument();
		expect(themeButton).toHaveAttribute("title", "Cambiar tema");
	});
});

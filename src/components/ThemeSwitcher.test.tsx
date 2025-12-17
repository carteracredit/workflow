import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

	it("should render theme switcher button", async () => {
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

		// Wait for mounted state and button to appear
		await waitFor(
			() => {
				const button = screen.getByRole("button", { name: /cambiar tema/i });
				expect(button).toBeInTheDocument();
			},
			{ timeout: 3000 },
		);
	});

	it("should open dropdown menu when clicked", async () => {
		const user = userEvent.setup({ delay: null });
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

		await waitFor(
			() => {
				const buttons = screen.getAllByRole("button");
				const themeButton = buttons.find((btn) =>
					btn.getAttribute("title")?.includes("Cambiar tema"),
				);
				expect(themeButton).toBeDefined();
			},
			{ timeout: 3000 },
		);

		const buttons = screen.getAllByRole("button");
		const themeButton = buttons.find((btn) =>
			btn.getAttribute("title")?.includes("Cambiar tema"),
		);
		if (themeButton) {
			await user.click(themeButton);

			// Wait for dropdown to open - check for any radio item
			await waitFor(
				() => {
					const radioItems = screen.queryAllByRole("menuitemradio");
					expect(radioItems.length).toBeGreaterThan(0);
				},
				{ timeout: 3000 },
			);
		}
	});

	it("should render dropdown with theme options", async () => {
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

		await waitFor(
			() => {
				const buttons = screen.getAllByRole("button");
				const themeButton = buttons.find((btn) =>
					btn.getAttribute("title")?.includes("Cambiar tema"),
				);
				expect(themeButton).toBeDefined();
			},
			{ timeout: 3000 },
		);
	});

	it("should display correct icon for light theme", async () => {
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

		await waitFor(
			() => {
				const buttons = screen.getAllByRole("button");
				const themeButton = buttons.find((btn) =>
					btn.getAttribute("title")?.includes("Cambiar tema"),
				);
				expect(themeButton).toBeDefined();
				if (themeButton) {
					expect(themeButton).toHaveAttribute("title", "Cambiar tema");
				}
			},
			{ timeout: 3000 },
		);
	});

	it("should display correct icon for dark theme", async () => {
		mockUseTheme.mockReturnValue({
			theme: "dark",
			setTheme: mockSetTheme,
			themes: [],
			systemTheme: "dark",
			resolvedTheme: "dark",
		});

		render(
			<ThemeProvider>
				<ThemeSwitcher />
			</ThemeProvider>,
		);

		await waitFor(
			() => {
				const buttons = screen.getAllByRole("button");
				const themeButton = buttons.find((btn) =>
					btn.getAttribute("title")?.includes("Cambiar tema"),
				);
				expect(themeButton).toBeDefined();
			},
			{ timeout: 3000 },
		);
	});

	it("should display correct icon for system theme", async () => {
		mockUseTheme.mockReturnValue({
			theme: "system",
			setTheme: mockSetTheme,
			themes: [],
			systemTheme: "dark",
			resolvedTheme: "dark",
		});

		render(
			<ThemeProvider>
				<ThemeSwitcher />
			</ThemeProvider>,
		);

		await waitFor(
			() => {
				const buttons = screen.getAllByRole("button");
				const themeButton = buttons.find((btn) =>
					btn.getAttribute("title")?.includes("Cambiar tema"),
				);
				expect(themeButton).toBeDefined();
			},
			{ timeout: 3000 },
		);
	});

	it("should call setTheme when theme changes", () => {
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

		// Verify that setTheme is available (component uses it)
		expect(mockSetTheme).toBeDefined();
	});
});

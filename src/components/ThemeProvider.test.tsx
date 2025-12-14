import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ThemeProvider } from "./ThemeProvider";

// Mock next-themes
vi.mock("next-themes", () => ({
	ThemeProvider: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="next-themes-provider">{children}</div>
	),
}));

describe("ThemeProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should render children after mounting", async () => {
		const { container } = render(
			<ThemeProvider>
				<div data-testid="child">Test Content</div>
			</ThemeProvider>,
		);

		await waitFor(() => {
			expect(container.querySelector('[data-testid="child"]')).toBeInTheDocument();
		});
	});

	it("should render next-themes ThemeProvider", () => {
		const { container } = render(
			<ThemeProvider>
				<div>Test</div>
			</ThemeProvider>,
		);

		expect(
			container.querySelector('[data-testid="next-themes-provider"]'),
		).toBeInTheDocument();
	});
});

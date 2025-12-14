import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import ClientLayout from "./ClientLayout";

// Mock ThemeProvider
vi.mock("./ThemeProvider", () => ({
	ThemeProvider: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="theme-provider">{children}</div>
	),
}));

describe("ClientLayout", () => {
	it("should render children wrapped in ThemeProvider", () => {
		const { container } = render(
			<ClientLayout>
				<div data-testid="child">Test Content</div>
			</ClientLayout>,
		);

		expect(
			container.querySelector('[data-testid="theme-provider"]'),
		).toBeInTheDocument();
		expect(container.querySelector('[data-testid="child"]')).toBeInTheDocument();
	});

	it("should render multiple children", () => {
		const { container } = render(
			<ClientLayout>
				<div data-testid="child-1">Child 1</div>
				<div data-testid="child-2">Child 2</div>
			</ClientLayout>,
		);

		expect(container.querySelector('[data-testid="child-1"]')).toBeInTheDocument();
		expect(container.querySelector('[data-testid="child-2"]')).toBeInTheDocument();
	});
});
